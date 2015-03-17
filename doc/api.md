# fw.mpa API List #

### Client Side API ###

Client side: the `fw` object (window.fw).

* `fw.main(func)` Define the main function. The `func` receives sub-page object `pg` and submodule object `subm` as arguments.
* `fw.mainAsync(func)` Define a async main function. The `func` receives sub-page object `pg`, submodule object `subm`, and a callback `cb` as arguments. Call the callback function after loading jobs done.
* `fw.getPage()` Get the top (most-child) sub-page object in stack.
* `fw.getArgs()` Get current page's arguments. For example, when the route '/a/:varA/b/:varB' matches the current address '/a/1/b/2', the args are {varA: 1, varB: 2}.
* `fw.getPath()` Get current visiting path.
* `fw.go(where)` Switch page. If `where` is an address, just switch to it. If `where` is a number (+/-n), go fore/back n steps in browser history. Return whether success.
* `fw.redirect(address)` Redirect to another address. This will not leave current address in the history. Return whether success.
* `fw.open(address)` Open address in another window or tab. 
* `fw.isLoading()` Return loading status.
* `fw.stopLoading()` Stop loading current page.
* `fw.uuid()` Generate an UUID.
* `fw.mode` (Read-Only) Tell the client runs in "web" mode or "app" mode.
* `fw.host` (Read-Only) The host of this page. Equals to `location.host`.
* `fw.language` (Read-Only) The language used for the client. It's one of the `app.locale` in configuration, or an empty string.
* `fw.selectLanguage([prefer])` Select the language used for the client. A preferred locale can be given, or the framework will auto-select one. This call will trigger a page reload immediately.
* `fw.debug` (Read-Only) Whether server is in debug mode.
* `fw.timeout` (Read-Only) The server timeout. It equals to "server.timeout" in fw.mpa configuration.
* `fw.version` App or website's version ("app.version" in fw.mpa configuration), loaded when framework inits. It's almost read-only, but if you want the client side code to ignore the server code changes, you can modify it to the server's latest version.
* `fw.fwVersion` (Read-Only) Version of fw.mpa.
* `fw.onserverchanged` A function to call when server's version changed (server's latest version given as first argument). In default, it just reload the whole page in web mode, and do nothing in app mode.
* `fw.onsessionlost` A function to call when session information on the server is lost. In default, it just reload the whole page.
* `fw.loadingLogo.disabled` Whether loading logo is disabled. It's false by default if loading logo is set in configuration.
* `fw.loadingLogo.opacity(num)` Set the opacity of the loading logo.

Client side: the sub-page object `pg`.

* `pg.lib` (Read-Only) An array of the exports from libs in this sub-page.
* `pg.subm` (Read-Only) An array of submodule objects loaded in this sub-page.
* `pg.tmpl` (Read-Only) The templates. It's a hash from tmpl ID to Handlebars rendering functions (and json objects in the tmpl file).
* `pg.tmpl.i18n(text)` The i18n function, translating the provided text.
* `pg.require(path, cb)` Load a script, stylesheet, template file, or submodule into this sub-page. The exports, templates, or submodule object will be passed to `cb` as the first argument.  
* `pg.readyState` (Read-Only) The ready state of this page.
* `pg.destroyed` (Read-Only) Whether this page is destroyed. Remember to check it in async callbacks!
* `pg.parent` (Read-Only) The parent sub-page object.
* `pg.route` (Read-Only) Get the processed route. It may be useful in debugging.
* `pg.routeId` (Read-Only) Get the route name. This name is normalized by framework. It may be useful for debugging.
* `pg.rpc(rpcFunc, [args, ...], [callback, [errorCallback]])` Make an RPC. Server can respond an error through `res.err`. If there's an timeout error, `errorCallback` is called with no arguments.
* `pg.form(form, [readyCallback, [callback, [errorCallback]]])` Send a html form as RPC. &lt;form&gt; should be written in templates with "action" and "method" attributes. "action" and "method" are used to locate the PRC function.
* `pg.msg(event, func)` Bind a function to a server event.
* `pg.msgOff(event, func)` Unbind a function from a server event.
* `pg.on(event, func)` Bind a function to an event. The available events are listed below.
* Event `childLoadStart` The child sub-page is about to be loaded. Always triggered before child's `load`.
* Event `render` The child is rendered. Trigged when server rendering is needed by descendants (before its `load`). The binded function receives an argument representing the rendering result.
* Event `load` The page is successfully loaded. Triggered after main functions.
* Event `childLoadEnd` The child sub-page is loaded. Always triggered after child's `load`.
* Event `childLoadStop` The child sub-page loading is aborted.
* Event `socketConnect` A new connection is built for this sub-page. Always triggered after `load`.
* Event `socketDisconnect` The connection is lost. Some server events may not be received, so you may have to check something when `socketConnect` is triggered again.
* Event `unload` The page is unloaded. NOT triggered when the page is hard reload or left. NOT suggested to use (use parent's `childUnload` instead).
* Event `childUnload` The child sub-page is unloaded. Always triggered after child's `unload`.

### Server Side API ###

Server side: the `fw` object (global.fw).

* `fw.debug` (Read-Only) Whether server is in debug mode.
* `fw.mode` (Read-Only) The current running mode.
* `fw.config` (Read-Only) The fw.mpa configuration.
* `fw.currentLoading` (Read-Only) The current loading file path (or directory path of complex server modules) while framework initialing.
* `fw.tmpl(file)` Load a template file. ONLY available while framework initialing, so call it at the beginning of files. The file path is relative to `fw.currentLoading`. It returns templates constructor which requires an `conn` object as the first argument to create templates. The templates containing all template functions (and json objects in the tmpl file). The i18n function is also provided.
* `fw.module(name)` Get a server module. Returns the return value of the specified server module. ONLY available while framework initialing (as above), so call it at the beginning of files.
* `fw.restart()` Restart framework. Cannot be used in "limited" running mode.
* `fw.createApp(appStartFile [, args...], cb)` Create a new app. Arguments are allowed to be sent to new app. 

Server side: the `app` object.

* `app.enabled` (Read-Only) Whether app is started.
* `app.destroyed` (Read-Only) Whether app is destroyed.
* `app.readyState` (Read-Only) The ready state of app.
* `app.config` The app configuration.
* `app.start(cb)` Start serving.
* `app.stop(cb)` Stop serving.
* `app.restart(cb)` Restart serving.
* `app.destroy(cb)` Destroy the app. Will stop is before destroy.
* `app.bindDir(type, [prefix,] codeDir)` Bind a directory to a prefix. `prefix` is default to "/". `type` should be one of "client", "module", "page", "render", "rpc", and "static".
* `app.clearBindings([type])` Clear one type of directory bindings, or clear all directory bindings if `type` is not given.
* `app.setConfig(configObject)` Set app configuration. The `configObject` will be merged with the existing configuration.
* `app.route.set([base], routeId, route)` Set a route. `base` is the base path for all relative paths in this route, including routeId.
* `app.route.setList([base], routeList)` Set a list of routes. `routeList` is a map of routeIds and routes. `base` behaves the same as above.
* `app.route.add([base], routeId, extraRoute)` Append some scripts, stylesheets, templates, or submodules to a route. The `extraRoute` will be merged with existing route, but single value fields (e.g. "reload") will be ignored.
* `app.route.clear()` Clear all routes.
* `app.db` An object for visiting database. It's null if no database is binded.

RPC and server side rendering: the `conn` object (represent a connection from sub-page, a rendering request, or a special page request).

* `conn.rpc(rpcFunc, [args, ...], [callback, [errorCallback]])` Make an RPC from server side.
* `conn.msg(event, [args, ...])` Send an event to the sub-page. When reconnected, the conn object is rebuilt, so ALWAYS notify servers to use new conn object when reconnected (considering `socketConnect` event of sub-pages). ONLY available in RPC from clients.
* `conn.on(event, func)` Bind a function to an event. Currently there's only a `close` event, trigged when connection is closed. ONLY available in RPC from clients.
* `conn.app` (Read-Only) The app object.
* `conn.session` The session object. You can write session data here. Session data is shared in connections from one browser.
* `conn.session.id` (Read-Only) The session ID.
* `conn.session.save(cb)` Save session data to database.
* `conn.session.reload(cb)` Reload session data from database.
* `conn.host` (Read-Only) The host (domain name with port) requested by the client.
* `conn.ip` (Read-Only) The remote address (nearest proxy address) of the client.
* `conn.ip` (Read-Only) The remote addresses of the client. The proxy addresses are resolved.
* `conn.headers` (Read-Only) The request headers. You can read user-agent from here.
* `conn.language` (Read-Only) The language used in the client. It's one of the `app.locale` in configuration, or an empty string. NOT available in RPC from clients.
* `conn.selectLanguage([prefer])` Select the language used in the client. A preferred locale can be given, or the framework will auto-select one. NOT available in RPC from clients.
