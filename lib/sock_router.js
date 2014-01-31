// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var connect = require('express/node_modules/connect');
var SafeMap = require('./safe_map.js');
var EventEmitter = require('events').EventEmitter;

// session handler
var sessionStore = null;
var sessionSecret = '';
exports.session = function(express, options){
	if(!options.store)
		options.store = new express.session.MemoryStore();
	sessionStore = options.store;
	sessionSecret = options.secret;
	return express.session(options);
};

// generate pages routes
var pageRoutes = function(app){
	var routes = app.rpcRoutes;
	fsListener(app.config.path.rpc, '.js', function(file, type){
		var path = file.slice(file.indexOf('/'), -3);
		if(type !== 'removed')
			try {
				routes[path] = require(app.config.server.cwd+'/'+file);
				if(app.debug && type) console.log('RPC File Updated: '+path);
			} catch(e) {
				delete routes[path];
				console.error(e);
			}
		else
			delete routes[path];
	});
};

// router
exports.route = function(sock){
	// router
	var server = app.sock;
	var routes = app.rpcRoutes = {};
	pageRoutes(app);

	// connection management
	server.on('connection', function(sock){

		// session and auth
		var session = null;
		var conns = SafeMap();
		var req = {};

		// clean on close
		sock.on('close', function(){
			for(var k in conns)
				conns[k] = conn.trigger('close');
		});
		var Conn = function(){};
		Conn.prototype = new EventEmitter();

		// standard send
		var sendRaw = function(str){
			if(sock.readyState !== 1) return;
			sock.write(str);
		};
		var send = function(connId, e, data){
			if(sock.readyState !== 1) return;
			sock.write(JSON.stringify([connId, e, data]));
		};

		// auth
		var authObj = setTimeout(function(){
			sock.end();
		}, app.config.server.timeout);
		var auth = function(str){
			clearTimeout(authObj);
			str = connect.utils.parseSignedCookie(str, sessionSecret);
			sessionStore.get(str, function(error, res){
				if(error || !res) {
					sock.end();
					return;
				}
				session = new connect.session.Session({
					sessionID: str,
					sessionStore: sessionStore
				}, res);
				req = {
					session: session
				};
				if(sock.readyState !== 1) return;
				sock.write(JSON.stringify([0, 'auth']));
			});
		};

		// requests
		sock.on('data', function(json){
			if(session === null) {
				auth(json);
				return;
			}
			try {
				var data = JSON.parse(json);
				setTimeout(function(){
					if(data.length < 3 || data.length > 4) return;
					var connId = data[0];
					var callId = data[1];
					var method = data[2];
					var data = data[3];
					// create connId
					// TODO
					// routing
					if(typeof(method) !== 'string') return;
					var method = method.split(':');
					if(method.length > 1) {
						if(!routes.hasOwnProperty(method[0])) return;
						var func = routes[method[0]][method[1]];
						if(typeof(func) !== 'function') return;
					} else {
						if(!routes.hasOwnProperty(method[0])) return;
						var func = routes[method[0]];
						if(typeof(func) !== 'function') return;
					}
					var res = {
						send: function(data){
							send(connId, callId, data);
						},
						msg: function(e, data){
							send(connId, e, data);
						}
					};
					func(req, res, data);
				}, 0);
			} catch(e) {}
		});
	});
};
