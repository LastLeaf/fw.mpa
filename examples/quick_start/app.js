// Copyright 2015 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var routes = {
	"/": {
		"tmpl": "index.tmpl",
		"main": "index.js",
		"parent": "global"
	},
	"*": {
		"main": "404.js",
		"parent": "global"
	},
	"global": {
		"style": "global.css",
		"main": "global.js"
	}
};

module.exports = function(app){

	// configuring app
	app.setConfig({
		app: {
			host: '127.0.0.1:1180',
			title: 'My fw.mpa App',
		},
		client: {
			cache: 'cache',
		},
		secret: {
			cookie: 'LONG RANDOM STRING',
		}
	});

	// binding directory
	app.bindDir('static', 'static');
	app.bindDir('client', 'client');
	app.bindDir('rpc', 'rpc');

	// routing
	app.route.setList(routes);

	// starting app
	app.start();

};
