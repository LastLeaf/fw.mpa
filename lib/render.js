// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var fsListener = require('./fs_listener.js');

// get all render methods
var renderers = {};
exports.init = function(app, cb){
	// listen files
	fsListener(app.config.path.render, '.js', function(file, type){
		if(type && !fw.debug) return;
		var rendererPath = '/' + file.split(path.sep).slice(1).join('/');
		if(type !== 'removed') {
			try {
				delete require.cache[app.cwd+'/'+file];
				fw.currentLoading = app.config.path.render + rendererPath;
				renderers[rendererPath] = require(app.cwd+'/'+file);
				if(app.debug && type) console.log('Renderer Updated: '+rendererPath);
			} catch(e) {
				delete renderers[rendererPath];
				console.error(e);
			}
			fw.currentLoading = '';
		} else
			delete renderers[rendererPath];
	}, cb);
};

// convert to full path
var styleFullpath = function(base, file){
	if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
		if(file.slice(-4) !== '.css') {
			if(file.slice(-7) !== '.stylus') file += '.stylus.css';
			else file += '.css';
		}
		if(file.charAt(0) === '/') {
			file = '/~' + file;
		} else {
			file = '/~/' + base + file;
		}
	}
	return file;
};

// render a path
exports.path = function(app, realPath, depth, cb){
	var css = [];
	var res = {
		title: '',
		content: ''
	};
	var r = app.pathParser(app.routeTree, realPath);
	if(!r) {
		cb(css, res);
		return;
	}
	if(depth) {
		var needCss = false;
	} else {
		var needCss = true;
		depth = -1;
	}
	var route = r.route;
	var args = r.args;
	var next = function(){
		if(!route || !depth) {
			cb(css, res);
			return;
		}
		depth--;
		// add css
		if(needCss && route.style) {
			if(typeof(route.style) !== 'object') var styles = [route.style];
			else var styles = route.style;
			for(var i=styles.length-1; i>=0; i--)
				css.unshift(styleFullpath(route.base, styles[i]));
		}
		// render
		var cont = function(){
			route = app.routeTree.client[route.parent];
			next();
		};
		var p = route.render;
		if(!p) {
			cont();
			return;
		}
		if(p.slice(-3) !== '.js') p += '.js';
		if(p.charAt(0) !== '/') p = '/' + route.base + p;
		var renderer = renderers[p];
		if(!renderer) {
			cont();
			return;
		}
		renderer(args, res, function(r){
			res = r;
			cont();
		});
	}
	next();
};
