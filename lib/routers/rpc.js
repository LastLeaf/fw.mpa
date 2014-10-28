// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fsListener = require('./fs_listener.js');

module.exports = function(app, path, cb){
	var routes = {};
	var watcher = null;

	// create a router
	var initRouter = function(dir, cb){
		// listen files
		var listener = fsListener(dir, function(err, newWatcher){
			if(err) return cb(err);
			if(!fw.debug) {
				newWatcher.close();
				return cb();
			}
			if(watcher) watcher.close();
			watcher = newWatcher;
			cb();
		});
		// (re)load .js files
		listener.on('.js', function(type, relPath){
			var rpcPath = relPath.slice(0, -3);
			if(type === 'remove') {
				delete routes[rpcPath];
				if(fw.debug) console.log('RPC File Removed: ' + rpcPath);
			} else {
				var codePath = dir + '/' + relPath;
				if(dir.charAt(0) !== '/') codePath = process.cwd() + '/' + codePath;
				delete require.cache[codePath];
				fw.currentLoading = codePath;
				try {
					routes[rpcPath] = require(codePath);
					if(fw.debug) console.log('RPC File Updated: ' + rpcPath);
				} catch(e) {
					delete routes[rpcPath];
					console.trace(e);
				}
				fw.currentLoading = '';
			}
		});
		// dir reload when tmpl changed
		if(fw.debug) {
			var dirReload = function(){
				initRouter(dir, function(err){
					if(!err) return;
					console.trace(err);
					watcher.close();
					watcher = null;
				});
			};
			listener.on('.tmpl', dirReload);
			listener.on('.locale/', dirReload);
		}
	};

	// route a path
	var routeMethod = function(next, str){
		var method = str.split(':');
		var res = [];
		// route file
		if(!routes.hasOwnProperty(method[0])) return res;
		var func = routes[method[0]];
		if(typeof(func) === 'function')
			res.push(func);
		// route methods
		if(method.length > 1) {
			var path = method[1].split('.');
			var cur = routes[method[0]];
			while(path.length) {
				if(!cur.hasOwnProperty(path[0]))
					break;
				func = cur[path.shift()];
				if(typeof(func) === 'function')
					res.push(func);
				cur = func;
			}
		}
		if(next) {
			var prevRes = next();
			if(prevRes && prevRes.length) res = res.concat(prevRes);
		}
		return res;
	};

	initRouter(path, function(err){
		if(err) return cb(err);
		cb(null, {
			dir: path,
			route: routeMethod,
			end: function(){
				if(watcher) watcher.close();
			}
		});
	});
};
