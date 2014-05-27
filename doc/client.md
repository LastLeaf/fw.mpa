# fw.mpa Documentation #

## Guide - Client Side Code ##

### Client Coding ###

Client side javascript code, stylesheets, and templates are placed in `client/`. fw.mpa is binded with [Handlebars](http://handlebarsjs.com/) as template engine and [stylus](http://learnboost.github.io/stylus/) as CSS preprocessor. See examples below.

```html
<!-- /client/index.tmpl -->
<tmpl id="index">
	<div class="index">{{someText}}</div>
	<a fw href="/page/not/exists">Goto 404</a>
	<a fw href="/special">Goto Special Page</a>
</tmpl>
```

Notes: the "fw" attribute in &lt;a&gt; tells the framework to prevent whole page loading when user clicks. ALWAYS have it when the &lt;a&gt; is pointed to another page inside this app or website.

```css
/* /client/index.stylus */
.index
	color red
```

Notes: you can use plain css with the ".css" extname.

```js
// /client/index.js
fw.main(function(pg){
	var tmpl = pg.tmpl;
	tmpl.index({
		someText: 'Hello world!'
	});
});
```

When anything changed in `client/`, you should change your app's version to prevent browser cache when server is not running in debug mode!

### Code Caching and Compression ###

In cache mode, your code is auto-compressed. Special routing settings can also combine your code automatically. 

However, compression is slow. Compressing big libraries such as jQuery will take several seconds. You can provide a compressed version for each js/css file individually, by naming it like ".min.js" or ".min.css".
