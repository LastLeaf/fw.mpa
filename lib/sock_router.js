// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var connect = require('express/node_modules/connect');
var EventEmitter = require('events').EventEmitter;
var SafeMap = require('./safe_map.js');
var fsListener = require('./fs_listener.js');

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
var routes = {};
var rpcRoutes = function(app, cb){
	// listen files
	fsListener(app.config.path.rpc, '.js', function(file, type){
		var path = file.slice(file.indexOf('/'), -3);
		if(type !== 'removed')
			try {
				delete require.cache[app.cwd+'/'+file];
				routes[path] = require(app.cwd+'/'+file);
				if(app.debug && type) console.log('RPC File Updated: '+path);
			} catch(e) {
				delete routes[path];
				console.error(e);
			}
		else
			delete routes[path];
	}, cb);
	// server side rpc request
	app.obj.rpc = function(session, path, args, cb){
		var func = routeMethod(path);
		if(!func) return;
		if(!cb) cb = function(){};
		func({session: session}, args, cb);
	};
};

// route a method string
var routeMethod = function(str){
	var method = str.split(':');
	if(method.length > 1) {
		if(!routes.hasOwnProperty(method[0])) return null;
		var func = routes[method[0]][method[1]];
		if(typeof(func) !== 'function') return null;
	} else {
		if(!routes.hasOwnProperty(method[0])) return null;
		var func = routes[method[0]];
		if(typeof(func) !== 'function') return null;
	}
	return func;
};

// router
exports.route = function(app, cb){
	// router
	var server = app.sock;
	app.rpcRoutes = routes;

	// connection management
	server.on('connection', function(sock){

		// session and auth
		var session = null;
		var conns = SafeMap();

		// clean on close
		sock.on('close', function(){
			conns.each(function(k, v){
				v.emit('close');
			});
			conns = null;
		});
		var Conn = function(connId){
			conns.set(connId, this);
			this.session = session;
			this.connId = connId;
		};
		Conn.prototype = new EventEmitter();
		Conn.prototype.msg = function(e, data){
			send(this.connId, e, data);			
		};
		var connEnd = function(connId){
			conns.del(connId);
		};

		// standard send
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
				if(sock.readyState !== 1) return;
				send('', 'auth', '');
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
				if(!data[0]) {
					// control message
					if(data[1] === 'end') connEnd(data[2]);
					return;
				}
				setTimeout(function(){
					if(data.length < 3 || data.length > 4) return;
					var connId = data[0];
					var callId = data[1];
					var method = data[2];
					var args = data[3];
					// routing
					if(typeof(method) !== 'string') return;
					var func = routeMethod(method);
					if(!func) return;
					if(!conns.has(connId)) new Conn(connId);
					func(conns.get(connId), args, function(data){
						send(connId, '~'+callId, data);
					});
				}, 0);
			} catch(e) {}
		});
	});

	// start
	rpcRoutes(app, cb);
};
