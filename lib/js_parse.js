// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(str){
	// get directives
	var jsType = 'default';
	var routes = [];
	var pageTitle = '';
	var parent = '';
	var requires = [];
	var reload = '';
	var m = str.match(/^[\t ]*\/\/(fw |\$).+$/gm);
	while(m && m.length) {
		var line = m.shift();
		var a = line.match(/^[\t ]*\/\/(fw |\$)[\t ]+([-a-z0-9_.]+)(.*)$/i);
		if(!a) continue;
		var opt = a[2];
		var args = a[3].slice(1);
		switch(opt) {
			case 'path':
				jsType = 'path';
				var route = args.match(/^[ \t]*(.+?)[ \t]*$/);
				if(route) routes.push(route[1]);
				break;
			case 'page':
				jsType = 'page';
				var route = args.match(/^[ \t]*(.+?)[ \t]*$/);
				if(route) routes.push(route[1]);
				break;
			case 'rpc':
				jsType = 'rpc';
				break;
			case 'title':
				var args = args.match(/^[ \t]*(.+?)[ \t]*$/);
				if(args) pageTitle = args[1];
				break;
			case 'parent':
				var args = args.match(/^[ \t]*(.+?)[ \t]*$/);
				if(args) parent = args[1];
				break;
			case 'require':
				var files = args.match(/[-a-z0-9_.]/g);
				if(files) requires.concat(files);
				break;
			case 'reload':
				var mode = args.match(/[-a-z0-9_.]/);
				if(mode) mode = mode[0];
				if(mode === 'in' || mode === 'out' || mode === 'both') reload = mode;
				break;
		}
	}
	return {
		type: jsType,
		routes: routes,
		title: pageTitle,
		parent: parent,
		requires: requires,
		reload: reload
	};
};