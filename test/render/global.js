// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(conn, args, childRes, next){
	childRes.title = '[fw.mpa test] ' + childRes.title;
	childRes.content = '<div id="global"></div><div id="child">' + childRes.content + '</div>';
	next(childRes);
};