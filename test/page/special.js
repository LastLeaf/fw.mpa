// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = function(req, res){
	fw.rpc(req.conn, '/echo', 'Hello world! (from special page)', function(r){
		res.send(r);
	});
};