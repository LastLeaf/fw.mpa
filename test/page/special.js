// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = function(req, res){
	req.conn.rpc('/echo', 'Hello world! (from special page)', function(r){
		res.send(r);
	});
};