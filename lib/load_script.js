// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var pathIsAbsolute = require('path-is-absolute');
var requireUncache = require('require-uncache');

module.exports = function(app, type, prefix, visitPath, codePath){
	var res = undefined;
	var relCodePath = codePath;
	if(!pathIsAbsolute(codePath)) relCodePath = path.join(process.cwd(), codePath);
	requireUncache(relCodePath);
	fw.currentLoading = { app: app, type: type, prefix: prefix, visitPath: visitPath, codePath: codePath };
	try {
		res = require(relCodePath);
	} catch(err) {
		console.error('Failed when loading ' + codePath);
		console.error(err.stack || 'Error: ' + err.message);
	}
	fw.currentLoading = null;
	return res;
};
