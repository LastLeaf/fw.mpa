// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

fw.main(function(pg){
	var tmpl = pg.tmpl;

	fw.loadingLogo.opacity(0.8);

	pg.on('childUnload', function(){
		document.getElementById('child').innerHTML = '';
	});

	pg.on('render', function(res){
		document.getElementById('child').innerHTML = res.content;
	});
});