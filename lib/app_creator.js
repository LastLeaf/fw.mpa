// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var express = require('express');
var session = require('express-session');
var cookieSignature = require('express-session/node_modules/cookie-signature');
var compress = require('compression')();
var cookieParser = require('cookie-parser')();
var sockjs = require('sockjs');
var locale = require('locale');

var utils = require('./utils.js');
var httpRouter = require('./http_router.js');
var sockHandler = require('./sock_handler.js');
var routeManager = require('./routers/route_manager.js');
var clientCache = require('./client_cache.js');
var clientRouterCreator = require('./client_router.js');
var appconfigDefault = require('./default/appconfig.js');

module.exports = function(appRouter, path){
	// parse arguments
	var args = [];
	for(var i=2; i<arguments.length; i++) {
		args.push(arguments[i]);
	}

	// create app object
	var app = {
		config: utils.deepExtend({}, appconfigDefault),
		enabled: false,
		distroyed: false
	};

	// init express
	var expressApp = app.express = express();
	expressApp.use(function(req, res, next){
		if(!req.app.enabled || req.app.destroyed) {
			res.send(503);
			return;
		}
		next();
	});
	expressApp.use(compress);
	expressApp.use(cookieParser);
	if(fw.debug) {
		// debug network log
		expressApp.use(function(req, res, next){
			console.log(utils.nowString() + ' ' + req.method + ': ' + req.path);
			next();
		});
	}

	// init socket handler
	app.socket = function(sock){
		if(!req.app.enabled || req.app.destroyed) {
			sock.end();
			return;
		}
		sockHandler.newSock(app, sock);
	};

	// session handler
	var sessionMiddleware = null;
	var sessionStore = null;
	var sessionProxy = function(options){
		if(!options.store)
			options.store = new session.MemoryStore();
		sessionStore = options.store;
		sessionMiddleware = session(options);
	};
	app.getAuthSession = function(auth, cb){
		if(auth.charAt(1) !== ':') {
			cb(null);
			return;
		}
		var str = cookieSignature.unsign(auth.slice(2), app.config.secret.cookie);
		sessionStore.get(str, function(error, res){
			if(error || !res) {
				cb(null);
				return;
			}
			var sess = new session.Session({
				sessionID: str,
				sessionStore: sessionStore
			}, res);
			cb(sess);
		});
	};
	app.generateSession = function(cb){
		var req = {};
		sessionStore.generate(req);
		sessionStore.set(req.sessionID, req.session, function(){
			var s = 's:' + cookieSignature.sign(req.sessionID, app.config.secret.cookie);
			cb(s);
		});
	};
	app.sessionCookieVal = function(id){
		return 's:' + cookieSignature.sign(id, app.config.secret.cookie);
	};

	// session middleware
	expressApp.use(function(req, res, next){
		if(!sessionMiddleware) {
			res.send(503);
			return;
		}
		sessionMiddleware(req, res, next);
	});

	// get the selected language, hacked into locale module
	locale.Locale['default'] = '';
	expressApp.use(function(req, res, next){
		var supportedLocale = new locale.Locales(req.app.config.app.locale);
		req.selectLanguage = function(str){
			req.language = (new locale.Locales(str)).best(supportedLocale).toString();
			if(typeof(str) !== 'undefined')
				res.cookie('fw.lang', req.language, {expires: new Date(Date.now() + 86400*365)});
			else
				res.clearCookie('fw.lang');
		};
		if(typeof(req.cookies['fw.lang']) !== 'undefined') var lang = req.cookies['fw.lang'];
		else var lang = req.headers['accept-language'] || '';
		req.language = (new locale.Locales(lang)).best(supportedLocale).toString();
		next();
	});

	// req.conn middleware
	expressApp.use(function(req, res, next){
		req.conn = {
			session: req.session,
			host: req.get('Host'),
			ips: ipsParser(req.header('X-Forwarded-For')),
			ip: req.ip,
			headers: req.headers,
			language: req.language,
			selectLanguage: req.selectLanguage,
		};
		req.conn.rpc = sockHandler.connRpc(app, req.conn);
		next();
	});

	// connect db
	var dbStatus = 0;
	var closeDb = null;
	var closeDbDefault = function(cb){
		closeDb = null;
		setTimeout(cb, 0);
	};
	var initDb = function(cb){
		if(app.debug) console.log('Connecting to database: ' + app.config.db.type);
		var dbEngine = require('./db/' + app.config.db.type + '.js');
		dbEngine(app.config.db, function(db, sessionStore, closeFunc){
			closeDb = closeFunc || null;
			app.db = db;
			sessionProxy({
				key: 'fw.sid',
				secret: app.config.secret.cookie,
				cookie: {
					maxAge: app.config.server.sessionLifeTime
				},
				store: sessionStore,
				resave: true,
				saveUninitialized: true
			});
			setTimeout(cb, 0);
		});
	};

	// create routes
	var routers = routeManager(app);
	var clientRouter = clientRouterCreator(app);
	var cacheUpdate = clientCache(app);

	// http req router
	httpRouter(app);

	// API
	app.setConfig = function(config){
		app.config = utils.deepExtend(config, app.config);
		if(app.config.app.host.constructor !== Array) {
			app.config.app.host = [app.config.app.host];
		}
	};
	app.setRoutes = function(prefix, routes){
		if(typeof(prefix) === 'object') {
			routes = prefix;
			prefix = '/';
		}
		clientRouter.set(prefix, routes);
	};
	app.clearRoutes = function(){
		clientRouter.clear();
	};
	var startProcessId = 0;
	app.start = function(cb){
		var pid = new Date().getTime() + Math.random();
		startProcessId = pid;
		console.log('Starting app: ' + app.config.app.title);
		clientRouter.update();
		cacheUpdate(app, routers['client'].list(), function(){
			if(startProcessId !== pid) return;
			if(fw.debug) console.log('Connecting to database: ' + app.config.db.type);
			initDb(function(){
				if(startProcessId !== pid) {
					(closeDb || closeDbDefault)(cb);
					return;
				}
				// TODO load server modules
				app.enabled = true;
				for(var i=0; i<app.config.app.host.length; i++) {
					appRouter.bindHost(app, app.config.app.host[i]);
				}
				console.log('App started: ' + app.config.app.title);
				cb();
			});
		});
	};
	app.stop = function(cb){
		startProcessId = 0;
		if(app.enabled = true) {
			app.enabled = false;
			for(var i=0; i<app.config.app.host.length; i++) {
				appRouter.unbindHost(app, app.config.app.host[i]);
			}
			(closeDb || closeDbDefault)(cb);
		}
	};
	app.restart = function(cb){
		app.stop(function(){
			app.start(cb);
		});
	};
	app.destroy = function(cb){
		if(app.enabled) app.stop();
		app.destroyed = true;
		for(var k in routers) {
			routers[k].removeAll();
		}
	};
	app.bindDir = function(type, prefix, dir, cb){
		if(typeof(prefix) === 'object') {
			cb = dir;
			dir = prefix;
			prefix = '/';
		}
		routers[type].add(prefix, dir, cb || function(){});
	};
	app.unbindDir = function(type, prefix, dir){
		if(typeof(prefix) === 'object') {
			cb = dir;
			dir = prefix;
			prefix = '/';
		}
		routers[type].remove(prefix, dir);
	};

	// get appconfig
	args.unshift(app);
	require(path).apply(fw, args);
	return app;
};
