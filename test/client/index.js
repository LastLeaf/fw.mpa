// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

pg.on('load', function(){
	pg.msg('echo', function(content){
		alert(content);
	});
	pg.rpc('/echo', 'Hello world!', function(content){
		var form = $(tmpl.index(content)).appendTo(document.body).find('form')[0];
		form.page = pg;
		form.res = function(){
			$('#speak').val('');
		};
		pg.msg('speak', function(text){
			$('<p>').text(text).appendTo('#words');
		});
	});
});

pg.on('socketConnect', function(){
	pg.rpc('/chat:reg');
});
