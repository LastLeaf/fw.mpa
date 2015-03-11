# fw.mpa Quick Start #

## Directory Binding ##

Directory bindings are needed before app starts. The bindings specify which directories are used by the framework.
Code below shows a common way to bind directories.

```js
module.exports = function(app){
	// ...
	// binding directory
	app.bindDir('static', 'static');
	app.bindDir('client', 'client');
	app.bindDir('rpc', 'rpc');
	// ...
};
```

The `app.bindDir(type, [logicPosition,] srcDir)` is the basic method to bind directories.
`type` is the binding type, `srcDir` is path of the dir to be binded (relative to working directory).
There are altogether six binding types. Three of them are the very basic.

* `static` the binded dir is used for serving static files.
* `client` the binded dir is used for client side coding, containing js, css, templates, etc.
* `rpc` the binded dir is used to accept RPC, containing node.js code that handles RPC.

For example, `app.bindDir('static', 'static_files')` specifies the "static_files" directory in the working directory as the position to store static files.
