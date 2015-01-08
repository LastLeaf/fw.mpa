// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var childProcess = require('child_process');
var utils = require('./lib/utils.js');
var fwconfigDefault = require('./lib/default/fwconfig.js');

module.exports = function(fwconfig){
	// normalize fwconfig
	fwconfig = utils.deepExtend(fwconfigDefault, fwconfig);
	var mode = fwconfig.mode;

	// write to env
	process.env.FW = JSON.stringify(fwconfig);

	// start process
	if(mode === 'debug' || mode === 'cache') {
		// debug or cache mode
		var createChild = function(){
			var cp = childProcess.fork(__dirname+'/lib/main.js');
			cp.on('exit', function(code, signal){
				if(code === 250) {
					// child required a reboot
					console.log('fw.mpa will restart soon...');
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
		createChild();
	} else if(mode === 'run') {
		// run mode
		var createChild = function(){
			var cp = childProcess.fork(__dirname+'/lib/main.js');
			cp.on('exit', function(code){
				setTimeout(createChild, 1000);
			});
		};
		createChild();
	} else {
		// limited mode
		require(__dirname+'/lib/main.js');
	}
};
