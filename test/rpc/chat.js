// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var conns = {};

module.exports = {
	speak: function(conn, args, res){
		if(typeof(args) !== 'object') return;
		for(var i in conns)
			conns[i].msg('speak', conn.username+': '+args.text);
		setTimeout(res, 1000);
	},
	reg: function(conn, args, res){
		if(!conn.username) {
			conn.username = Math.floor(Math.random()*9000)+1000;
			conns[conn.username] = conn;
			conn.on('close', function(){
				delete conns[conn.username];
			});
		}
	}
};