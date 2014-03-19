# fw.mpa #
_a multi-page web-app and website framework_

## Introduction ##

fw.mpa is designed to be a real-time web framework suitable for both apps and websites. The framework will provide great supports for offline web-apps in future.

The key idea of this framework is preventing page reloading when page switches. It's slightly similar to _PJAX_, but the framework manages the browser history and providing an page model that is easy to understand.

Currently, fw.mpa requires node.js and mongodb on server side, and works on major browsers.

### Page Model ###

Apps and websites based on fw.mpa should follow a _Parent/Child_ page model. This model splits a page into several sub-pages with parent and child relationships. A legal page address is pointed to a child-most sub-page, and every sub-page may have a "parent" sub-page. Parent sub-pages always init before child sub-pages. When a child sub-page need to be switched to another child sub-page, the parent sub-page is not rebuilt.

Here is a clear example to show how this page model works.

* The framework keeps a stack which contains the current sub-pages. When framework inits, the stack is inited empty. `stack: []`
* The page address is pointed to sub-page C. C's parent is B, and B's parent is A. Then A is inited first and pushed into the stack. `stack: [A]`
* When A is fully loaded and inited, B follows. `stack: [A, B]`
* When B is fully loaded and inited, C follows and the whole page is loaded. `stack: [A, B, C]`
* Later, a page switching is required (e.g. user clicked an button). The new page address is pointed to D. D's parent is A. Then C in the stack is poped and unloaded. `stack: [A, B]`
* B is also unloaded. `stack: [A]`
* A is D's parent, so A is not changed. D is loaded and inited, and the whole page is loaded. `stack: [A, D]`

### Real-Time Model ###

fw.mpa is a real-time framework. It means that live connections are kept between servers and browsers. There are two ways of communication between servers and browsers: RPC and server events.

* RPC: the client can make calls to functions on servers, and can get result when needed.
* Server events: the server can push messages to clients.

A live connection is built automatically when a sub-page is inited. If disconnected unexpectedly, a new connection will be built for the sub-page.

fw.mpa uses [sockjs](https://github.com/sockjs) as low level connector. It means that Websockets is used when available, and almost all browsers are supported including IE6.

## Guide ##

### Creating New Project ###

fw.mpa apps and websites should be built in an empty project dir. Create it and install framework in it using `npm install fw.mpa`.

Then write a configure file (named `fwconfig.js`) and a start file (usually `app.js`). See the example below.

```js
// /fwconfig.js
module.exports = {
	app: {
		title: 'Hello World', // the app's title
		version: '0.0.1', // the app's version, must change when a new version is deployed
		loadingLogo: 'loading.gif', // a logo to show when page is loading or switching
		loadingLogoBackground: '#fff' // the background color of the loading logo
	},
	server: {
		port: 80, // the server port
	},
	db: {
		type: 'mongodb', // should be "mongodb" if you want to use database
		host: 'localhost', // here's some database configuration
		port: 27017,
		user: '',
		password: '',
		name: '',
	},
	secret: {
		cookie: 'This is a RANDOM and SECRET string!', // must keep SECRET!
	},
};
```
```js
// /app.js
require('fw.mpa')(__dirname);
```

Now the app should be runnable. There are three run modes for the app: debug, cache, and default.

* Debug mode: the app should always run in this mode while coding and debuging, otherwise the client side code may be cached in browsers. To run in this mode, you should specify environment varible "DEBUG": `FW=DEBUG node app.js`
* Cache mode: the app should better run in this mode on running servers. In this mode, code cache will be dynamically generated. To run in this mode, you should specify environment varible "CACHE": `FW=CACHE node app.js`
* Default mode: this mode should be used when the running environment is limited. In this mode, framework will never try to write anything to the project dir, which means that you need to provide code cache (the `cache/` generated in cache mode) manually. The framework itself will not try to restart automatically in this mode. Just do `node app.js` to run in this mode.

### Dir Structure ###

In the project dir, create several subdirs for coding.

* `client/` The client side code including js, css, and templates.
* `cache/` The client side code cache generated in cache mode. Client side code will be minimized while caching.
* `rpc/` The server side RPC functions.
* `module/` Server modules.
* `render/` The server side rendering code.
* `page/` The special page code. Special pages are generated on server side.
* `static/` Static contents. This dir has the top priority. Put static files here and they will be served to clients directly.
* `rc/` Some special resource used by the framework, described below.

Currently, special resource contains following files. These files are all optional.

* `rc/favicon.ico` The favicon for this website.
* `rc/loading.gif` The logo to show when loading. The file name is specified in `app.loadingLogo` of the configuration.
* `rc/index.html` The framework's start files to override default ones. NEVER write these files unless you know how to write correctly.

### Client Side Code ###

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

### Routes ###

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

### RPC functions ###

Client side can make RPC to server. Server code in `rpc/` will receive and send results if needed. An example:

```js
// /client/index.js
var pg = fw.getPage();
pg.rpc('/hello/world:alertSomeText', ['a', 'b'], function(res){
    alert(res);
});
```

```js
// /rpc/hello/world.js
module.exports = {
    alertSomeText: function(conn, res, args){
        res(args.toString());
    }
};
```

The first argument of `pg.rpc` is the path of the rpc file and the function need to call in this file.

You can also make server side RPC requests with `conn.rpc(...)` when framework is fully loaded.

### Server Modules ###

You can put some code in server modules if you do not want to write them in RPC functions. You can put js files or dirs with `index.js` into `module/`. They will be automatically required when framework inits. You can return a value in the callback, and visit through `fw.module(...)` in other server side files. An example:

```js
// /module/hello/index.js
module.exports = function(next){
	var hello = 'Hello world! (from modules)';
	next(hello);
}
```

Notes: Only js files and `index.js` inside dirs in `module/` itself (not its child dirs) are loaded by framework.

### Server-Side Rendering (Optional) ###

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

Notes: RPC and templates are usable. See API list below.

When page switches, the child sub-page is rendered on server side, and passed to existed parent page on client side. The parent MUST handles it through the `render` event. An example:

```js
// /client/global.js
var pg = fw.getPage();
pg.on('render', function(childResult){
	document.body.innerHTML = '<p>(from child)</p>' + childResult;
});
```

### Special Pages ###

fw.mpa allows some special pages (e.g. RSS feeds) generated indepently. The following example is a special page in address '/special/page'.

```js
// /page/special/page.js
module.exports = function(req, res){
	res.send('Hello world! (from special page)');
};
```

Notes: fw.mpa is based on [express](http://expressjs.com/). See [express document](http://expressjs.com/api.html) for the detailed usage of the `req` and `res` argument. In addition, a `conn` object is provided as `req.conn`.

### I18n Support ###

If you want i18n support, add `app.locale` in configuration. An example:

```js
// /fwconfig.js
module.exports = {
	app: {
		locale: ['en', 'zh-CN']
	}
}
```

Then for the templates you want to translate, say `index.tmpl`, create a dir `index.locale` and put translation files in it. Each file is a JSON object:

```json
{
	"original text": "translated text"
}
```

In `index.tmpl`, mark original texts out using "\`", like "\`original text\`". If you want "\`" it self, use "\`\`", and never put "\`" inside original texts (translate them out!).

If the original text is not appeared in templates, you can put them in an additional object in locale files. They will be sent to browser side and can be translated using `page.tmpl.i18n(...)`. An example:

```json
[{
	"original text": "translated text"
},{
	"additional text": "additional translation"
}]
```

Translations in the first object cannot be visited by scripts. However, they are efficient because they are just cached in the translated templates when server starts.

## API List ##

Client side: the `fw` object (window.fw).

* `fw.main(func)` Define the main function. The function get a sub-page object.
* `fw.getPage()` Get the current loading sub-page object.
* `fw.getArgs()` Get the current page's arguments. For example, when the route '/a/:varA/b/varB' matches the current address '/a/1/b/2', the args are {varA: 1, varB: 2}.
* `fw.getPath()` Get the current address.
* `fw.go(where)` Switch page. If `where` is an address, just switch to it. If `where` is a number (+/-n), go fore/back n steps in browser history. Return whether success.
* `fw.redirect(address)` Redirect to another address. This will not leave current address in the history. Return whether success.
* `fw.isLoading()` Return switching status.
* `fw.stopLoading()` Stop loading current page.
* `fw.uuid()` Generate an UUID.
* `fw.host` (Read-Only) The host of this page. Equals to `location.host`.
* `fw.language` (Read-Only) The language used for the client. It's one of the `app.locale` in configuration, or an empty string.
* `fw.selectLanguage([prefer])` Select the language used for the client. A preferred locale can be given, or the framework will auto-select one. This call will trigger a page reload immediately.
* `fw.debug` (Read-Only) Whether server is in debug mode.
* `fw.version` (Read-Only) App or website's version. It's set in fw.mpa configuration.
* `fw.timeout` (Read-Only) The server timeout. It's set in fw.mpa configuration.
* `fw.onserverchanged` A function to call when server updates (version given as first argument) or session losts is detected. In default, it just reload the whole page.
* `fw.loadingLogo.disabled` Whether loading logo is disabled. It's false by default if loading logo is set in configuration.
* `fw.loadingLogo.opacity(num)` Set the opacity of the loading logo.

Client side: the sub-page object.

* `page.tmpl` (Read-Only) The templates. It's a hash from tmpl ID to Handlebars rendering functions.
* `page.tmpl.i18n(text)` The i18n function, translating the provided text.
* `page.readyState` (Read-Only) The ready state of this page.
* `page.destroyed` (Read-Only) Whether this page is destroyed. Remember to check it in async callbacks!
* `page.parent` (Read-Only) The parent page object.
* `page.routeId` (Read-Only) Get the route name. Notice that this name is normalized by framework. It may be useful for debugging.
* `page.rpc(func, [args, ...], [callback, [timeoutCallback]])` Make an RPC.
* `page.form(form, [callback, [timeoutCallback]])` Send &lt;form&gt; as RPC. &lt;form&gt; should be written in templates with "action" and "method" attributes. "action" and "method" are used to locate the PRC function.
* `page.msg(event, func)` Bind a function to a server event.
* `page.msgOff(event, func)` Unbind a function from a server event.
* `page.on(event, func)` Bind a function to an event. The available events are listed below.
* Event `childLoadStart` The child page is about to be loaded. Always triggered before child's `load`.
* Event `render` The child is rendered. Trigged when server rendering is needed by descendants (before its `load`). The binded function receives an argument representing the rendering result.
* Event `load` The page is successfully loaded. Triggered after main functions.
* Event `childLoadEnd` The child page is loaded. Always triggered after child's `load`.
* Event `childLoadStop` The child page loading is aborted.
* Event `socketConnect` A new connection is built for this sub-page. Always triggered after `load`.
* Event `socketDisconnect` The connection is lost. Some server events may not be received, so you may have to check something when `socketConnect` is triggered again.
* Event `unload` The page is unloaded. NOT triggered when the page is hard reload or left. NOT suggested to use (use parent's `childUnload` instead).
* Event `childUnload` The child page is unloaded. Always triggered after child's `unload`.

Server side: the `fw` object (global.fw).

* `fw.debug` (Read-Only) Whether server is in debug mode.
* `fw.config` (Read-Only) The fw.mpa configuration.
* `fw.currentLoading` (Read-Only) The current loading file (or dir of server modules) while framework initialing.
* `fw.tmpl(file)` Load a template file. ONLY available while framework initialing, so call it at the beginning of files. The file path is relative to `fw.currentLoading`. It returns an object containing all template functions. The i18n function is also provided in the returning object.
* `fw.db` An object for visiting database. If database type is set to "mongodb", this is an [mongoose](http://mongoosejs.com/) object. Otherwise, it's null.
* `fw.module(name)` Get a server module. Returns the return value of the specified server module.
* `fw.restart()` Restart app in debug or cache mode, or simply exit in default mode. Take care when using this method. Notice that every time you modify `fwconfig.js`, server will automatically call this method.

RPC and server side rendering: the `conn` object (represent a connection from sub-page, a rendering request, or a special page request).

* `conn.rpc(func, [args, ...], [callback])` Make an RPC from server side.
* `conn.msg(event, [args, ...])` Send an event to the sub-page. When reconnected, the conn object is rebuilt, so ALWAYS notify servers to use new conn object when reconnected (considering `socketConnect` event of sub-pages). ONLY available in RPC from clients.
* `conn.on(event, func)` Bind a function to an event. Currently there's only a "close" event, trigged when connection is closed. ONLY available in RPC from clients.
* `conn.session` The session object. You can write session data here. Session data is shared in connections from one browser.
* `conn.session.save(callback)` Save session data to the database.
* `conn.host` The host (domain name with port) of the client.
* `conn.language` (Read-Only) The language used for the client. It's one of the `app.locale` in configuration, or an empty string. NOT available in RPC from clients.
* `conn.selectLanguage([prefer])` Select the language used for the client. A preferred locale can be given, or the framework will auto-select one. NOT available in RPC from clients.

# Development Status #
fw.mpa is still in early development. See issues if you are interested. It cannot run on Windows currently.

# LICENSE #
Copyright 2014 LastLeaf, MIT License.
