// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fsListener = require('./helpers/fs_listener.js');
var loadScript = require('./helpers/load_script.js');

module.exports = function(app, prefix, dir, cb){
	var routes = {};
	var tmplManager = app.route.tmpl.addDir(dirType, prefix, path);

	// listen files
	var listener = fsListener(dir, function(err, watcher){
		if(err) {
			tmplManager.destroy();
			return cb(err);
		}
		if(!fw.debug) {
			watcher.close();
		}
		cb(null, {
			dir: path,
			route: function(next, path){
				return routeFunc(next, routes, path);
			},
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

	// reg .tmpl files
	listener.on('.tmpl', function(type, relPath){
		if(type === 'remove') {
			tmplManager.remove(relPath);
			if(fw.debug) console.log('Tmpl Removed (' + dirType + '): ' + relPath);
		} else {
			var codePath = dir + '/' + relPath;
			tmplManager.set(relPath, codePath);
			if(fw.debug) console.log('Tmpl Updated (' + dirType + '): ' + relPath);
		}
	});

	// reload tmpl when locale changed
	listener.on('.locale/', function(type, relPath){
		var tmplPath = relPath.slice(0, relPath.lastIndexOf('.locale/')) + '.tmpl';
		fs.exists(dir + '/' + tmplPath, function(err, exists){
			if(err || !exists) return;
			listener.emit('.tmpl', 'change', tmplPath);
		});
	});
};
