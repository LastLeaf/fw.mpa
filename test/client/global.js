// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

$('#global').text('This is fw.mpa test!');
$(fw.div).fadeTo(200, 0.8);

pg.on('childUnload', function(){
	$('#child').html('');
});

pg.on('childLoadStart', function(){
	$(fw.div).show();
});

pg.on('childLoadEnd', function(){
	$(fw.div).detach();
});

pg.on('render', function(res){
	$('#child').html(res.content);
});