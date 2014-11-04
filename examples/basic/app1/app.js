// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var appconfig = require('./appconfig.js');
var routes = require('./routes.js');

module.exports = function(app){
	app.setConfig(appconfig);
	app.bindDir('client', '/', __dirname + '/client', function(){
		app.route.setList(routes);
		app.start();
	});
};
