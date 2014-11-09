// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// path parsing helper
var splitPath = function(path){
	var slices = path.split('/');
	var resSlices = [];
	while(slices.length) {
		var slice = slices.shift();
		if(slice === '.' || slice === '') continue;
		if(slice === '..') {
			resSlices.pop();
			continue;
		}
		resSlices.push(slice);
	}
	return resSlices;
};

// create combined router for one kind of resource
module.exports = function(app, routerCreator){
	var routeTree = [];
	var route = function(path){
		// parse extra args
		var args = [];
		for(var i=0; i<arguments.length; i++) {
			args.push(arguments[i]);
		}
		// search in route tree
		var slices = splitPath(path);
		var cur = routeTree;
		var routers = [];
		while(1) {
			var relPath = slices.join('/');
			for(var i=0; i<cur.length; i++) {
				routers.push([relPath, cur[i]]);
			}
			var slice = slices.shift();
			if(!slice || !cur['~' + slice]) break;
			cur = cur['~' + slice];
		}
		// call routers
		var nextRouter = function(){
			var routerInfo = routers.pop();
			if(!routers.length) args[0] = null;
			args[1] = routerInfo[0];
			return routerInfo[1].route.apply(fw, args);
		};
		args.unshift(nextRouter);
		if(!routers.length) return;
		return nextRouter();
	};
	var add = function(prefix, dir, cb){
		var slices = splitPath(prefix);
		prefix = slices.join('/');
		if(prefix) prefix = '/' + prefix;
		routerCreator(app, prefix, dir, function(err, router){
			if(err) return cb(err);
			// search route tree
			var cur = routeTree;
			while(slices.length) {
				var slice = slices.shift();
				if(!cur['~' + slice]) {
					cur['~' + slice] = [];
				}
				cur = cur['~' + slice];
			}
			cur.push(router);
			if(cb) cb();
		});
	};
	var removeAll = function(){
		// search all routers
		var routers = [];
		var recSearch = function(cur){
			while(cur[k].length) {
				routers.push(cur.shift());
			}
			for(var k in cur) {
				if(k.charAt(0) === '~') recSearch(cur[k]);
			}
		};
		recSearch(routeTree);
		// clear route tree
		routeTree = [];
		// end all routers
		while(routers.length) {
			routers.shift().end();
		}
	};
	var list = function(){
		// search all routers, and list prefix, dir, router from lower priority to higher
		var routers = [];
		var recSearch = function(cur, curPath){
			for(var i=0; i<cur.length; i++) {
				var r = cur[i];
				routers.unshift({
					prefix: curPath,
					dir: r.dir,
					router: r
				});
			}
			for(var k in cur) {
				if(k.charAt(0) === '~') recSearch(cur[k], curPath + '/' + k.slice(1));
			}
		};
		recSearch(routeTree, '');
		return routers;
	};
	return {
		route: route,
		add: add,
		clear: removeAll,
		list: list
	};
};