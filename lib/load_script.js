// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');

module.exports = function(app, type, prefix, visitPath, codePath){
	var res = undefined;
	var relCodePath = process.cwd() + '/' + codePath;
	delete require.cache[relCodePath];
	fw.currentLoading = { app: app, type: type, prefix: prefix, visitPath: visitPath, codePath: codePath };
	try {
		res = require(relCodePath);
	} catch(e) {
		console.error('Failed when loading ' + codePath);
		console.trace(e);
	}
	fw.currentLoading = null;
	return res;
};
