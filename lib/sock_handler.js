// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var EventEmitter = require('events').EventEmitter;

var ipsParser = require('./ips_parser.js');
var errorCatcher = require('./error_catcher.js');

// call res func array
var resCaller = function(app, path, funcs, conn, args, resFunc, errFunc){
	var resFilters = [];
	var res = function(){
		delete res.next;
		var data = [];
		for(var i=0; i<arguments.length; i++)
			data.push(arguments[i]);
		while(resFilters.length) {
			var filter = resFilters.pop()[0];
			if(!filter) continue;
			filter.apply(app, data);
			return;
		}
		resFunc(data);
	};
	res.err = function(){
		delete res.next;
		var data = [];
		for(var i=0; i<arguments.length; i++)
			data.push(arguments[i]);
		while(resFilters.length) {
			var filter = resFilters.pop()[1];
			if(!filter) continue;
			filter.apply(app, data);
			return;
		}
		errFunc(data);
	};
	res.next = function(cb, errCb){
		if(cb || errCb) {
			resFilters.push([cb || null, errCb || null]);
		}
		var func = funcs.shift();
		if(func) func.apply(app, args);
	};
	args.unshift(conn, res);
	errorCatcher(res.next, function(err){
		console.error('An error occurred in RPC "' + path + '".');
		console.error(err.stack || 'Error: ' + err.message);
		if(fw.debug) process.exit();
		else app.restart();
	});
};

// rpc function builder
var connRpc = exports.connRpc = function(app, conn){
	return function(path){
		// parse args
		var args = [];
		for(var i=1; i<arguments.length; i++)
			if(typeof(arguments[i]) === 'function') {
				var doneCb = arguments[i];
				if(typeof(arguments[i+1]) === 'function')
					var errCb = arguments[i+1];
				break;
			} else {
				args.push(arguments[i]);
			}
		// routing
		var funcs = app.serverRoute.rpc(path);
		if(!funcs.length) {
			if(fw.debug) console.error('No RPC function "' + path +'" found.');
			return;
		}
		// call res funcs
		resCaller(app, path, funcs, conn, args, function(arr){
			if(doneCb) doneCb.apply(app, arr);
		}, function(arr){
			if(errCb) errCb.apply(app, arr);
		});
	};
};

// new socket
exports.newSock = function(app, sock, cb){
	// session and auth
	var session = null;
	var host = '';
	var language = '';
	var conns = {};
	var connsCount = 0;

	// clean on close
	sock.on('close', function(){
		if(sockPidCheckObj) clearTimeout(sockPidCheckObj);
		for(var k in conns) {
			conns[k].emit('close');
		};
		conns = null;
	});
	var Conn = function(connId){
		connsCount++;
		if(connsCount > 16) sock.end();
		conns[connId + '~'] = this;
		this.app = app;
		this.session = session;
		this.host = host;
		this.ips = ipsParser(sock.headers['x-forwarded-for']);
		this.ip = sock.remoteAddress;
		this.headers = sock.headers;
		this.language = language;
		this.msg = function(e){
			var data = [];
			for(var i=1; i<arguments.length; i++)
				data.push(arguments[i]);
			send(connId, e, data);
		};
		this.rpc = connRpc(this);
	};
	Conn.prototype = new EventEmitter();
	var connEnd = function(connId){
		conns[connId + '~'].emit('close');
		connsCount--;
		delete conns[connId + '~'];
	};

	// standard send
	var send = function(connId, e, data){
		if(app.startProcessId !== sock.startProcessId) {
			sock.end();
			return;
		}
		if(sock.readyState !== 1) return;
		sock.write(JSON.stringify([connId, e, data]));
	};

	// check process id
	var sockPidCheckObj = null;
	var sockPidCheck = function(){
		sockPidCheckObj = setTimeout(function(){
			if(app.startProcessId !== sock.startProcessId) {
				sockPidCheckObj = null;
				sock.end();
				return;
			}
			sockPidCheck();
		}, fw.config.heartbeat || app.config.server.timeout);
	};

	// auth
	var authObj = setTimeout(function(){
		sock.end();
	}, app.config.server.timeout);
	var auth = function(str){
		clearTimeout(authObj);
		var a = str.split('/');
		if(a.length < 3) {
			sock.end();
			return;
		}
		host = a.shift();
		language = a.shift();
		app.getAuthSession(a.join('/'), function(res){
			if(!res) {
				sock.end();
				return;
			}
			session = res;
			if(sock.readyState !== 1) return;
			send('', 'auth', '');
			sockPidCheck();
		});
	};

	// requests
	sock.on('data', function(json){
		if(app.startProcessId !== sock.startProcessId) {
			sock.end();
			return;
		}
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
				var funcs = app.serverRoute.rpc(method);
				if(!funcs.length) {
					if(fw.debug) console.error('No RPC function "' + method +'" found.');
					return;
				}
				if(!conns[connId + '~']) new Conn(connId);
				var conn = conns[connId + '~'];
				// call res funcs
				resCaller(app, method, funcs, conn, args, function(arr){
					send(connId, '~'+callId, arr);
				}, function(arr){
					send(connId, '!'+callId, arr);
				});
			}, 0);
		} catch(e) {}
	});
};
