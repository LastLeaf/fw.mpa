// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var utils = require('./lib/utils.js');
var fwconfigDefault = require('./lib/default/fwconfig.js');

module.exports = function(fwconfig){
	// normalize fwconfig
	utils.deepExtend(fwconfig, fwconfigDefault);
	var mode = fwconfig.mode;

	// write to env
	process.env.FW = JSON.stringify(fwconfig);

	// start process
	if(mode === 'debug' || mode === 'cache') {
		// debug or cache mode
		var childProcess = require('child_process');
		var createChild = function(){
			var cp = childProcess.fork(__dirname+'/lib/main.js');
			cp.on('exit', function(code, signal){
				if(code === 250) {
					// child required a reboot
					console.log('Will restart soon...');
					setTimeout(createChild, 1000);
					return;
				}
				if(mode === 'debug') {
					process.exit(code);
				} else {
					setTimeout(createChild, 1000);
				}
			});
		};
		module.exports = function(basepath){
			if(basepath) process.chdir(basepath);
			createChild();
		};
	} else if(mode === 'run') {
		// run mode
		var childProcess = require('child_process');
		var createChild = function(){
			var cp = childProcess.fork(__dirname+'/lib/main.js');
			cp.on('exit', function(code){
				setTimeout(createChild, 1000);
			});
		};
		module.exports = function(basepath){
			if(basepath) process.chdir(basepath);
			createChild();
		};
	} else if(mode === 'locale') {
		// locale generation mode
		module.exports = require(__dirname+'/lib/gen_locale.js');
	} else {
		// limited mode
		module.exports = function(basepath){
			if(basepath) process.chdir(basepath);
			require(__dirname+'/lib/main.js');
		};
	}

};
