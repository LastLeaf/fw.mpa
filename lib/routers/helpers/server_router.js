// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fsListener = require('./fs_listener.js');
var loadScript = require('../../load_script.js');

module.exports = function(app, dirType, prefix, dir, routeFunc, cb){
	var routes = {};
	var tmplManager = app.serverRoute.tmpl.addDir(dirType, prefix, path);
	var tmplPending = 0;
	var tmplPendingFunc = null;

	// default route func
	routeFunc = routeFunc || function(next, routes, reqPath){
		if(routes[reqPath]) return routes[reqPath];
		return next();
	};

	// listen files
	var listener = fsListener(dir, fw.debug, function(err, watcher){
		if(err) {
			tmplManager.destroy();
			return cb(err);
		}
		tmplPendingFunc = function(){
			cb(null, {
				dir: path,
				route: function(next, path){
					return routeFunc(next, routes, path);
				},
				end: function(){
					if(fw.debug) watcher.close();
					tmplManager.destroy();
				}
			});
		};
		if(!tmplPending) tmplPendingFunc();
	});

	// (re)load .js files
	listener.on('.js', function(type, relPath){
		var rpcPath = relPath.slice(0, -3);
		if(type === 'remove') {
			delete routes[rpcPath];
			if(fw.debug) console.log('Code Removed (' + dirType + '): ' + rpcPath);
		} else {
			var codePath = dir + '/' + relPath;
			routes[rpcPath] = loadScript(app, 'rpc', prefix, rpcPath, codePath);
			if(typeof(routes[rpcPath]) === 'undefined') delete routes[rpcPath];
			if(fw.debug) console.log('Code Updated (' + dirType + '): ' + rpcPath);
		}
	});

	// reg .tmpl files
	listener.on('.tmpl', function(type, relPath){
		if(type === 'remove') {
			tmplManager.remove(relPath);
			if(fw.debug) console.log('Tmpl Removed (' + dirType + '): ' + relPath);
		} else {
			var codePath = dir + '/' + relPath;
			tmplPending++;
			fs.readdir(codePath.replace(/\.tmpl$/, '.locale'), function(err, files){
				if(err) files = [];
				files.shift('');
				tmplManager.set(relPath, codePath, files, function(){
					if(!--tmplPending && tmplPendingFunc) tmplPendingFunc();
					if(fw.debug) console.log('Tmpl Updated (' + dirType + '): ' + relPath);
				});
			});
		}
	});

	// reload tmpl when locale changed
	listener.on('.locale/', function(type, relPath){
		if(type === 'init') return;
		var locale = relPath.slice(relPath.lastIndexOf('.locale/')+1);
		var tmplPath = relPath.slice(0, relPath.lastIndexOf('.locale/')) + '.tmpl';
		fs.exists(tmplPath, function(exists){
			if(!exists) return;
			if(type === 'remove') {
				tmplManager.removeLocale(relPath, locale);
				if(fw.debug) console.log('Locale Removed (' + dirType + '): ' + relPath);
			} else {
				tmplManager.set(relPath, tmplPath, [locale], function(){
					if(fw.debug) console.log('Locale Updated (' + dirType + '): ' + relPath);
				});
			}
		});
	});
};
