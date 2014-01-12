// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var pathConvert = function(k){
	if(!k.match(/:/)) continue;
	if(!k.match(/^[\/:a-z0-9_]+$/i)) continue;
	var keys = k.match(/:[a-z0-9_]+/gi);
	for(var i=0; i<keys.length; i++)
		keys[i] = keys[i].slice(1);
	var reStr = '^' + k.replace(/:[a-z0-9_]+/gi, '([^/]+)') + '$';
	return {
		keys: keys,
		regexp: new RegExp(reStr, '')
	};
};

if(opt.type === 'page') {
	while(routes.length) {
		var route = routes.shift()
		app.pageRoute[route] = require(app.config.server.cwd+'/'+file);
		app.clientRoute[route] = {
			script: ''
		};
	}
} else if(opt.type === 'rpc') {
	app.rpcRoute[file] = require(app.config.server.cwd+'/'+file);
}
