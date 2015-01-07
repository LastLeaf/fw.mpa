// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');

module.exports = function(app, type, prefix, visitPath, codePath){
	var res = undefined;
	var relCodePath = codePath;
	if(codePath.charAt(0) !== '/') relCodePath = process.cwd() + '/' + codePath;
	delete require.cache[relCodePath];
	fw.currentLoading = { app: app, type: type, prefix: prefix, visitPath: visitPath, codePath: codePath };
	try {
		res = require(relCodePath);
	} catch(e) {
		console.error('Failed when loading ' + codePath);
		console.log(e.stack);
	}
	fw.currentLoading = null;
	return res;
};
