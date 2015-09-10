# fw.mpa Basic Topics #

## Special Pages ##

Sometimes you would like to generate some dynamic contents which are not web pages, such as XML of RSS feeds.
This can be achieved by special pages.
Also, when you need to upload something through XMLHttpRequest, you need special pages.

To use the special page feature, bind a "page" directory to store special page files.

```js
app.bindDir('page', 'page');
```

Write a file to serve the special page.
This file should exports a function, which accepts `req` and `res` as arguments.
These two arguments act the same as [express](http://expressjs.com/). Read docs of express for the API of them.

```js
// page: /feed/posts.js
module.export = function(req, res){
	// e.g. res.send(...);
};
```

Then add it to routes

```js
app.route.set('/feed/posts', {
	page: '/feed/posts'
});
```

The example above can be visited from the path "/feed/posts" under the app hosts.
All method, including "POST", "PUT", and even "OPTIONS" are all redirected to this special page.
Query strings are also allowed.
