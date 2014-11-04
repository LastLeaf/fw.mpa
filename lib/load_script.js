// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');

module.exports = function(app, type, prefix, rpcPath, codePath){
	var res = undefined;
	var relCodePath = path.relative(__dirname, process.cwd() + '/' + codePath);
	delete require.cache[relCodePath];
	fw.currentLoading = { app: app, type: type, prefix: prefix, path: rpcPath, codePath: codePath };
	try {
		res = require(relCodePath);
	} catch(e) {
		console.trace(e);
	}
	fw.currentLoading = null;
	return res;
};
