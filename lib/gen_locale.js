// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

// TODO locale tool
var fs = require('fs');
var generateLocaleFiles = require('./tmpl_parser.js').generateLocaleFiles;
var fsListener = require('./fs_listener.js');

// deep extend
var deepExtend = function(dest, src){
	for (var prop in src) {
		if (typeof src[prop] === "object" && src[prop] !== null ) {
			dest[prop] = dest[prop] || {};
			deepExtend(dest[prop], src[prop]);
		} else {
			dest[prop] = src[prop];
		}
	}
	return dest;
};

module.exports = function(){
	// construct a simple app obj
	var app = {};
	app.cwd = process.cwd();
	var config = require(app.cwd+'/fwconfig.js');
	app.config = deepExtend(require('./default/fwconfig.js'), config);
	// get through all .tmpl files
	var untransTotal = 0;
	var unusedTotal = 0;
	var finished = function(untrans, unused){
		untransTotal += untrans;
		unusedTotal += unused || 0;
		c--;
		if(c) return;
		console.log('Total: ' + untransTotal + ' untranslated strings, ' + unusedTotal + ' unused strings.');
		process.exit();
	};
	var c = 5;
	['tmpl', 'module', 'page', 'render', 'rpc'].forEach(function(v){
		fsListener(app.config.path[v], {
			'.tmpl': function(file, type){
				c++;
				fs.readFile(file, function(err, str){
					if(err) {
						finished(0);
						return;
					}
					generateLocaleFiles(app, str.toString('utf8'), file, finished);
				});
			}
		}, function(){
			finished(0);
			return false;
		});
	});
};
