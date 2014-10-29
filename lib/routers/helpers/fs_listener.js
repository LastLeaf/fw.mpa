// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var EventEmitter = require('events').EventEmitter;
var watchr = require('watchr');

module.exports = function(dir, cb){
	var eventEmitter = new EventEmitter();
	// TODO add init event
	watchr.watch({
		path: dir,
		persistent: false,
		next: cb,
		listener: function(changeType, fullPath, curStat, prevStat){
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
	return eventEmitter;
};
