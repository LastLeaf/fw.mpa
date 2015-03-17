// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var serverTmpl = require('./helpers/server_tmpl.js');
var routerTree = require('./helpers/router_tree.js');

var routers = {
	client: require('./client.js'),
	module: require('./module.js'),
	page: require('./page.js'),
	render: require('./render.js'),
	rpc: require('./rpc.js'),
	static: require('./static.js')
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
