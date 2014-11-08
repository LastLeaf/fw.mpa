// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var serverRouter = require('./helpers/server_router.js');

module.exports = function(app, prefix, path, cb){
	// find all matched funcs
	var route = function(next, routes, str){
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

	serverRouter(app, 'rpc', prefix, path, route, cb);
};
