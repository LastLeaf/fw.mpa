// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var send = require('send');
var errorCatcher = require('../error_catcher.js');

module.exports = function(app, prefix, rootPath, cb){
	cb(null, {
		dir: rootPath,
		route: function(next, path, req, res){
			var reqPath = path || '';
			if(req.path.slice(-1) === '/') reqPath += '/';
			send(req, reqPath, {index: false, root: rootPath})
				.on('error', function(err){
					if(next) {
						next();
					} else {
						// when no static routes found, route as common page
						app.sendRender(req, res);
					}
				})
				.pipe(res);
			return true;
		},
		end: function(){}
	});
};
