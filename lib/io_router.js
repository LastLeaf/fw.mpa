// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var connect = require('express/node_modules/connect');
var SafeMap = require('./safe_map.js');

var AUTH_TIMEOUT = 20000;

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

// rpc files
var rpcRoute = function(app, dir){
	var routeFile = function(filename){
		var obj = filename;
		if(filename.slice(-3) === '.js')
			obj = filename.slice(0, -3);
		app.io.route(obj, require(dir+'/'+filename).getMethods(app));
	};
	var files = fs.readdirSync(dir);
	for(var i=0; i<files.length; i++)
		if(files[i].slice(-3) === '.js')
			routeFile(files[i]);
};

// router
exports.route = function(io){
	io.authString = SafeMap();
	var rooms = SafeMap();

	// router
	var router = io.router = {};
	io.route = function(name, obj){
		if(typeof(obj) === 'function')
			router[name] = obj;
		else {
			for(var k in obj) {
				router[name+'.'+k] = obj[k];
			}
		}
	}

	// connection management
	io.on('connection', function(conn){

		// session and auth
		var session = null;
		var connectionObj = null;
		var subConnection = null;

		// auth
		var authObj = setTimeout(function(){
			conn.end();
		}, AUTH_TIMEOUT);
		var auth = function(str){
			clearTimeout(authObj);
			str = connect.utils.parseSignedCookie(str, sessionSecret);
			sessionStore.get(str, function(error, res){
				if(error || !res) {
					conn.end();
					return;
				}
				session = new connect.session.Session({
					sessionID: str,
					sessionStore: sessionStore
				}, res);
				if(conn.readyState !== 1) return;
				resetSub();
				conn.write(JSON.stringify([0, '']));
			});
		};

		// standard send
		var sendRaw = function(str){
			if(conn.readyState !== 1) return;
			conn.write(str);
		};
		var send = function(ev, data){
			if(conn.readyState !== 1) return;
			conn.write(JSON.stringify([ev, data]));
		};

		// sub connection management
		var subCloseFuncs = [];
		var resetSub = function(){
			var f = subCloseFuncs;
			subCloseFuncs = [];
			subConnection = {
				send: send,
				sendRaw: sendRaw,
				onClose: function(func){
					subCloseFuncs.push(func);
				}
			};
			for(var i=0; i<f.length; i++)
				f[i]();
		};
		conn.on('close', function(){
			var f = subCloseFuncs;
			for(var i=0; i<f.length; i++)
				f[i]();
		});
		connectionObj = {
			send: send,
			sendRaw: sendRaw,
			onClose: function(func){
				conn.on('close', func);
			}
		};

		// req methods
		var Req = function(msgId){
			var respond = function(data){
				if(conn.readyState !== 1) return;
				conn.write(JSON.stringify([msgId, data]));
			};
			return {
				respond: respond,
				session: session,
				connection: connectionObj,
				subConnection: subConnection
			};
		};

		// requests
		conn.on('data', function(json){
			if(session === null) {
				auth(json);
				return;
			}
			try {
				var data = JSON.parse(json);
				setTimeout(function(){
					if(data.length < 2 || data.length > 3) return;
					var msgId = data[0];
					var method = data[1];
					var args = data[2];
					if(msgId === 0) {
						// reset connection
						resetSub();
					} else if(router.hasOwnProperty(method)) {
						// rpc call
						router[method](Req(msgId), args);
					}
				}, 0);
			} catch(e) {}
		});
	});
};
