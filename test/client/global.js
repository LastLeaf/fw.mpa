// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

pg.on('childLoadStart', function(){
	$('body').html('fw.mpa test!');
});
