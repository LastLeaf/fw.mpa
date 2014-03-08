// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var hello = fw.module('helloworld.js');

module.exports = function(conn, args, res){
	res(args);
	if(conn.msg)
		setTimeout(function(){
			conn.msg('echo', hello);
		}, 2000);
};