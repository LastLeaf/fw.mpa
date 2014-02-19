// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(app, next){
	app.hello = 'Hello world! (from modules)';
	next();
};