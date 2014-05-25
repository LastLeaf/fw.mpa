# fw.mpa Documentation #

## Guide - RPC Functions, Server Messages and Server Modules ##

### RPC Functions and Server Messages ###

Client side can make RPC to server. Server code in `rpc/` will receive and send results if needed. An example:

```js
// /client/index.js
fw.main(function(pg){
	pg.rpc('/hello/world:alertSomeText', ['a', 'b'], function(res){
    	alert(res);
	});
});
```

```js
// /rpc/hello/world.js
module.exports = {
    alertSomeText: function(conn, res, args){
        res(args.toString());
    }
};
```

The first argument of `pg.rpc` is the path of the rpc file and the function need to call in this file. The server function can respond with the `res` argument, or report an error with `res.err(arg1, arg2, ...)`.

Server-side code can send events to the client after an RPC, using `conn.msg(...)`. However, the `conn` got from an RPC will be rebuilt when the client is dropped and reconnected. You would like the `socketConnect` event when using the server events. See the API List for detail.

You can also make server side RPC requests with `conn.rpc(...)` when framework is fully loaded.

Middleware is also supported. An example:

```js
// /client/index.js
fw.main(function(pg){
	pg.rpc('/hello/world:middle.func', function(res){
    	alert(res);
	});
});
```

```js
// /rpc/hello/world.js
module.exports = function(conn, res, args){
	console.log('This is the first middleware.');
	res.next();
};
module.exports.middle = function(conn, res, args){
	console.log('This is the second middleware.');
	res.next();
};
module.exports.middle.func = function(conn, res, args){
	res('The middlewares works!');
};
```

### Server Modules ###

You can put some code in server modules if you do not want to write them in RPC functions. You can put js files or dirs with `index.js` into `module/`. They will be automatically required when framework inits. You can return a value in the callback, and visit through `fw.module(...)` in other server side files. An example:

```js
// /module/hello/index.js
module.exports = function(next){
	var hello = 'Hello world! (from modules)';
	next(hello);
}
```

Notes: Only js files and `index.js` inside dirs in `module/` itself (not its child dirs) are loaded by framework.
