// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var tmpl = fw.loadTmpl('index.tmpl');
var filename = fw.currentLoading;

module.exports = function(args, childRes, next){
	childRes.title = filename;
	childRes.content = tmpl.index('Hello world! (from render)');
	next(childRes);
};