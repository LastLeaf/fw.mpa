// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var send = require('send');
var errorCatcher = require('../error_catcher.js');

module.exports = function(app, prefix, rootPath, cb){
	cb(null, {
		dir: rootPath,
		route: function(next, path, req, res){
			send(req, path || '/', {index: false, root: rootPath})
				.on('error', function(err){
					if(next) {
						next();
					} else {
						// when no static routes found, route special pages
						var func = app.serverRoute.page(req.path);
						if(func) {
							errorCatcher(function(){
								func.call(app, req, res);
							}, function(err){
								console.error('An error occurred in page "' + req.path + '".');
								console.error(err.stack || 'Error: ' + err.message);
								if(fw.debug) process.exit();
								else app.restart();
							});
						} else {
							app.sendRender(req, res);
						}
					}
				})
				.pipe(res);
			return true;
		},
		end: function(){}
	});
};
