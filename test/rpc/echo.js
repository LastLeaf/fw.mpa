// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(app){
	return function(conn, args, res){
		res(args);
		setTimeout(function(){
			conn.msg('echo', 'Hello world! (alert)');
		}, 2000);
	};
};