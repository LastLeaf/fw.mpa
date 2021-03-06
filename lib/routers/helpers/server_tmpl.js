// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');

var tmplParser = require('../../tmpl_parser.js').parser;
var routerTree = require('./router_tree.js');

module.exports = function(app){

	var curRoutes = null;
	var routerCreator = function(app, prefix, dir, cb){
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
		module: routerTree(app, routerCreator),
		page: routerTree(app, routerCreator),
		render: routerTree(app, routerCreator),
		rpc: routerTree(app, routerCreator)
	};

	var createManager = function(type, prefix, dir){
		var routes = curRoutes = {};
		trees[type].add(prefix, dir, function(){});
		curRoutes = null;

		var set = function(relPath, codePath, locale, cb){
			fs.readFile(codePath, function(err, buf){
				tmplParser(app, buf.toString('utf8'), codePath, locale, function(langTmpls){
					routes[relPath] = {};
					for(var k in langTmpls)
						routes[relPath][k] = langTmpls[k];
					cb();
				});
			});
		};

		var remove = function(relPath){
			delete routes[relPath];
		};

		var removeLocale = function(relPath, locale){
			if(routes[relPath]) delete routes[relPath][locale];
		};

		var destroy = function(){
			// do nothing, for whole route trees is always be cleared
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
