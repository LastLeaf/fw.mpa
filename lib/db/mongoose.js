// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var session = require('express-session');
var mongoSession = require('connect-mongo')(session);
var requireUncache = require('require-uncache');

module.exports = function(dbConfig, cb){
	requireUncache('mongoose');
	var db = require('mongoose');

	var dbConnection = db.connection;
	db.connect(dbConfig.host, dbConfig.name, dbConfig.port, {
		user: dbConfig.user,
		pass: dbConfig.password
	}, function(){
		cb(db, new mongoSession({
			collection: dbConfig.sessionCollection || 'fw.sessions',
			mongoose_connection: dbConnection
		}), function(cb){
			db.disconnect(cb);
		});
	});
	dbConnection.on('error', function(err){
		console.error(err);
	});
};
