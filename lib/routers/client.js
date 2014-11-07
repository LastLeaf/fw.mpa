// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');

module.exports = function(app, prefix, rootPath, cb){
	if(!fw.debug) return;
	setTimeout(function(){
		cb(null, {
			dir: rootPath,
			route: function(next, path, cb){
				fs.exists(rootPath + '/' + path, function(exists){
					if(!exists) {
						if(next) next();
						else cb('');
						return;
					}
					cb(rootPath + '/' + path);
				});
				return true;
			},
			end: function(){}
		});
	}, 0);
};
