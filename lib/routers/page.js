// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var serverRouter = require('./helpers/server_router.js');

module.exports = function(app, prefix, path, cb){
	serverRouter(app, 'page', prefix, path, null, false, cb);
};
