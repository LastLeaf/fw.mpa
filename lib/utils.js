// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');

// deep extend
var deepExtend = exports.deepExtend = function(dest, src){
	for(var prop in src) {
		if(typeof(src[prop]) === 'object') {
			if(src[prop] instanceof Array) {
				if(dest[prop] instanceof Array) dest[prop] = dest[prop] || [];
				else dest[prop] = [];
			} else {
				if(typeof(dest[prop]) === 'object') dest[prop] = dest[prop] || {};
				else dest[prop] = {};
			}
			deepExtend(dest[prop], src[prop]);
		} else {
			dest[prop] = src[prop];
		}
	}
	return dest;
};

// a short time string
exports.nowString = function(){
	var d = new Date();
	var hour = String(d.getHours()+100).slice(1);
	var min = String(d.getMinutes()+100).slice(1);
	var sec = String(d.getSeconds()+100).slice(1);
	var ms = String(d.getMilliseconds()+1000).slice(1);
	return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate() + '_' + hour + ':' + min + ':' + sec + '.' + ms;
};

// walk file tree, call cb when meet a file
var walkFileTree = exports.walkFileTree = function(root, cb, doneCb, curPath){
	fs.readdir(root, function(err, files){
		if(err) return doneCb();
		var finishCount = files.length + 1;
		var finish = function(){
			if(!--finishCount) doneCb();
		};
		files.forEach(function(file){
			fs.stat(root + '/' + file, function(err, stat){
				if(err) return finish();
				if(stat.isDirectory()) walkFileTree(root + '/' + file, cb, finish, curPath ? curPath + '/' + file : file);
				else {
					cb(curPath ? curPath + '/' + file : file, stat);
					finish();
				}
			});
		});
		finish();
	});
};

// rmdirp
var rmdirp = exports.rmdirp = function(root, cb) {
	fs.stat(root, function(err, stat){
		if(err) return cb();
		if(stat.isDirectory()) {
			fs.readdir(function(err, files){
				if(err) return cb();
				var finishCount = files.length + 1;
				var finish = function(){
					finishCount--;
					if(!finishCount) {
						fs.rmdir(root, cb);
					}
				};
				files.forEach(function(file){
					file = root + '/' + file;
					rmdirp(file, finish);
				});
				finish();
			});
		} else {
			fs.unlink(root + '/' + file, cb);
		}
	});
};
