// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var fsListener = require('./fs_listener.js');

// get all render methods
var renderers = {};
exports.route = function(app, cb){
	// listen files
	fsListener(app.config.path.render, '.js', function(file, type){
		if(type && !fw.debug) return;
		var rendererPath = '/' + file.split(path.sep).slice(1).join('/');
		if(type !== 'removed')
			try {
				delete require.cache[app.cwd+'/'+file];
				renderer[rendererPath] = require(app.cwd+'/'+file);
				if(app.debug && type) console.log('Render File Updated: '+rendererPath);
			} catch(e) {
				delete renderer[rendererPath];
				console.error(e);
			}
		else
			delete renderer[rendererPath];
	}, cb);
};

// render a path
exports.path = function(realPath){
	var r = app.pathRouter(realPath);
	var route = r.route;
	var args = r.args;
	var p = route.render;
	if(p.slice(-3) !== '.js') p += '.js';
	var renderer = renderers[p];
	// TODO
};
