// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var errorCatcher = require('./error_catcher.js');

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

	// route special page
	var routeSpecialPage = function(app, req, res, path){
		var func = app.serverRoute.page(path);
		errorCatcher(function(){
			func.call(app, req, res);
		}, function(err){
			console.error('An error occurred in page "' + path + '".');
			console.error(err.stack || 'Error: ' + err.message);
			if(fw.debug) process.exit();
			else app.restart();
		});
	};

	// render a path
	return function(req, pageRes, path, depth, cb){
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
			if(route.page) {
				routeSpecialPage(app, req, pageRes, route.page);
				cb();
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
							for(var j=0; j<style.length; j++)
								css.unshift(styleFullpath(route.base, style[j]));
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
