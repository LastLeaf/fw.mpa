// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var appconfig = require('./appconfig.js');

module.exports = function(app){
	app.setConfig(appconfig);
	app.bindDir('client', '/', __dirname + '/client');
	app.start();
};
