# fw.mpa Basic Topics #

## Server Modules ##

A web system usually contains some basic services or facilities.
They are seen as "models" in the classic MVC structure.
In fw.mpa, you would like low-level structures (e.g. database models, mailing systems) to be separated and decoupled from RPC functions.
This can be achieved through server modules.

Server modules are loaded before app accepts requests.
You can do some async jobs to ensure your low-level service is ready before accepting RPC.
RPC functions can visit any server modules they need.

To write server modules, you should first binding directories where server module files locates.
Your directory should binded as type "module".

```js
app.bindDir('module', 'module');
```

You can write several modules in "module" directory.
Each module should export a function, which accepts the `app` object and a callback function.
When finished loading and initializating, call the callback with an object that can be called by other server code.

```js
// module: running_time.js
module.exports = function(app, cb){
	var startTime = Date.now();
	cb({
		getStartTime: function(){
			return startTime;
		},
		getRunningTime: function(){
			return Date.now() - startTime;
		}
	});
};
```

The example above creates a module called "running_time".
The object passed in callback will be the interface to visit this module.
You can load this module in RPC functions as below:

```js
var rt = fw.module('/running_time.js');

exports.runningTime = function(conn, res){
	rt.getRunningTime() // => the running time
};
```

If you want to write a big module that contains several files, you can put a directory into "module" directory.
The directory should contain a "index.js" file. This file should be written like the module file above.
To load this kind of module, use the directory path.

You cannot expect the loading order of several modules in a "module" directory.
Dependencies between server modules are still allowed, but do not make too many such dependencies for it prevents parallel module loading.
Read [Advanced Directory Binding](../advanced_topics/advanced_dir_binding.md) for details.
