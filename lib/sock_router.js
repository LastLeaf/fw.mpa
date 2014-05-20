// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var EventEmitter = require('events').EventEmitter;
var SafeMap = require('./safe_map.js');
var fsListener = require('./fs_listener.js');

// generate pages routes
var routes = {};
var rpcRoutes = function(app, cb){
	// listen files
	fsListener(app.config.path.rpc, {
		'.js': function(file, type){
			if(type && !fw.debug) return;
			var rpcPath = '/' + file.split(path.sep).slice(1).join('/').slice(0, -3);
			if(type !== 'removed') {
				try {
					delete require.cache[app.cwd+'/'+file];
					fw.currentLoading = app.config.path.rpc + rpcPath + '.js';
					routes[rpcPath] = require(app.cwd+'/'+file);
					if(app.debug && type) console.log('RPC File Updated: '+rpcPath);
				} catch(e) {
					delete routes[rpcPath];
					console.trace(e);
				}
				fw.currentLoading = '';
			} else
				delete routes[rpcPath];
		},
		'.tmpl': function(file, type){
			if(!type || !fw.debug) return;
			app.restart();
		},
		'.locale/': function(file, type){
			if(!type || !fw.debug) return;
			app.restart();
		}
	}, cb);
};

// route a method string
var routeMethod = function(str){
	var method = str.split(':');
	var res = [];
	// route file
	if(!routes.hasOwnProperty(method[0])) return res;
	var func = routes[method[0]];
	if(typeof(func) === 'function')
		res.push(func);
	// route methods
	if(method.length > 1) {
		var path = method[1].split('.');
		var cur = routes[method[0]];
		while(path.length) {
			if(!cur.hasOwnProperty(path[0]))
				break;
			func = cur[path.shift()];
			if(typeof(func) === 'function')
				res.push(func);
			cur = func;
		}
	}
	return res;
};

// router
exports.route = function(app, cb){
	// router
	var server = app.sock;
	app.rpcRoutes = routes;
	app.routeMethod = routeMethod;

	// connection management
	server.on('connection', function(sock){

		// session and auth
		var session = null;
		var host = '';
		var conns = SafeMap();
		var connsCount = 0;

		// clean on close
		sock.on('close', function(){
			conns.each(function(k, v){
				v.emit('close');
			});
			conns = null;
		});
		var Conn = function(connId){
			connsCount++;
			if(connsCount > 16) sock.end();
			conns.set(connId, this);
			this.session = session;
			this.host = host;
			this.msg = function(e){
				var data = [];
				for(var i=1; i<arguments.length; i++)
					data.push(arguments[i]);
				send(connId, e, data);
			};
			this.rpc = app.connRpc(this);
		};
		Conn.prototype = new EventEmitter();
		var connEnd = function(connId){
			conns.get(connId).emit('close');
			connsCount--;
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
			var a = str.split('/');
			if(a.length < 2) {
				sock.end();
				return;
			}
			host = a.shift();
			app.getAuthSession(a.join('/'), function(res){
				if(!res) {
					sock.end();
					return;
				}
				session = res;
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
				if(typeof(data) !== 'object') return;
				if(!data[0]) {
					// control message
					if(data[1] === 'end') connEnd(data[2]);
					return;
				}
				setTimeout(function(){
					var connId = String(data[0]);
					var callId = String(data[1]);
					var method = String(data[2]);
					var args = data[3];
					if(typeof(args) !== 'object' || typeof(args.unshift) !== 'function')
						return;
					// routing
					var funcs = routeMethod(method);
					if(!funcs.length) return;
					if(!conns.has(connId)) new Conn(connId);
					// res object
					var res = function(){
						var data = [];
						for(var i=0; i<arguments.length; i++)
							data.push(arguments[i]);
						send(connId, '~'+callId, data);
					};
					res.err = function(){
						var data = [];
						for(var i=0; i<arguments.length; i++)
							data.push(arguments[i]);
						send(connId, '!'+callId, data);
					};
					res.next = function(){
						var func = funcs.shift();
						if(func) func.apply(args[0], args);
					};
					args.unshift(conns.get(connId), res);
					res.next();
				}, 0);
			} catch(e) {}
		});
	});

	// start
	rpcRoutes(app, cb);
};
