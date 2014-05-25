# fw.mpa Documentation #

## Guide - Routing ##

Routes are the definition of sub-pages. Files named `routes.js` in `client/` (and its child dirs) contain all routes. If more than one routes files are found, they will be combined before send to clients. Routes files will not be sent to clients directly. An example:

```js
module.exports = {
	global: {
		main: "/global",
		lib: "http://code.jquery.com/jquery-1.10.1.min.js"
	},
	"./": {
		parent: "global",
		main: "index",
		tmpl: "index",
		style: ["index"]
	},
	"*": {
		parent: "global",
		main: "404.js"
	}
}
```

A route is a `name: object` item in routes.

The name of a route can be a path (relative path recommanded, e.g. `./path/:var1/and/:var2`), a wildcard (404 page, e.g. `./path/*`), or a string identifier (only `[a-z0-9_]+` allowed). You should NEVER use confusing routes.

The detailed page definition is listed in the object. The definition can include:

* `"redirect"` The sub-page that need to be redirected to.
* `"parent"` The parent sub-page of this sub-page.
* `"main"` The javascript file(s) that contain(s) main function of this page.
* `"lib"` The javascript librarie(s) that should be ready before loading.
* `"tmpl"` The template file(s) needed in this sub-page.
* `"style"` The css file(s) that should be ready before loading.
* `"render"` The server side rendering file.
* `"reload"` An option to force page reloading when switch in or out this sub-page. Its value can be "in", "out", or "both".

Notes: the ".js" of javascript files, ".stylus" of stylus files, and ".tmpl" of template files can be omitted. Paths are relative to the routes file location, unless there's "/" in front-most (which means relative to `client/`).
