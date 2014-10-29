// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');

module.exports = function(app, type, path, codePath){
	var res = undefined;
	codePath = path.relative(__dirname, process.cwd() + '/' + codePath);
	delete require.cache[codePath];
	fw.currentLoading = { app: app, type: type, path: path, codePath: codePath };
	try {
		res = require(codePath);
	} catch(e) {
		console.trace(e);
	}
	fw.currentLoading = null;
	return res;
};
