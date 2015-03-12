// Copyright 2015 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var routes = {
	"*": {
		"main": "404.js"
	}
};

module.exports = function(app){

	// configuring app
	app.setConfig({
		app: {
			host: '127.0.0.1:1180',
			title: 'App1',
		},
		client: {
			cache: __dirname + '/cache',
		},
		secret: {
			cookie: 'LONG RANDOM STRING',
		}
	});

	// binding directory
	app.bindDir('client', __dirname + '/client');

	// routing
	app.route.setList(routes);

	// starting app
	app.start();

};
