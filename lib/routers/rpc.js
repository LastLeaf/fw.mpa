// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// generate pages routes
var routes = {};
var rpcRoutes = function(app, cb){
	// listen files
	fsListener(app.config.path.rpc, {
		'.js': function(file, type){
			if(type && !fw.debug) return;
			var rpcPath = '/' + file.split(path.sep).slice(1).join('/').slice(0, -3);
			if(type !== 'removed') {
				try {
					delete require.cache[app.cwd+'/'+file];
					fw.currentLoading = app.config.path.rpc + rpcPath + '.js';
					routes[rpcPath] = require(app.cwd+'/'+file);
					if(app.debug && type) console.log('RPC File Updated: '+rpcPath);
				} catch(e) {
					delete routes[rpcPath];
					console.trace(e);
				}
				fw.currentLoading = '';
			} else
				delete routes[rpcPath];
		},
		'.tmpl': function(file, type){
			if(!type || !fw.debug) return;
			app.restart();
		},
		'.locale/': function(file, type){
			if(!type || !fw.debug) return;
			app.restart();
		}
	}, cb);
};

// route a method string
var routeMethod = function(str){
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
	return res;
};

module.exports = function(app, prefix, path, cb){};
