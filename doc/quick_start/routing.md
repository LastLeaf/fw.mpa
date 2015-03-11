# fw.mpa Quick Start #

## Client Coding ##

Routes contain the sub-page structure and source location. Here's an example:

```js
module.exports = function(app){
	// ...
	// routing
	app.route.set('/', {
		style: 'index.css',
		tmpl: 'index.tmpl',
		lib: 'libs/jquery.js',
		main: 'index.js'
	});
	// ...
};
```

In the example above, "/" route is defined.
It means that when "/" of the host is visited, the page should load index.css (as css), index.tmpl (as templates), libs/jquery.js (as js lib), and index.js (as js main).
When it's loaded, the function defined using `fw.main(...)` in main.js will be executed.

How about a page containing several sub-pages?

```js
module.exports = function(app){
	// ...
	// routing
	app.route.set('/', {
		style: 'index.css',
		tmpl: 'index.tmpl',
		lib: 'libs/jquery.js',
		main: 'index.js',
		parent: 'body'
	});
	app.route.set('/about', {
		main: '404.js',
		parent: 'body'
	});
	app.route.set('body', {
		script: 'body.js',
		parent: 'global'
	});
	app.route.set('global', {
		style: 'global.css'
	});
	// ...
};
```

The example above contains 4 sub-pages.
"/" and "/about" has a parent sub-page "body", while "body" has a parent "global".
Notice that when you browsing from "/" to "/about", the "/" sub-page is unloaded (an event is emitted) and "*" will be loaded (main functions are called), but "body" sub-page is not changed at all!

Most of the time, you need define a "*" route to provide a 404 page.
Variables are also allowed. See the example below.

```js
module.exports = function(app){
	// ...
	// routing
	app.route.set('/*', {
		main: '404.js',
		parent: 'body'
	});
	app.route.set('/user/:id/datails', {
		main: '404.js',
		parent: 'body'
	});
	// ...
};
```

In the second route above, ":id" is a variable. This route matches paths like "/user/ME/details". The variable's value can be visited by `fw.getArgs().id`.

An app may contain a lot of routes. Another API `app.route.setList(...)` is provided, so that you can write your routes in JSON.

```js
var routes = {
	"/": {
		"tmpl": "index.tmpl",
		"main": "index.js",
		"parent": "global"
	},
	"*": {
		"main": "404.js"
	},
	"global": {
		"style": "global.css",
		"main": "global.js"
	}
};
module.exports = function(app){
	app.route.setList(routes);
};
```
