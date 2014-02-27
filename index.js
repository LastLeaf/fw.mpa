// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

var mode = process.env.FW;

if(mode === 'DEBUG' || mode === 'CACHE') {
	// debug or cache mode
	var childProcess = require('child_process');
	var createChild = function(){
		var cp = childProcess.fork(__dirname+'/lib/main.js');
		cp.on('exit', function(code){
			if(code === 51) {
				// child required a reboot
				console.log('Will restart soon...');
				setTimeout(createChild, 1000);
				return;
			}
			if(mode === 'DEBUG') {
				process.exit(code);
			} else {
				setTimeout(createChild, 3000);
			}
		});
	};
	module.exports = function(basepath){
		if(basepath) process.chdir(basepath);
		createChild();
	};
} else {
	// limited mode
	module.exports = function(basepath){
		if(basepath) process.chdir(basepath);
		require(__dirname+'/lib/main.js');
	};
}