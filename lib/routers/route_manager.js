// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var serverTmpl = require('./helpers/server_tmpl.js');
var routerTree = require('./helpers/router_tree.js');

var routers = {
	client: require('client'),
	module: require('module'),
	page: require('page'),
	render: require('render'),
	rpc: require('rpc'),
	static: require('static')
};

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

module.exports = function(app){
	var res = {};
	app.serverRoute = {
		tmpl: serverTmpl(app)
	};
	for(var k in routers) {
		res[k] = routerTree(app, routers[k]);
		app.serverRoute[k] = res[k].route;
	}
	return res;
};
