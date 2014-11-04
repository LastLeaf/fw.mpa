// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');

module.exports = function(app){

	// convert to full path
	var styleFullpath = function(base, file){
		if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
			if(file.charAt(0) === '/') {
				file = '/~client' + file;
			} else {
				file = '/~client/' + base + file;
			}
			file += '.css';
		}
		return file;
	};

	// render a path
	return function(req, path, depth, cb){
		var css = [];
		var res = {
			statusCode: 200,
			extraHead: '',
			title: '',
			content: ''
		};
		var r = app.clientRoute(path);
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
		var startCss = false;
		var next = function(){
			if(!route || !depth) {
				cb(css, res);
				return;
			}
			depth--;
			// render
			var cont = function(){
				// add css
				if(startCss && route.style) {
					if(route.style.constructor !== Array) var styles = [route.style];
					else var styles = route.style;
					for(var i=styles.length-1; i>=0; i--) {
						if(typeof(styles[i]) !== 'object') {
							css.unshift(styleFullpath(route.base, styles[i]));
						} else {
							var style = styles[i].src || [];
							while(style.length)
								css.unshift(styleFullpath(route.base, style.pop()));
						}
					}
				}
				route = app.clientRouteDetail(route.parent);
				next();
			};
			var p = route.render;
			if(!p) {
				cont();
				return;
			}
			var renderer = app.serverRoute.render(p);
			if(!renderer) {
				cont();
				return;
			}
			renderer(req.conn, args, res, function(r){
				res = r;
				if(needCss) startCss = true;
				cont();
			});
		}
		next();
	};

};
