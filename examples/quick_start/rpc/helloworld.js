// Copyright 2015 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

exports.divide = function(conn, res, a, b){
	// Ensure argument types
	a = Number(a) || 0;
	b = Number(b) || 0;
	// return an error when b is 0
	if(b === 0) res.err('B should not be 0!');
	// return result
	else res(a/b);
};
