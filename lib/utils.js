// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// deep extend
exports.deepExtend = function(dest, src){
	for (var prop in src) {
		if (typeof src[prop] === 'object' && src[prop] !== null) {
			dest[prop] = dest[prop] || {};
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
	curPath = curPath || '';
	fs.readdir(root + '/' + curPath, function(err, files){
		if(err) return doneCb();
		var finishCount = files.length + 1;
		var finish = function(){
			finishCount--;
			if(!finishCount) doneCb();
		};
		files.forEach(function(file){
			file = curPath + '/' + file;
			fs.stat(root + '/' + file, function(err, stat){
				if(err) return;
				if(stat.isDirectory()) walkFileTree(root + '/' + file, cb, finish, file);
				else cb(file, stat);
			});
		});
		finish();
	});
};

// rmdirp
exports.rmdirp = function(path) {
	var files = [];
	if(fs.existsSync(path)) {
		files = fs.readdirSync(path);
		files.forEach(function(file,index){
			var curPath = path + '/' + file;
			if(fs.statSync(curPath).isDirectory()) {
				rmdirp(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};
