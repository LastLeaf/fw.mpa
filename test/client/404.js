// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

pg.on('load', function(){
	$('body').html($('body').html()+'<div class="index">404 Not Found</div><a href="javascript:;" onclick="fw.go(-1)">Go back!</a>');
});