# fw.mpa Quick Start #

## RPC Functions ##

RPC (Remote Procedure Call) is the best way for communications between client and server.
Clients can call functions in the server, receiving results or errors asynchronously.
The arguments can be any common JavaScript values (booleans, numbers, strings, arrays and common objects).

RPC functions are defined in server side.
The files should be put in a special directory, binded as "rpc".
Usually, "rpc" directory is binded as rpc code position.

To call an RPC function, you can use `pg.rpc(path, [args...,] doneCallback, failCallback)` in client side. An example:

```js
fw.main(function(pg){
	// sample RPC
	pg.rpc('/hello/world:divide', a, b, function(res){
		// called when done
	}, function(errMessage){
		// called when error
	});
});
```

In the example above, "/hello/world:divide" is called.
You should write this function at "hello/world.js" under rpc directory.

```js
exports.divide(conn, res, a, b){
	// return an error when b is 0
	if(b === 0) res.err('B should not be 0!');
	// return result
	else res(a/b);
};
```

RPC functions should always be written in the form `func(conn, res[, args...]){ ... };`.
"conn" contains some connection data, including session as `conn.session`.
"res" is a function to return result.
"res.err" is also a function, but it return an error.
"args..." are the arguments passed by the caller in client side.
You SHOULD validate the arguments in order to prevent some attack.
