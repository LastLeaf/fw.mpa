// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var handlebars = require('handlebars');

exports.preparser = function(str){
	var r = '';
	var tmpls = str.match(/<tmpl\s+id\=\"\w+\"\s*>[\s\S]*?<\/tmpl>/gi);
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<tmpl\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/tmpl>$/i);
		if(r) r += ',';
		r += '"' + tmpl[1] + '":' + handlebars.precompile(tmpl[2]);
	}
	return r;
};

exports.parser = function(str){
	var r = {};
	var tmpls = str.match(/<tmpl\s+id\=\"\w+\"\s*>[\s\S]*?<\/tmpl>/gi);
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<tmpl\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/tmpl>$/i);
		r[tmpl[1]] = handlebars.compile(tmpl[2]);
	}
	return r;
};
