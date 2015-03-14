# fw.mpa Basic Topics #

## Server Side Rendering ##

Client side rendering is really cool.
We are able to extract all static structures and contents out, caching them in browsers, or using them to make apps.
Dynamic data is always transferred in JSON form.
It is clear and simple.

fw.mpa loves client side rendering. However, server side rendering is sometimes required.
The most important reason: most search engines do not execute JavaScript, so it is impossible to render by robots.
In this case, server side rendering is not avoidable.

Server side rendering breaks the basic model and concept of fw.mpa, so you would feel uncomfortable when writing rendering code.
Please use AS LESS AS POSSIBLE.

### Writing Rendering Code ###

A "render" directory is needed to be binded before coding.

```js
app.bindDir('render', 'render');
```

In the server side rendering model, a render file renders for a sub-page.
The render code act as a "filter".
A `childRes` argument is passed to the rendering function.
The function should process it.
`childRes` is initialized like below.

```json
{
	"statusCode": 200,
	"extraHead": "",
	"title": "",
	"content": ""
}
```

`statusCode` is the HTTP status code.
`extraHead` will be inserted into html head.
`title` is the page title.
`content` will be inserted into html body.

Here is a sample render file to render a 404 page.

```js
// render: 404.js
module.exports = function(conn, args, childRes, next){
	childRes.statusCode = 404;
	childRes.title = 'Not Found';
	childRes.content = '404 Not Found';
	next(childRes);
};
```

Then add it to the 404 sub-page in the routes.

```js
app.route.set('*', {
	parent: 'global',
	render: '404.js'
});
```

Now the rendering function will be called when visiting a 404 page.
The `args` argument above is the map of variables and their values in routes.
Here, `args['*']` will be the path visiting by user.

If multiple sub-pages in stack need rendering, the rendering function of child sub-pages are always called before their parents.
It means the parent sub-pages have the abilities to process and integrate the results of their children.

### Handle Rendering in Client ###

Rendering is finished in server side, before any client code execution.
Generally it does not affect client code.
However, when a page switching is triggered and several new sub-pages are loading, if they required server side rendering, REMEMBER to handle it manually!

Consider this: your index sub-page and 404 sub-page are children of global sub-page.
When a visitor jumps from index to 404, 404 page requires rendering, and you have to handle it on global sub-page!

In this kind of situation, the most-child unchanged sub-page will receive a `render` event, with the render result `childRes` as the first argument.
An example to handle this event:

```js
fw.main(function(pg){
	pg.on('render', function(childRes){
		document.title = childRes.title;
		document.body.innerHTML = childRes.content;
	});
});
```

Take care of this in the parent sub-page of all sub-pages that needed server side rendering.
