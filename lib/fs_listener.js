// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var watch = require('watch');

module.exports = function(dir, ext, cb, initCb){
	var extFunc = function(file){
		if(ext.charAt(0) === '.')
			return path.extname(file) === ext;
		return path.basename(file) === ext;
	};
	watch.watchTree(dir, {ignoreDotFiles: true}, function(f, curr, prev){
		if(typeof f == "object" && prev === null && curr === null) {
			// Finished walking the tree
			for(var k in f)
				if(!f[k].isDirectory() && extFunc(k))
					cb(k, '');
			initCb();
			return;
		}
		if(curr.isDirectory() || !extFunc(f))
			return;
		if(prev === null) {
			// f is a new file
			cb(f, 'created');
		} else if(curr.nlink === 0) {
			// f was removed
			cb(f, 'removed');
		} else {
			// f was changed
			cb(f, 'changed');
		}
	})
};