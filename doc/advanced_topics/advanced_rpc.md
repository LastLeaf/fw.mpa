# fw.mpa Advanced Topics #

## Advanced RPC ##

RPC is the most important way to visit server code from client.

### RPC Middleware ###

RPC supports simple middlewares.
Considering an RPC path "/myRpcFile:a.b", usually, "exports.a.b(...)" in "myRpcFile.js" is called to handle this RPC request.
However, if "exports.a" is a function, it will be executed before "exports.a.b".
Furthermore, if "module.exports" is also a function, it will be executed before them.
Here, "module.exports(...)" and "exports.a(...)" are middlewares.
See the example below.

```js
// RPC: myRpcFile.js

module.exports = function(conn, res, arg){
	if(typeof args !== 'string') {
		res.err('Arguments Illegal'); // middlewares can call res() or res.err() to respond directly (middlewares and handler followed are ignored)
	} else {
		res.next(); // or pass the request to next middleware or handler
	}
};

module.exports.a = function(conn, res, arg){
	// in `res.next(...)`, middlewares can register functions to filter response passed by res() or res.err() from next middleware or handler
	res.next(function(msg){
		// executed when res() is called, arguments are from res(...)
		// do something here
		res(msg);
	}, function(errMsg){
		// executed when res.err() is called, arguments are from res.err(...)
		// do something here
		res.err(errMsg);
	});
};

module.exports.a.b = function(conn, res, arg){
	// do something here
	// do not forget to call res(...) or res.err(...)
	// here just echo arg
	res(arg);
};
```

### RPC from HTML Forms ###

### Server Side RPC ###
