// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(next){
	fw.hello = 'Hello world! (from modules)';
	next();
};