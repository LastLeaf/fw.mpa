# fw.mpa Documentation #

## Guide - Server-Side Rendering ##

fw.mpa allows server side rendering, to provide a initial page for clients without javascript support, and to provide contents for search engines. The sub-pages with server side rendering specified in routes are initially rendered in server side. The render result is passed to its parent (or to framework if it has no parent). The final parent sub-page should provide results like `{title: "the page's title", content: "some html"}`. An example:

```js
// /render/global.js
module.exports = function(conn, args, childResult, next){
	next({
		title: childResult.title,
		content: '<p>(from child)</p>' + childResult.content
	});
};
```

Notes: RPC and templates are usable. See API list.

When page switches, the child sub-page is rendered on server side, and passed to existed parent page on client side. The parent MUST handles it through the `render` event. An example:

```js
// /client/global.js
fw.main(function(pg){
	pg.on('render', function(childResult){
		document.body.innerHTML = '<p>(from child)</p>' + childResult;
	});
});
```
