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

Using multi-bindings can also implement middlewares.
Functions in higher priority bindings can response directly using `res(...)` and `res.err(...)`, or drop to lower priority bindings with `res.next(...)`.
This can help inject functions to RPC requests in plugin systems.

### RPC from HTML Forms ###

When submitting forms, you usually love to send through RPC requests.
Framework provides an API `pg.form(formElem, readyCb, doneCb, errorCb)` to help submit forms.
The form will be sent as an RPC request.
Data fields are combined into an JavaScript object, sent as the first argument of the request.
See the example below.

```html
<tmpl id="divideForm">
	<form id="divide" action="/myRpcFile" method="divide">
		A = <input type="text" name="numA">
		B = <input type="text" name="numB">
		<input type="submit" value="Submit">
	</form>
</tmpl>
```

In the form above, the RPC path "/myRpcFile:divide" is written into the form attributes.
Now insert the form into DOM.

```js
fw.main(function(pg){
	document.body.innerHTML = tmpl.divideForm();
	var form = document.getElementById('divide');
	pg.form(form, function(){
		// execute before form submit as RPC request
		// you can validate form data here
		// return false if you want to cancel
	}, function(res){
		// success, do something here
	}, function(err){
		// error, do something here
	});
});
```

Your form data will be extracted from input, select, and textarea elements.
The values are strings, or an array of strings (if multiple elements have the same name).
Unchecked checkboxes will not be sent.

### Server Side RPC ###

You can also make RPC requests from server code.
The `conn` object provides an API `conn.rpc(rpcPath, [args...,] [cb, [errorCb]])`.
The argument format is the same as common client side RPC, but server side RPC does not have a timeout.
Server messages cannot be used when accepting RPC requests from server side.
