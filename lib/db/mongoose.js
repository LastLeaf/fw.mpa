// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var db = require('mongoose');
var express = require('express');
var mongoSession = require('connect-mongo')(express);

module.exports = function(dbConfig, cb){
	var dbConnection = app.db.connection;
	app.db.connect(app.config.db.host, app.config.db.name, app.config.db.port, {
		user: app.config.db.user,
		pass: app.config.db.password
	}, function(){
		cb(db, new mongoSession({
			collection: 'fw.sessions',
			mongoose_connection: dbConnection
		});
	});
	dbConnection.on('error', function(err){
		console.error(err);
	});
};