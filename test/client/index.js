// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pg = fw.getPage();
var tmpl = pg.tmpl;

pg.on('load', function(){
	pg.msg('echo', function(content){
		alert(content);
	});
	pg.rpc('/echo', 'Hello world!', function(content){
		pg.form($('#speak_form').append(tmpl.index())[0], function(){
			$('#speak').attr('disabled', 1);
		}, function(){
			$('#speak').removeAttr('disabled').val('');
		}, function(){
			$('#speak').removeAttr('disabled');
		});
		$('#lang').val(fw.language).change(function(){
			fw.selectLanguage(this.value);
		});
		pg.msg('speak', function(text){
			$('<p>').text(text).appendTo('#words');
		});
	});
});

pg.on('socketConnect', function(){
	pg.rpc('/chat:reg');
});
