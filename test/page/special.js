// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = function(app){
	return function(req, res){
		app.rpc(req.session, '/echo', 'Hello world! (from special page)', function(r){
			res.send(r);
		});
	};
};