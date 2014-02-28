// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

pg.on('load', function(){
	$('#child').html('You are in a child dir!<br><a href="javascript:;" onclick="fw.go(-1)">Go back!</a>');
});