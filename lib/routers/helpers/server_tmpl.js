// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');

var tmplParser = require('./tmpl_parser.js').parser;
var routerTree = require('./router_tree.js');

module.exports = function(app){

	var curRoutes = null;
	var routerCreator = function(prefix, dir, cb){
		var routes = curRoutes;
		cb(null, {
			dir: dir,
			route: function(next, path){
				if(routes[path]) return routes[path];
				if(next) return next();
			},
			end: function(){}
		});
	};

	var trees = {
		module: routerTree(app, router),
		page: routerTree(app, router),
		render: routerTree(app, router),
		rpc: routerTree(app, router)
	};

	var createManager = function(type, prefix, dir){
		var routes = curRoutes = {};
		trees[type].add(prefix, dir);
		curRoutes = null;

		var set = function(relPath, codePath){
			var langTmpls = tmplParser(app, fs.readFileSync(codePath).toString('utf8'), codePath);
			routes[relPath] = langTmpls;
		};

		var remove = function(relPath){
			delete routes[relPath];
		};

		var destroy = function(){
			trees[type].remove(prefix, dir);
		};

		return {
			set: set,
			remove: remove,
			destroy: destroy
		};
	};

	var res = {};
	res.addDir = createManager;
	res.generate = function(type, path){
		var tree = trees[type];
		return function(conn){
			var langTmpls = tree.route(path);
			if(langTmpls) return langTmpls[conn.language] || langTmpls[''];
		};
	};
	return res;
};
