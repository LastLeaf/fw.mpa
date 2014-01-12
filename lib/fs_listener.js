// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var watch = require('watch');

module.exports = function(dir, ext, cb){
	var extFunc = function(file){
		return path.extname(file) === ext;
	};
	watch.watchTree(dir, {ignoreDotFiles: true, extFunc: extFunc}, function(f, curr, prev){
		if(typeof f == "object" && prev === null && curr === null) {
			// Finished walking the tree
			for(var k in f)
				if(extFunc(k))
					cb(k, '');
		} else if(prev === null) {
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