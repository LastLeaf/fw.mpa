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
	app.startProcessId = 0;

	// start/stop
	var startEventFuncs = [];
	var stopEventFuncs = [];
	var callSsEventFuncs = function(type, success){
		if(type === 'start') {
			var arr = startEventFuncs;
			startEventFuncs = [];
		} else {
			var arr = stopEventFuncs;
			stopEventFuncs = [];
		}
		errorCatcher(function(){
			while(arr.length) arr.shift().call(app, success);
		}, function(err){
			console.error(err.stack || 'Error: ' + err.message);
			if(fw.debug) process.exit();
		});
	};
	app.readyState = 'stopped';
	app.start = function(cb){
		if(!cb) cb = function(){};
		// check status
		if(app.destroyed || app.readyState === 'started') {
			setTimeout(function(){
				cb(app.enabled);
			}, 0);
			return;
		}
		// prevent multi start
		startEventFuncs.push(cb);
		if(app.readyState !== 'stopped' && app.readyState !== 'aborted') return;
		app.readyState = 'building';
		// start in domain
		console.log('Starting app: ' + app.config.app.title);
		errorCatcher(function(){
			buildClientDirRoutes();
			cacheUpdate(routers.client.list(), function(){
				if(stopEventFuncs.length) {
					app.readyState = 'aborted';
					callSsEventFuncs('start', false);
					app.stop();
					return;
				}
				if(fw.debug) console.log('Generating routes...');
				clientRouter.update(routers.page.list(), function(){
					if(stopEventFuncs.length) {
						app.readyState = 'aborted';
						callSsEventFuncs('start', false);
						app.stop();
						return;
					}
					httpRouterStart(function(){
						if(stopEventFuncs.length) {
							app.readyState = 'aborted';
							callSsEventFuncs('start', false);
							app.stop();
							return;
						}
						app.readyState = 'starting';
						if(fw.debug) console.log('Connecting to database: ' + app.config.db.type);
						initDb(function(){
							if(app.readyState !== 'starting') (closeDb || closeDbDefault)(function(){
								app.readyState = 'aborted';
								return;
							});
							buildModuleRoutes(function(){
								if(app.readyState !== 'starting') (closeDb || closeDbDefault)(function(){
									app.readyState = 'aborted';
									return;
								});
								buildServerDirRoutes(function(){
									if(app.readyState !== 'starting') (closeDb || closeDbDefault)(function(){
										app.readyState = 'aborted';
										return;
									});
									for(var i=0; i<app.config.app.host.length; i++) {
										appRouter.bindHost(app, app.config.app.host[i]);
									}
									app.enabled = true;
									app.readyState = 'started';
									app.startProcessId = new Date().getTime() + Math.random();
									console.log('App started: ' + app.config.app.title);
									callSsEventFuncs('start', true);
								});
							});
						});
					});
				});
			});
		}, function(err){
			app.readyState = 'aborted';
			console.error('Starting app failed.');
			console.error(err.stack || 'Error: ' + err.message);
			if(fw.debug) process.exit();
		});
	};
	app.stop = function(cb){
		if(!cb) cb = function(){};
		// check status
		if(app.destroyed || app.readyState === 'stopped') {
			setTimeout(cb, 0);
			return;
		}
		// prevent multi stop
		stopEventFuncs.push(cb);
		if(app.readyState !== 'started' && app.readyState !== 'aborted' && app.readyState !== 'starting') return;
		app.readyState = 'stopping';
		callSsEventFuncs('start', false);
		var stopped = function(){
			console.log('App stopped: ' + app.config.app.title);
			app.readyState = 'stopped';
			callSsEventFuncs('stop');
			if(startEventFuncs.length) app.start();
		};
		if(app.enabled) {
			app.enabled = false;
			app.startProcessId = 0;
			for(var k in routers) {
				routers[k].clear();
			}
			for(var i=0; i<app.config.app.host.length; i++) {
				appRouter.unbindHost(app, app.config.app.host[i]);
			}
			(closeDb || closeDbDefault)(stopped);
		} else {
			setTimeout(stopped, 0);
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
			app.readyState = 'destroyed';
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
		console.error(err.stack || 'Error: ' + err.message);
		app.destroy();
		if(fw.debug) process.exit();
	});
	return app;
};
