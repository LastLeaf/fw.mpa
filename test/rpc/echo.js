// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = function(app){
	return function(req, res, data){
		res.send(data);
	};
};