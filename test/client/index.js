// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

pg.on('load', function(){
	pg.rpc('/echo', 'Hello world!', function(content){
		$(document.body).append(tmpl.index(content));
	});
	pg.msg('echo', function(content){
		alert(content);
	});
});