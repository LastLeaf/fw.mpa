// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var watch = require('watch');

module.exports = function(dir, cbs, initCb){
	var extFunc = function(file, type){
		for(var ext in cbs) {
			var cb = cbs[ext];
			if(ext.charAt(0) === '.') {
				if(ext.slice(-1) === '/') {
					if(file.indexOf(ext.slice(0, -1)+path.sep) >= 0)
						cb(file, type, ext);
				}
				if(path.extname(file) === ext)
					cb(file, type, ext);
			}
			if(path.basename(file) === ext)
				cb(file, type, ext);
		}
	};
	watch.watchTree(dir, {ignoreDotFiles: true}, function(f, curr, prev){
		if(typeof f == 'object' && prev === null && curr === null) {
			// Finished walking the tree
			for(var k in f)
				if(!f[k].isDirectory())
					extFunc(k, '');
			initCb();
			return;
		}
		if(curr.isDirectory())
			return;
		if(prev === null) {
			// f is a new file
			extFunc(f, 'created');
		} else if(curr.nlink === 0) {
			// f was removed
			extFunc(f, 'removed');
		} else {
			// f was changed
			extFunc(f, 'changed');
		}
	})
};