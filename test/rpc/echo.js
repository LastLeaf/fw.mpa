// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(app){
	return function(conn, args, res){
		res(args);
		if(conn.msg)
			setTimeout(function(){
				conn.msg('echo', app.hello);
			}, 2000);
	};
};