// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var handlebars = require('handlebars');
var fsListener = require('./fs_listener.js');
var preprocessor = require('./preprocessor.js');

// rmdirp
var rmdirp = function(path) {
	var files = [];
	if(fs.existsSync(path)) {
		files = fs.readdirSync(path);
		files.forEach(function(file,index){
			var curPath = path + "/" + file;
			if(fs.statSync(curPath).isDirectory()) {
				rmdirp(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

// preprocess client files
var clientFiles = function(app){
	var cacheExt = function(cache){
		if(path.extname(cache) === '.stylus')
			cache += '.css';
		else if(path.extname(cache) === '.tmpl')
			cache += '.js';
		return cache;
	};
	if(app.debug) {
		// run with client code in memory
		var clientFiles = app.clientFileCache = {};
		var clientFileHandler = function(file, type){
			var cache = cacheExt(file.slice(file.indexOf('/')+1));
			if(type !== 'removed') {
				preprocessor(app, file, '', function(res){
					clientFiles[cache] = res;
				});
				if(type) console.log('Client File Updated: '+file);
			} else {
				delete clientFiles[cache];
			}
		};
	} else if(Number(process.env.CACHE)) {
		// run with cache
		rmdirp(app.config.path.cache);
		var clientFileHandler = function(file, type){
			var cache = app.config.path.cache+'/'+file.slice(file.indexOf('/')+1);
			cache = cacheExt(cache);
			if(type !== 'removed') {
				mkdirp(path.dirname(cache));
				preprocessor(app, file, cache);
			} else {
				fs.unlinkSync(cache);
			}
		};
	} else {
		// run with previous cached code
		var clientFileHandler = null;
	}
	if(clientFileHandler) {
		// listen for changes in debug or cache mode
		fsListener(app.config.path.script, '.js', clientFileHandler);
		fsListener(app.config.path.tmpl, '.tmpl', clientFileHandler);
		fsListener(app.config.path.style, '.stylus', clientFileHandler);
		fsListener(app.config.path.style, '.css', clientFileHandler);
	}
};

// generate client routes
var clientRoutes = function(app){
	var routes = {};
	// concat all routes into a route
	var updateRoutes = function(){
		var route = {};
		for(var k in routes) {
			var file = routes[k];
			for(var id in file)
				route[id] = file[id];
		}
		app.clientRoutes = route;
		updateRoutesFile(app);
	};
	// listen for changes
	fsListener(app.config.path.script, '.routes', function(file, type){
		if(type !== 'removed') {
			try {
				var r = routes[file] = JSON.parse(fs.readFileSync(file).toString('utf8'));
				var basepath = file.slice(file.indexOf('/')+1, file.lastIndexOf('/')+1);
				for(var k in r)
					r[k].base = basepath;
				if(app.debug && type) console.log('Routes File Updated: '+file);
			} catch(e) {
				delete routes[file];
				console.error(e);
			}
		} else
			delete routes[file];
		updateRoutes();
	});
};

// generate pages routes
var pageRoutes = function(app){
	var routes = app.pageRoutes;
	fsListener(app.config.path.page, '.js', function(file, type){
		var path = file.slice(file.indexOf('/'), -3);
		if(type !== 'removed')
			try {
				routes[path] = require(app.config.server.cwd+'/'+file);
				if(app.debug && type) console.log('Page Updated: '+path);
			} catch(e) {
				delete routes[path];
				console.error(e);
			}
		else
			delete routes[path];
		updateRoutesFile(app);
	});
};

// cache routes json string
var routesFile = '';
var updateRoutesFile = function(app){
	var a = [];
	for(var k in app.pageRoutes)
		a.push(k);
	routesFile = 'fw.routes(' + JSON.stringify({
		client: app.clientRoutes,
		page: a
	}) + ')';
};

exports.route = function(app, express){
	// init routes
	app.clientRoutes = {};
	app.pageRoutes = {};

	// static cache
	var staticCache = function(req, res, next){
		// TODO confirm
		//if(!app.debug && req.query.v)
		//	res.set('Cache-Control', 'public, max-age=31536000');
		next();
	};
	app.use('/$rc', staticCache);
	app.use('/$fw', staticCache);
	app.use('/$', staticCache);

	// special files
	app.use('/$rc', express.static(app.config.path.rc));
	app.use('/$fw', express.static(__dirname+'/client'));
	app.use('/', express.static(app.config.path.static));

	// client files
	if(app.debug) {
		app.use('/$', function(req, res, next){
			var file = req.path.slice(1);
			if(typeof(app.clientFileCache[file]) === 'undefined') {
				res.send(404, '');
				return;
			}
			var ext = path.extname(file);
			if(ext === '.js') res.type('text/javascript');
			else if(ext === '.css') res.type('text/css');
			res.send(app.clientFileCache[file]);
		});
	} else {
		app.use('/$', express.static(app.config.path.cache));
	}

	// index page generator
	var indexFile = __dirname+'/default/index.html';
	if(fs.existsSync(app.config.path.rc+'/index.html'))
		indexFile = app.config.path.rc+'/index.html';
	var index = handlebars.compile(fs.readFileSync(indexFile).toString('utf8'));
	var indexPage = function(path){
		return index({
			debug: app.debug || 0,
			version: app.config.app.version,
			title: app.config.app.title,
			styles: '',
			content: ''
		});
	};

	// default routes
	app.get('*', function(req, res, cb){
		if(req.path === '/$rc/routes.js') {
			// routes file
			res.type('text/javascript');
			res.send(routesFile);
		} else if(req.path.slice(0, 2) === '/$') {
			// prevent protected path
			res.send(404, '');
		} else if(app.pageRoutes[req.path]) {
			// special page
			app.pageRoutes[req.path](req, res, cb);
		} else {
			// default file
			res.type('text/html');
			res.send(indexPage(req.path));
		}
	});

	// dynamic contents
	clientFiles(app);
	clientRoutes(app);
	pageRoutes(app);
};
