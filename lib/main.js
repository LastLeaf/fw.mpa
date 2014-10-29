// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var http = require('http');

var appCreator = require('./app_creator.js');

// create global fw object
var fw = global.fw = {};

// add fw methods
var fwObjInit = function(){
	// basic properties
	fw.config = JSON.parse(process.env.FW);
	fw.debug = (fw.config.mode === 'debug');
	fw.restart = function(){
		if(fw.mode !== 'debug' && fw.mode !== 'cache' && fw.mode !== 'run') throw('Cannot restart in current running mode (' + fw.mode + ').');
		else process.exit(250);
	};
	// loaders
	fw.currentLoading = null;
	fw.tmpl = function(file){
		if(!fw.currentLoading) return null;
		file = fw.currentLoading.path.slice(0, fw.currentLoading.lastIndexOf('/')+1) + file;
		return fw.currentLoading.app.route.tmpl.generate(fw.currentLoading.type, file);
	};
	fw.module = function(name){
		// TODO module path
		if(typeof(moduleRes[name]) !== 'undefined')
			return moduleRes[name];
		if(name.slice(-3) !== '.js')
			return moduleRes[name+'.js'];
	};
	// app loader
	fw.createApp = function(path){
		var args = [appRouter];
		for(var i=0; i<arguments.length; i++) {
			args.push(arguments[i]);
		}
		var app = appCreator.apply(fw, args);
		return app;
	};
};

// app manager and router
var appRouter = (function(){
	var hostRoute = {};
	var bindHost = function(app, host){
		host = host || '';
		if(hostRoute[host]) hostRoute[host].push(app);
		else hostRoute[host] = [app];
	};
	var unbindHost = function(app, host){
		host = host || '';
		if(!hostRoute[host]) return;
		for(var i=0; i<hostRoute[host].length; i++) {
			if(hostRoute[host][i] === app) {
				hostRoute[host].splice(i, 1);
				i--;
			}
		}
		if(!hostRoute[host].length) delete hostRoute[host];
	};
	var routeReq = function(req){
		var arr = hostRoute[req.headers.host] || hostRoute[''];
		if(arr) return arr[0];
	};
	return {
		bindHost: bindHost,
		unbindHost: unbindHost,
		routeReq: routeReq
	};
})();

// main
var main = function(config){
	fwObjInit();

	// init sockjs
	var sockServer = sockjs.createServer({
		heartbeat_delay: fw.config.heartbeat,
		websocket: !fw.config.websocket,
		log: function(type, msg){
			if(fw.debug && type !== 'debug' && type !== 'info')
				console.log(utils.nowString() + ' Socket ' + type + ': ' + msg);
		}
	});
	sockServer.on('connection', function(sock){
		sock.app = appRouter.routeReq(sock);
		if(sock.app) {
			if(fw.debug) console.log(utils.nowString() + ' Connected: ' + sock.protocol);
			req.app.socket(sock);
		} else {
			sock.end();
		}
	});

	// create node http server
	var ports = fw.config.port;
	if(ports.constructor !== Array) ports = [ports];
	for(var i=0; i<ports.length; i++) {
		var server = http.createServer(function(req, res){
			// express proxy for different host
			req.app = appRouter.routeReq(req);
			if(req.app) {
				req.app.express(req, res);
			} else {
				res.writeHead(503);
				res.end();
			}
		});
		sockServer.installHandlers(server, {prefix: '/~sock'});
		server.listen(ports[i], fw.config.ip);
	}
	console.log('fw.mpa started at port(s) ' + ports.join(', ') + '.');

	// start default apps
	var apps = fw.config.apps;
	if(apps.constructor !== Array) apps = [apps];
	for(var i=0; i<apps.length; i++) {
		fw.createApp(apps[i]);
	}
};

main();
