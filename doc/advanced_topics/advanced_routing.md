# fw.mpa Advanced Topics #

## Advanced Routing ##

Routes decide sub-page resources and relations.
There are flexible ways to work with routes, so that you can build complicated systems with ease.

### Routing Base ###

`app.route.set([base,] routeId, route)` allows an optional `base` argument (default to '/').
It specifies the path that all relative paths should be relative to.
`routeId` is also a relative path unless it starts with "/".

```js
app.route.set('/hello', './world', {
	main: 'helloworld.js'
});
app.route.set('/hello', '*', {
	main: 'hello.js'
});
```

In the example above, the `routeId`s will be parse to "/hello/world" and "/hello/*" (404 under "/hello").
You should have at least one "/" or "*" character in `routeId`, otherwise it will be recognized as parents of other sub-pages.

You can also specify "base" field in the route object.
In this way, `routeId` is not influenced by the base.

```js
app.route.set('/hello/world', {
	base: '/hello',
	main: 'helloworld.js'
});
```

### Special Usage of Parents ###

"parent" fields are also influenced by base.
When finding parent of a sub-page, it will try to find the parent in the same base.
If not found, it searches parent in ancestors of the base path.
See the example below.

```js
app.route.set('global', { /* ... */ }); // defined sub-page "global:/"
app.route.set('/hello', 'global', { /* ... */ }); // defined sub-page "global:/hello"
app.route.set('/hello', './', { parent: 'global' }); // will match "global:/hello"
app.route.set('/another', './path', { parent: 'global' }); // will match "global:/"
```

Common `routeId`s are also allowed to be the parent of other sub-pages.
This feature is quite useful in some cases.
The example below shows a way to pop a window that can be closed through history back, or back key in mobile devices.

```js
app.route.set('/user/:userId', { /* ... */ });
app.route.set('/user/:userId/addFriendConfirm', {
	parent: '/user/:userId',
	tmpl: 'add_friend_confirm.tmpl',
	main: 'add_friend_confirm.js'
});
```

In the example above, when you switch from "/user/somebody" to "/user/somebody/addFriendConfirm", no sub-page is unloaded, but a sub-page with a "main" script is loaded.
You can show a popup in the script.

### Special Routing Fields ###

Besides common routing fields including "lib", "main", "parent", "style", "subm", "tmpl", and "base" (we mentioned above), some special fields are also allowed.

* "redirect" field allow an auto-switching to another path.
* "reload" field force a page refresh when loading/unloading a sub-page. Possible values are "in" (when loading), "out" (when unloading), and "both".

"lib", "main", "style", "subm", and "tmpl" allow multiple values.
Writing values in an array should works, and `app.route.add([base,] routeId, route)` can append values to these fields.
What's more, you can select files with `userAgent`.
An example with all fields:

```js
app.route.set('global', {
	style: ['reset.css', 'global.css'],
	lib: [{
			src: '/lib/jquery-1.11.1',
			userAgent: 'MSIE (6|7|8)\.'
		}, {
			src: '/lib/jquery-2.1.1',
			userAgent: '^.*(?!MSIE (6|7|8)\.)'
		}]
});
app.route.set('*', {
	redirect: '/' // "redirect" field is exclusive
});
app.route.set('/', {
	base: '/',
	parent: 'global',
	subm: 'utils.subm',
	tmpl: 'index.tmpl',
	main: 'index.js',
	reload: 'both'
});
```
