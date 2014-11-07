// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var send = require('send');

module.exports = function(app, prefix, rootPath, cb){
	setTimeout(function(){
		cb(null, {
			dir: rootPath,
			route: function(next, path, req, res){
				send(req, path, {index: false, root: rootPath})
					.on('error', function(err){
						if(next) {
							next();
						} else {
							// route special pages
							var func = app.serverRoute.page(path);
							if(func) func.call(app, req, res);
							else app.sendRender(req, res);
						}
					})
					.pipe(res);
				return true;
			},
			end: function(){}
		});
	}, 0);
};
