// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var http = require('http');
var express = require('express');
var sockjs = require('sockjs');

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
	return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate() + '_' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
};

// main
module.exports = function(config){

	// init express
	var app = express();
	var server = http.createServer(app);
	app.use(express.compress());
	app.use(express.cookieParser());

	// basic middleware
	app.use(function(req, res, next){
		if(app.debug) console.log(nowString()+' '+req.method+': '+req.path);
		req.config = app.config;
		req.db = app.db;
		next();
	});

	// config
	app.config = deepExtend(require('./default/config.js'), config);
	app.debug = Number(process.env.DEBUG);
	var cwd = app.config.server.cwd;
	process.chdir(cwd);

	// init sockjs
	app.io = sockjs.createServer({
		heartbeat_delay: app.config.socket.heartbeat,
		websocket: !app.config.server.disableWebsocket,
		log: function(type, msg){
			if(app.debug)
				console.log(nowString()+' Socket: '+msg);
		}
	});
	app.io.installHandlers(server, {prefix:'/$socket'});
	var ioRouter = require('./io_router.js');

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
				app.use(ioRouter.session(express, {
					secret: app.config.secret.cookie,
					store: new mongoSession({
						collection: 'sessions',
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
			app.use(ioRouter.session(express, {
				secret: app.config.secret.cookie
			}));
			// start server
			setTimeout(cb, 0);
		}
	};

	// start server
	var startServer = function(){
		// route and start
		var httpRouter = require('./http_router.js');
		httpRouter.route(app, express);
		//ioRouter.route(app.io);
		server.listen(app.config.server.port);
	};

	initDb(startServer);
};