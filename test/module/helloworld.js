// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(next){
	var hello = 'Hello world! (from modules)';
	next(hello);
};