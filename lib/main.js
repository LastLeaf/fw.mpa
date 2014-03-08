// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var http = require('http');
var express = require('express');
var connect = require('express/node_modules/connect');
var sockjs = require('sockjs');
var locale = require('locale');
var tmplParser = require('./tmpl_parser.js').parser;

// the fw object
global.fw = null;

// deep extend
var deepExtend = function(dest, src){
	for (var prop in src) {
		if (typeof src[prop] === "object" && src[prop] !== null ) {
			dest[prop] = dest[prop] || {};
			deepExtend(dest[prop], src[prop]);
		} else {
			dest[prop] = src[prop];
		}
	}
	return dest;
};

// a short time string
var nowString = function(){
	var d = new Date();
	var hour = String(d.getHours()+100).slice(1);
	var min = String(d.getMinutes()+100).slice(1);
	var sec = String(d.getSeconds()+100).slice(1);
	var ms = String(d.getMilliseconds()+1000).slice(1);
	return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate() + '_' + hour + ':' + min + ':' + sec + '.' + ms;
};

// main
var main = function(mode){

	// init express
	var app = express();
	var server = http.createServer(app);
	app.use(express.compress());
	app.use(express.cookieParser());

	// read config
	app.restart = function(){
		process.exit(250);
	};
	app.cwd = process.cwd();
	fs.watch('fwconfig.js', app.restart);
	var config = require(app.cwd+'/fwconfig.js');

	// config
	app.config = deepExtend(require('./default/fwconfig.js'), config);
	app.debug = (mode === 'DEBUG');
	app.mode = mode;

	// get the selected language, hacked into locale
	locale.Locale['default'] = '';
	var supportedLocale = new locale.Locales(app.config.app.locale);
	app.use(function(req, res, next){
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

	// conn object builder
	app.use(function(req, res, next){
		if(app.debug) console.log(nowString()+' '+req.method+': '+req.path);
		req.conn = {
			session: req.session,
			host: req.get('Host'),
			language: req.language,
			selectLanguage: req.selectLanguage,
		};
		next();
	});

	// init sockjs
	app.sock = sockjs.createServer({
		heartbeat_delay: app.config.socket.heartbeat,
		websocket: !app.config.server.disableWebsocket,
		log: function(type, msg){
			if(app.debug && type !== 'debug')
				console.log(nowString()+' Socket: '+msg);
		}
	});
	app.sock.installHandlers(server, {prefix:'/~sock'});

	// session handler
	var sessionStore = null;
	var sessionProxy = function(express, options){
		if(!options.store)
			options.store = new express.session.MemoryStore();
		sessionStore = options.store;
		return express.session(options);
	};
	app.getAuthSession = function(auth, cb){
		if(auth.charAt(1) !== ':') {
			cb(null);
			return;
		}
		var str = connect.utils.parseSignedCookie(auth, app.config.secret.cookie);
		sessionStore.get(str, function(error, res){
			if(error || !res) {
				cb(null);
				return;
			}
			var session = new connect.session.Session({
				sessionID: str,
				sessionStore: app.sessionStore
			}, res);
			cb(session);
		});
	};

	// connect db
	var initDb = function(cb){
		if(app.config.db.type === 'mongodb') {
			// using mongodb
			app.db = require('mongoose');
			var mongoSession = require('connect-mongo')(express);
			var dbConnection = app.db.connection;
			app.db.connect(app.config.db.host, app.config.db.name, app.config.db.port, {
				user: app.config.db.user,
				pass: app.config.db.password
			}, function(){
				// use mongodb to store session
				app.use(sessionProxy(express, {
					key: 'fw.sid',
					secret: app.config.secret.cookie,
					cookie: {
						maxAge: app.config.server.sessionLifeTime
					},
					store: new mongoSession({
						collection: 'fw.sessions',
						mongoose_connection: dbConnection
					})
				}));
				// start server
				setTimeout(cb, 0);
			});
			dbConnection.on('error', function(err){
				console.error(err);
			});
		} else {
			// not using db
			app.db = null;
			// use memstore
			app.use(sessionProxy(express, {
				key: 'fw.sid',
				secret: app.config.secret.cookie
			}));
			// start server
			setTimeout(cb, 0);
		}
	};

	// route and listen
	var route = function(){
		require('./http_router.js').route(app, express, function(){
			require('./sock_router.js').route(app, function(){
				server.listen(app.config.server.port);
				if(fw.debug) console.log('Server started.');
			});
		});
	};

	// start server
	var startServer = function(){
		// generate app object for server codes
		fw = app.obj = {
			debug: app.debug,
			config: app.config,
			db: app.db,
			restart: app.restart,
			tmpl: function(file){
				if(!fw.currentLoading) return null;
				file = fw.currentLoading.slice(0, fw.currentLoading.lastIndexOf('/')+1) + file;
				return tmplParser(app, fs.readFileSync(file).toString('utf8'), file);
			},
			module: function(name){
				if(typeof(moduleRes[name]) !== 'undefined')
					return moduleRes[name];
				if(name.slice(-3) !== '.js')
					return moduleRes[name+'.js'];
			}
		};
		// loading server modules
		var moduleRes = {};
		if(fs.existsSync(app.config.path.module)) {
			if(app.debug) fs.watch(app.config.path.module, app.restart);
			var files = fs.readdirSync(app.config.path.module);
			var next = function(){
				if(!files.length) {
					route();
					return;
				}
				var file = files.shift();
				var stat = fs.statSync(app.config.path.module+'/'+file);
				if(stat.isDirectory() || file.slice(-3) === '.js') {
					if(app.debug) console.log('Loading module: ' + file);
					fw.currentLoading = app.config.path.module+'/'+file;
					if(stat.isDirectory()) fw.currentLoading += '/';
					require(app.cwd+'/'+app.config.path.module+'/'+file)(function(obj){
						moduleRes[file] = obj || null;
						next();
					});
					fw.currentLoading = '';
				} else {
					next();
				}
			};
			next();
		} else {
			route();
		}
	};

	initDb(startServer);
};

main(process.env.FW);
