// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var db = require('mongoose');
var session = require('express-session');
var mongoSession = require('connect-mongo')(session);

module.exports = function(dbConfig, cb){
	var dbConnection = db.connection;
	db.connect(dbConfig.host, dbConfig.name, dbConfig.port, {
		user: dbConfig.user,
		pass: dbConfig.password
	}, function(){
		cb(db, new mongoSession({
			collection: 'fw.sessions',
			mongoose_connection: dbConnection
		}), function(cb){
			db.disconnect(cb);
		});
	});
	dbConnection.on('error', function(err){
		console.error(err);
	});
};
