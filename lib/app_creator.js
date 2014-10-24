// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(path, cb){
	var app = {};

	// TODO

	require(path)(app, function(){
		cb(app);
	});
};
