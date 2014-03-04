// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

pg.on('load', function(){
	fw.loadingLogo.opacity(0.8);
});

pg.on('childUnload', function(){
	$('#child').html('');
});

pg.on('render', function(res){
	$('#child').html(res.content);
});