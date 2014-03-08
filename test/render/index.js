// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var tmpl = fw.tmpl('index.tmpl');
var filename = fw.currentLoading;

module.exports = function(conn, args, childRes, next){
	childRes.title = filename;
	childRes.content = tmpl.index(conn, 'Hello world! (from render)');
	next(childRes);
};