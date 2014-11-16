// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fsListener = require('./helpers/fs_listener.js');
var loadScript = require('../load_script.js');

module.exports = function(app, prefix, dir, cb){
	var routes = {};
	var tmplManager = app.serverRoute.tmpl.addDir('module', prefix, dir);
	var watcher = null;

	var pendingCount = 1;
	var pendingEnd = function(){
		if(--pendingCount) return;
		cb(null, {
			dir: dir,
			route: function(next, reqPath){},
			end: function(){
				if(fw.debug) watcher.close();
				tmplManager.destroy();
			}
		});
	};
	var pendingAdd = function(){
		pendingCount++;
		return pendingEnd;
	};

	// listen files
	var listener = fsListener(dir, fw.debug, function(err, newWatcher){
		if(err) {
			tmplManager.destroy();
			console.log(err.stack);
		} else {
			watcher = newWatcher;
		}
		pendingEnd();
	});

	// restart app when any .js file changed
	listener.on('.js', function(type, relPath){
		if(type !== 'init') return app.restart();
		if(relPath.match(/^[^\/]+\/index\.js$/)) {
			// load as dir
			var visitPath = prefix + '/' + relPath.slice(0, -9);
		} else if(relPath.match(/^[^\/]+\.js$/)) {
			// load as file
			var visitPath = prefix + '/' + relPath;
		} else {
			return;
		}
		if(fw.debug) console.log('Loading module: ' + visitPath);
		var func = loadScript(app, 'module', prefix, visitPath, dir + '/' + relPath);
		pendingAdd();
		func(app, function(obj){
			app.loadedModules[visitPath] = obj;
			pendingEnd();
		});
	});
};
