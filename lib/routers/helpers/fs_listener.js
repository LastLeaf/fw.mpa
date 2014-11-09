// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var path = require('path');
var EventEmitter = require('events').EventEmitter;
var watchr = require('watchr');

var utils = require('../../utils.js');

module.exports = function(dir, keepWatch, cb){
	// sync event emitter
	var eventFuncs = {};
	var eventEmitter = {
		on: function(ev, func){
			if(!eventFuncs[ev]) eventFuncs[ev] = [func];
			else eventFuncs[ev].push(func);
		},
		emit: function(ev){
			var arr = eventFuncs[ev];
			if(!arr) return;
			var args = [];
			for(var i=1; i<arguments.length; i++)
				args.push(arguments[i]);
			for(var i=0; i<arr.length; i++) {
				try {
					arr[i].apply(global, args);
				} catch(e) {
					console.trace(e);
				}
			}
		}
	};
	// listen for changes if needed
	var startChange = false;
	if(keepWatch) {
		watchr.watch({
			path: dir,
			persistent: false,
			listener: function(changeType, fullPath, curStat, prevStat){
				if(!startChange) return;
				if((curStat && curStat.isDirectory()) || (prevStat && prevStat.isDirectory()))
					return;
				var pathSlices = path.relative(dir, fullPath).split(path.sep);
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
	// go through file tree
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
		cb();
	});
	return eventEmitter;
};
