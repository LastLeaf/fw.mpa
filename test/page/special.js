// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = function(app){
	return function(req, res){
		res.send('Hello world! (from special page)');
	};
};