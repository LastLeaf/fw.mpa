// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var EventEmitter = require('events').EventEmitter;
var watchr = require('watchr');

var utils = require('../../utils.js');

module.exports = function(dir, walkOnly, cb){
	var eventEmitter = new EventEmitter();
	var startChange = false;
	if(!walkOnly) {
		watchr.watch({
			path: dir,
			persistent: false,
			next: cb,
			listener: function(changeType, fullPath, curStat, prevStat){
				if(!startChange) return;
				if((curStat && curStat.isDirectory()) || (prevStat && prevStat.isDirectory()))
					return;
				var pathSlices = path.resolve(dir, fullPath).split(path.sep);
				var relPath = pathSlices.join('/');
				eventEmitter.emit('*', changeType, relPath);
				var basename = pathSlices[pathSlices.length - 1];
				if(basename.lastIndexOf('.') >= 0)
					eventEmitter.emit(basename.slice(basename.lastIndexOf('.')), changeType, relPath);
				var baseParent = pathSlices[pathSlices.length - 2] || '';
				if(baseParent.lastIndexOf('.') >= 0)
					eventEmitter.emit(baseParent.slice(baseParent.lastIndexOf('.')) + '/', changeType, relPath);
			}
		});
	}
	utils.walkFileTree(dir, function(relPath){
		eventEmitter.emit('*', 'init', relPath);
		var basename = path.basename(relPath);
		if(basename.lastIndexOf('.') >= 0)
			eventEmitter.emit(basename.slice(basename.lastIndexOf('.')), 'init', relPath);
		var dirname = path.dirname(relPath);
		if(!dirname) return;
		var baseParent = path.basename(dirname);
		if(baseParent.lastIndexOf('.') >= 0)
			eventEmitter.emit(baseParent.slice(baseParent.lastIndexOf('.')) + '/', 'init', relPath);
	}, function(){
		startChange = true;
	});
	return eventEmitter;
};
