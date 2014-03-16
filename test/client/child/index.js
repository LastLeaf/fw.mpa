// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

fw.main(function(pg){
	var tmpl = pg.tmpl;
	$('#child').html('You are in a child dir!<br><a href="javascript:;" onclick="fw.go(-1)">Go back!</a>');
});