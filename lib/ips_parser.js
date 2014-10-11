// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var ipaddr = require('ipaddr.js');

module.exports = function(str){
	var xff = (str || '').split(',');
	var ips = [];
	for(var i=0; i<xff.length; i++) {
		var ip = xff[i].replace(/^\s+|\s+$/g, '');
		try {
			ips.push(ipaddr.process(ip).toString());
		} catch(e) {}
	}
	return ips;
};
