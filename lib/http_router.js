// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
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
	// TODO: update route
	if(app.debug) {
		// run with client code in memory
		var clientFiles = app.clientFileCache = {};
		var clientFileHandler = function(file, type){
			var cache = cacheExt(file.slice(file.indexOf('/')+1));
			if(type !== 'removed') {
				preprocessor(app, file, '', function(res){
					clientFiles[cache] = res;
					if(type) console.info('File '+type+': '+file);
				});
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
		var clientFileHandler = function(file, type){
			if(!type) {
				preprocessor(app, file);
			}
		};
	}
	fsListener(app.config.path.script, '.js', clientFileHandler);
	fsListener(app.config.path.tmpl, '.tmpl', clientFileHandler);
	fsListener(app.config.path.style, '.stylus', clientFileHandler);
	fsListener(app.config.path.style, '.css', clientFileHandler);
};

exports.route = function(app, express){
	// init routes
	app.clientRoute = {};
	app.pageRoute = {};
	app.rpcRoute = {};

	// special files
	app.use('/$rc', express.static(app.config.path.rc));
	app.use('/$', express.static(__dirname+'/client'));
	app.use('/', express.static(app.config.path.static));

	// client files
	if(app.debug) {
		app.use('/$client', function(req, res, next){
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
		app.use('/$client', express.static(app.config.path.cache));
	}

	// default routes
	app.get('*', function(req, res){
		if(req.path === '/$routes.js') {
			res.type('text/javascript');
			res.send('fw.routes('+JSON.stringify(app.clientRoute)+')');
		} else if(req.path.slice(0, 2) === '/$') {
			res.send(404, '');
		} else {
			res.sendfile(__dirname+'/client/index.html');
		}
	});

	// dynamic contents
	clientFiles(app);
};
