// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// TODO
// start server
var startServer = function(){
	// loading server modules
	var moduleRes = {};
	if(fs.existsSync(app.config.path.module)) {
		if(app.debug)
			fsListener(app.config.path.module, {'.js': function(file, type){
				if(type) app.restart();
			}});
		var files = fs.readdirSync(app.config.path.module);
		var next = function(){
			if(!files.length) {
				route();
				return;
			}
			var file = files.shift();
			var stat = fs.statSync(app.config.path.module+'/'+file);
			if(stat.isDirectory() || file.slice(-3) === '.js') {
				if(app.debug) console.log('Loading module: ' + file);
				fw.currentLoading = app.config.path.module+'/'+file;
				if(stat.isDirectory()) fw.currentLoading += '/';
				require(app.cwd+'/'+app.config.path.module+'/'+file)(function(obj){
					moduleRes[file] = obj || null;
					next();
				});
				fw.currentLoading = '';
			} else {
				next();
			}
		};
		next();
	} else {
		route();
	}
};

module.exports = function(app, prefix, path, cb){};
