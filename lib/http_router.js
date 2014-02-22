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
			var curPath = path + '/' + file;
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
var clientFiles = function(app, cb){
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
			if(path.basename(file) === 'routes.js') return;
			var cache = cacheExt(file.split(path.sep).slice(1).join('/'));
			if(type !== 'removed') {
				preprocessor(app, file, '', function(res){
					clientFiles[cache] = res;
				});
				if(type) console.log('Client File Updated: '+file);
			} else {
				delete clientFiles[cache];
			}
		};
	} else if(app.mode === 'CACHE') {
		// run with cache
		rmdirp(app.config.path.cache);
		var clientFileHandler = function(file, type){
			if(path.basename(file) === 'routes.js') return;
			var cache = app.config.path.cache + '/' + file.split(path.sep).slice(1).join('/');
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
		var c = 4;
		var finished = function(){
			c--;
			if(!c) cb();
		};
		// listen for changes in debug or cache mode
		fsListener(app.config.path.script, '.js', clientFileHandler, finished);
		fsListener(app.config.path.tmpl, '.tmpl', clientFileHandler, finished);
		fsListener(app.config.path.style, '.stylus', clientFileHandler, finished);
		fsListener(app.config.path.style, '.css', clientFileHandler, finished);
	} else {
		cb();
	}
};

// generate client routes
var clientRoutes = function(app, cb){
	var routes = app.clientRoutes = {};
	// listen for changes
	fsListener(app.config.path.script, 'routes.js', function(file, type){
		if(type !== 'removed') {
			try {
				delete require.cache[app.cwd+'/'+file];
				var basepath = file.split(path.sep).slice(1, -1).join('/');
				if(basepath) basepath += '/';
				routes[basepath] = require(app.cwd+'/'+file);
				if(app.debug && type) console.log('Routes File Updated: '+file);
			} catch(e) {
				delete routes[file];
				console.error(e);
			}
		} else
			delete routes[file];
		if(type) updateRoutesFile(app);
	}, function(){
		updateRoutesFile(app);
		cb();
	});
};

// generate pages routes
var pageRoutes = function(app, cb){
	var routes = app.pageRoutes;
	fsListener(app.config.path.page, '.js', function(file, type){
		var pagePath = '/' + file.split(path.sep).slice(1).join('/').slice(0, -3);
		if(type !== 'removed')
			try {
				delete require.cache[app.cwd+'/'+file];
				routes[pagePath] = require(app.cwd+'/'+file);
				if(app.debug && type) console.log('Page Updated: '+pagePath);
			} catch(e) {
				delete routes[pagePath];
				console.error(e);
			}
		else
			delete routes[pagePath];
		if(type) updateRoutesFile(app);
	}, function(){
		updateRoutesFile(app);
		cb();
	});
};

// cache routes json string
var routesFile = '';
var updateRoutesFile = function(app){
	var a = [];
	for(var k in app.pageRoutes)
		a.push(k);
	routesFile = 'fw._routes(' + JSON.stringify(app.clientRoutes) + ',' + JSON.stringify(a) + ')';
};

exports.route = function(app, express, cb){
	// init routes
	app.clientRoutes = {};
	app.pageRoutes = {};

	// static cache
	var staticCache = function(req, res, next){
		if(!app.debug && req.query.v) {
			if(req.query.v !== app.config.app.version) {
				res.send(481, 'Version Not Match');
				return;
			} else {
				res.set('Cache-Control', 'public, max-age=31536000');
			}
		}
		next();
	};
	app.use('/~rc', staticCache);
	app.use('/~fw', staticCache);
	app.use('/~', staticCache);

	// prevent cache
	var preventCache = function(req, res, next){
		res.set('Cache-Control', 'no-cache, no-store');
		next();
	};
	app.use('/~conf', preventCache);

	// special files
	app.use('/~rc', express.static(app.config.path.rc));
	app.use('/~fw', express.static(__dirname+'/client'));
	app.use('/', express.static(app.config.path.static));

	// client files
	if(app.debug) {
		app.use('/~', function(req, res, next){
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
		app.use('/~', express.static(app.config.path.cache));
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
			timeout: app.config.server.timeout,
			title: app.config.app.title,
			styles: '',
			content: ''
		});
	};

	// webapp page generator
	var webappFile = __dirname+'/default/webapp.html';
	if(fs.existsSync(app.config.path.rc+'/webapp.html'))
		webappFile = app.config.path.rc+'/webapp.html';
	var webappPage = (handlebars.compile(fs.readFileSync(webappFile).toString('utf8')))({
		debug: app.debug || 0,
		version: app.config.app.version,
		timeout: app.config.server.timeout
	});

	// default routes
	app.get('*', function(req, res, cb){
		if(req.path === '/~rc/routes.js') {
			// routes file
			res.type('text/javascript');
			res.send(routesFile);
		} else if(req.path === '/~conf/sock.js') {
			// routes file
			res.type('text/javascript');
			if(!app.debug && req.query.v && req.query.v !== app.config.app.version) {
				res.send('fw.onupgradeneeded(app.config.app.version)');
				return;
			}
			res.send('fw._sockConfig('+JSON.stringify({
				url: '/~sock',
				auth: req.sessionID
			})+')');
		} else if(req.path === '/~webapp') {
			// webapp start file
			res.type('text/html');
			res.send(webappPage);
		} else if(req.path.slice(0, 2) === '/~') {
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
	var c = 3;
	var finished = function(){
		c--;
		if(!c) cb();
	};
	clientFiles(app, finished);
	clientRoutes(app, finished);
	pageRoutes(app, finished);
};
