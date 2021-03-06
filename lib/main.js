// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var sockjs = require('sockjs');

var appCreator = require('./app_creator.js');
var utils = require('./utils');

// create global fw object
var fw = global.fw = {};

// add fw methods
var fwObjInit = function(){
	// basic properties
	fw.fwVersion = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString('utf8')).version;
	fw.config = JSON.parse(process.env.FW);
	fw.mode = fw.config.mode || fw.config.defaultMode;
	fw.debug = (fw.mode === 'debug');
	fw.restart = function(){
		if(fw.mode === 'process') throw('Cannot restart in current running mode (' + fw.mode + ').');
		else process.exit(250);
	};
	// loaders
	fw.currentLoading = null;
	fw.tmpl = function(file){
		if(!fw.currentLoading) throw(new Error('Cannot load tmpl files out of require procedure.'));
		if(fw.currentLoading.type === 'module') throw(new Error('Cannot load tmpl files from server modules.'));
		file = fw.currentLoading.visitPath.slice(0, fw.currentLoading.visitPath.lastIndexOf('/')+1) + file;
		return fw.currentLoading.app.serverRoute.tmpl.generate(fw.currentLoading.type, path.normalize(file));
	};
	fw.module = function(file){
		if(!fw.currentLoading) throw(new Error('Cannot load modules out of require procedure.'));
		var app = fw.currentLoading.app;
		if(file.charAt(0) !== '/')
			file = fw.currentLoading.prefix + '/' + file;
		var mod = app.loadedModules[file];
		if(typeof(mod) === 'undefined') mod = app.loadedModules[file + '.js'];
		if(typeof(mod) === 'undefined') throw(new Error('No loaded module "' + file + '".'));
		return mod;
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
		websocket: fw.config.websocket,
		log: function(type, msg){
			if(fw.debug && type !== 'debug' && type !== 'info')
				console.log(utils.nowString() + ' Socket ' + type + ': ' + msg);
		}
	});
	sockServer.on('connection', function(sock){
		sock.app = appRouter.routeReq(sock);
		if(sock.app) {
			if(fw.debug) console.log(utils.nowString() + ' Connected: ' + sock.protocol);
			sock.app = appRouter.routeReq(sock);
			sock.app.socket(sock);
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
	console.log('fw.mpa started at port(s) ' + ports.join(', ') + ', running in "' + fw.mode + '" mode.');

	// start default apps
	var apps = fw.config.app;
	if(apps.constructor !== Array) apps = [apps];
	for(var i=0; i<apps.length; i++) {
		fw.createApp(apps[i]);
	}
};

main();
