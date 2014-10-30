// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(app, prefix, rootPath, cb){
	if(!fw.debug) return;
	setTimeout(function(){
		cb(null, {
			dir: rootPath,
			route: function(next, path, cb){
				fs.exists(path, function(err, exists){
					if(err || !exists) {
						if(next) next();
						cb('');
					}
					cb(rootPath + '/' + path);
				});
				return true;
			},
			end: function(){}
		});
	}, 0);
};
