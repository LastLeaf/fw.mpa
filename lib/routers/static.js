// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var send = require('send');

module.exports = function(app, rootPath, cb){
	setTimeout(function(){
		cb(null, {
			dir: rootPath,
			route: function(next, path, req, res){
				send(req, path, {index: false, root: rootPath})
					.on('error', function(err){
						if(next) next();
						else res(404);
					})
					.pipe(res);
				return true;
			},
			end: function(){
				if(watcher) watcher.close();
				watcher = null;
			}
		});
	}, 0);
};
