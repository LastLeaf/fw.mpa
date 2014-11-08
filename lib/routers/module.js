// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fsListener = require('./helpers/fs_listener.js');

module.exports = function(app, prefix, dir, cb){
	var routes = {};
	var tmplManager = app.serverRoute.tmpl.addDir('module', prefix, dir);

	// listen files
	var listener = fsListener(dir, fw.debug, function(err, watcher){
		if(err) {
			tmplManager.destroy();
			return cb(err);
		}
		cb(null, {
			dir: dir,
			route: function(next, reqPath){},
			end: function(){
				if(fw.debug) watcher.close();
				tmplManager.destroy();
			}
		});
	});

	// restart app when any .js file changed
	listener.on('.js', function(type, relPath){
		if(type !== 'init') return app.restart();
	});
};
