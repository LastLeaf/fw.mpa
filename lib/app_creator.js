// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var express = require('express');
var session = require('express-session');
var cookieSignature = require('express-session/node_modules/cookie-signature');
var compress = require('compression')();
var cookieParser = require('cookie-parser')();
var sockjs = require('sockjs');
var locale = require('locale');

var utils = require('./utils.js');
var ipsParser = require('./ips_parser.js');
var httpRouter = require('./http_router.js');
var sockHandler = require('./sock_handler.js');
var routeManager = require('./routers/route_manager.js');
var clientCache = require('./client_cache.js');
var clientRouterCreator = require('./client_router.js');
var loadScript = require('./load_script.js');
var appconfigDefault = require('./default/appconfig.js');
var errorCatcher = require('./error_catcher.js');

module.exports = function(appRouter, appPath){
	// parse arguments
	var args = [];
	for(var i=2; i<arguments.length; i++) {
		args.push(arguments[i]);
	}

	// create app object
	var expressApp = express();
	var app = Object.create(expressApp);
	app.express = expressApp;
	app.config = utils.deepExtend({}, appconfigDefault);
	app.enabled = false;
	app.destroyed = false;
	app.startProcessId = 0;

	// init express
	expressApp.use(function(req, res, next){
		if(!req.app.enabled) {
			res.sendStatus(503);
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
		if(!sock.app.enabled) {
			sock.end();
			return;
		}
		sock.startProcessId = sock.app.startProcessId;
		sockHandler.newSock(sock.app, sock);
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
			res.sendStatus(503);
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
	var httpRouterStart = httpRouter(app);

	// API: config
	app.setConfig = function(config){
		app.config = utils.deepExtend(app.config, config);
		if(app.config.app.host.constructor !== Array) {
			app.config.app.host = [app.config.app.host];
		}
	};
	app.route = clientRouter;
	var startProcessId = 0;

	// API: start/stop
	app.start = function(cb){
		if(!cb) cb = function(){};
		if(startProcessId) {
			setTimeout(cb, 0);
			return;
		}
		var pid = new Date().getTime() + Math.random();
		startProcessId = pid;
		console.log('Starting app: ' + app.config.app.title);
		errorCatcher(function(){
			buildClientDirRoutes();
			cacheUpdate(routers.client.list(), function(){
				if(startProcessId !== pid) {
					cb();
					return;
				}
				if(fw.debug) console.log('Generating routes...');
				clientRouter.update(routers.page.list(), function(){
					if(startProcessId !== pid) {
						cb();
						return;
					}
					httpRouterStart(function(){
						if(startProcessId !== pid) {
							cb();
							return;
						}
						if(fw.debug) console.log('Connecting to database: ' + app.config.db.type);
						initDb(function(){
							if(startProcessId !== pid) {
								(closeDb || closeDbDefault)(cb);
								return;
							}
							buildModuleRoutes(function(){
								if(startProcessId !== pid) {
									(closeDb || closeDbDefault)(cb);
									return;
								}
								buildServerDirRoutes(function(){
									if(startProcessId !== pid) {
										(closeDb || closeDbDefault)(cb);
										return;
									}
									app.enabled = true;
									app.startProcessId = startProcessId;
									for(var i=0; i<app.config.app.host.length; i++) {
										appRouter.bindHost(app, app.config.app.host[i]);
									}
									console.log('App started: ' + app.config.app.title);
									cb();
								});
							});
						});
					});
				});
			});
		}, function(err){
			console.error('Starting app failed. App not started.');
			console.log(err.stack);
			if(fw.debug) process.exit();
		});
	};
	app.stop = function(cb){
		if(!cb) cb = function(){};
		if(!startProcessId) {
			setTimeout(cb, 0);
			return;
		}
		startProcessId = 0;
		if(app.enabled = true) {
			app.enabled = false;
			for(var k in routers) {
				routers[k].clear();
			}
			for(var i=0; i<app.config.app.host.length; i++) {
				appRouter.unbindHost(app, app.config.app.host[i]);
			}
			console.log('App stopped: ' + app.config.app.title);
			(closeDb || closeDbDefault)(cb);
		}
	};
	app.restart = function(cb){
		app.stop(function(){
			app.start(cb);
		});
	};
	app.destroy = function(cb){
		if(!cb) cb = function(){};
		app.stop(function(){
			app.destroyed = true;
			cb();
		});
	};

	// API: dir binder
	var bindedDirs = {
		client: [],
		module: [],
		page: [],
		render: [],
		rpc: [],
		static: []
	};
	app.bindDir = function(type, prefix, dir){
		if(typeof(dir) === 'undefined') {
			dir = prefix;
			prefix = '/';
		}
		bindedDirs[type].push([prefix, dir]);
	};
	app.clearBindings = function(type){
		if(type) bindedDirs[type] = [];
		else bindedDirs = {
			client: [],
			module: [],
			page: [],
			render: [],
			rpc: [],
			static: []
		};
	};
	var buildClientDirRoutes = function(){
		['client', 'static'].forEach(function(type){
			for(var i=0; i<bindedDirs[type].length; i++) {
				var bindInfo = bindedDirs[type][i];
				routers[type].add(bindInfo[0], bindInfo[1]);
			}
		});
	};
	var buildServerDirRoutes = function(cb){
		var pendingCount = 1;
		var pendingEnd = function(){
			if(--pendingCount) return;
			cb();
		};
		var pendingAdd = function(){
			pendingCount++;
			return pendingEnd;
		};
		['page', 'render', 'rpc'].forEach(function(type){
			for(var i=0; i<bindedDirs[type].length; i++) {
				var bindInfo = bindedDirs[type][i];
				routers[type].add(bindInfo[0], bindInfo[1], pendingAdd());
			}
		});
		pendingEnd();
	};
	var buildModuleRoutes = function(cb){
		app.loadedModules = {};
		var dirs = bindedDirs.module;
		var i = 0;
		var nextDir = function(){
			var bindInfo = dirs[i++];
			if(!bindInfo) return cb();
			routers.module.add(bindInfo[0], bindInfo[1], nextDir);
		};
		nextDir();
	};

	// get appconfig
	args.unshift(app);
	if(appPath.charAt(0) !== '/') appPath = process.cwd() + '/' + appPath;
	errorCatcher(function(){
		require(path.relative(__dirname, appPath)).apply(fw, args);
	}, function(err){
		console.error('App fatal error.');
		console.log(err.stack);
		app.destroy();
		if(fw.debug) process.exit();
	});
	return app;
};
