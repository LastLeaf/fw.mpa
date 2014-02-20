// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var http = require('http');
var express = require('express');
var sockjs = require('sockjs');

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
		process.exit(51);
	};
	app.cwd = process.cwd();
	fs.watch('config.js', app.restart);
	var config = require(app.cwd+'/config.js');

	// basic middleware
	app.use(function(req, res, next){
		if(app.debug) console.log(nowString()+' '+req.method+': '+req.path);
		req.config = app.config;
		req.db = app.db;
		next();
	});

	// config
	app.config = deepExtend(require('./default/config.js'), config);
	app.debug = (mode === 'DEBUG');
	app.mode = mode;

	// init sockjs
	app.sock = sockjs.createServer({
		heartbeat_delay: app.config.socket.heartbeat,
		websocket: !app.config.server.disableWebsocket,
		log: function(type, msg){
			if(app.debug)
				console.log(nowString()+' Socket: '+msg);
		}
	});
	app.sock.installHandlers(server, {prefix:'/~sock'});
	var sockRouter = require('./sock_router.js');

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
				app.use(sockRouter.session(express, {
					key: 'fw',
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
			app.use(sockRouter.session(express, {
				key: 'fw',
				secret: app.config.secret.cookie
			}));
			// start server
			setTimeout(cb, 0);
		}
	};

	// route and listen
	var route = function(){
		var httpRouter = require('./http_router.js');
		httpRouter.route(app, express, function(){
			sockRouter.route(app, function(){
				server.listen(app.config.server.port);
				console.log('Server started.');
			});
		});
	};

	// start server
	var startServer = function(){
		// generate app object for server codes
		app.module = {};
		fw = app.obj = {
			debug: app.debug,
			config: app.config,
			db: app.db,
			module: app.module
		};
		// loading server modules
		if(fs.existsSync(app.config.path.module)) {
			fs.watch(app.config.path.module, app.restart);
			var files = fs.readdirSync(app.config.path.module);
			var next = function(){
				if(!files.length) {
					route();
					return;
				}
				var file = files.shift();
				if(fs.statSync(app.config.path.module+'/'+file).isDirectory() || file.slice(-3) === '.js') {
					if(app.debug) console.log('Loading "'+file+'" module...');
					require(app.cwd+'/'+app.config.path.module+'/'+file)(next);
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