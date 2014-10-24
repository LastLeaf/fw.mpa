// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// deep extend
exports.deepExtend = function(dest, src){
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

// a short time string
exports.nowString = function(){
	var d = new Date();
	var hour = String(d.getHours()+100).slice(1);
	var min = String(d.getMinutes()+100).slice(1);
	var sec = String(d.getSeconds()+100).slice(1);
	var ms = String(d.getMilliseconds()+1000).slice(1);
	return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate() + '_' + hour + ':' + min + ':' + sec + '.' + ms;
};
