// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

var fs = require('fs');
var generateLocaleFiles = require('./tmpl_parser.js').generateLocaleFiles;
var utils = require('./utils.js');

module.exports = function(path, locale){
	console.log('Search and build locale "' + locale + '" files in "' + path + '" ...');
	// statistics
	var untransTotal = 0;
	var unusedTotal = 0;
	var filesTotal = 0;
	var pendings = 1;
	var pendingAdd = function(){
		pendings++;
	};
	var pendingEnd = function(){
		if(--pendings) return;
		console.log('Total: ' + untransTotal + ' untranslated strings, ' + unusedTotal + ' unused strings (in ' + filesTotal + ' files).');
	};
	// get through all .tmpl files
	utils.walkFileTree(path, function(file){
		if(file.slice(-5) !== '.tmpl') return;
		pendingAdd();
		fs.readFile(file, function(err, str){
			if(err) return pendingEnd();
			generateLocaleFiles(str.toString('utf8'), file, locale, function(untrans, unused){
				untransTotal += untrans;
				unusedTotal += unused || 0;
				filesTotal++;
				pendingEnd();
			});
		});
	}, pendingEnd);
};
