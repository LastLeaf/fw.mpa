# fw.mpa Documentation #

## API List ##

Client side: the `fw` object (window.fw).

* `fw.main(func)` Define the main function. The function get a sub-page object.
* `fw.getPage()` Get the current loading sub-page object.
* `fw.getArgs()` Get the current page's arguments. For example, when the route '/a/:varA/b/varB' matches the current address '/a/1/b/2', the args are {varA: 1, varB: 2}.
* `fw.getPath()` Get the current address.
* `fw.go(where)` Switch page. If `where` is an address, just switch to it. If `where` is a number (+/-n), go fore/back n steps in browser history. Return whether success.
* `fw.redirect(address)` Redirect to another address. This will not leave current address in the history. Return whether success.
* `fw.open(address)` Open address in another window or tab. 
* `fw.isLoading()` Return switching status.
* `fw.stopLoading()` Stop loading current page.
* `fw.uuid()` Generate an UUID.
* `fw.host` (Read-Only) The host of this page. Equals to `location.host`.
* `fw.language` (Read-Only) The language used for the client. It's one of the `app.locale` in configuration, or an empty string.
* `fw.selectLanguage([prefer])` Select the language used for the client. A preferred locale can be given, or the framework will auto-select one. This call will trigger a page reload immediately.
* `fw.debug` (Read-Only) Whether server is in debug mode.
* `fw.timeout` (Read-Only) The server timeout. It's set in fw.mpa configuration.
* `fw.version` App or website's version (set in fw.mpa configuration), loaded when framework inits. It's almost read-only, but if you want the client side code to ignore the server code changes, you can modify it to the server's latest version.
* `fw.onserverchanged` A function to call when server code updates (server's latest version given as first argument). In default, it just reload the whole page in web mode, and do nothing in app mode.
* `fw.onsessionlost` A function to call when session information on the server is lost. In default, it just reload the whole page.
* `fw.loadingLogo.disabled` Whether loading logo is disabled. It's false by default if loading logo is set in configuration.
* `fw.loadingLogo.opacity(num)` Set the opacity of the loading logo.

Client side: the sub-page object.

* `page.tmpl` (Read-Only) The templates. It's a hash from tmpl ID to Handlebars rendering functions (and json objects in the tmpl file).
* `page.tmpl.i18n(text)` The i18n function, translating the provided text.
* `page.readyState` (Read-Only) The ready state of this page.
* `page.destroyed` (Read-Only) Whether this page is destroyed. Remember to check it in async callbacks!
* `page.parent` (Read-Only) The parent page object.
* `page.routeId` (Read-Only) Get the route name. Notice that this name is normalized by framework. It may be useful for debugging.
* `page.rpc(func, [args, ...], [callback, [errorCallback]])` Make an RPC. Server can respond an error through `res.err`. If there's an timeout error, errorCallback is called with no arguments.
* `page.form(form, [readyCallback, [callback, [timeoutCallback]]])` Send &lt;form&gt; as RPC. &lt;form&gt; should be written in templates with "action" and "method" attributes. "action" and "method" are used to locate the PRC function.
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
* `fw.tmpl(file)` Load a template file. ONLY available while framework initialing, so call it at the beginning of files. The file path is relative to `fw.currentLoading`. It returns templates constructor which requires an `conn` object as the first argument to create templates. The templates containing all template functions (and json objects in the tmpl file). The i18n function is also provided.
* `fw.db` An object for visiting database. If database type is set to "mongoose", this is an [mongoose](http://mongoosejs.com/) object. Otherwise, it's null.
* `fw.module(name)` Get a server module. Returns the return value of the specified server module.
* `fw.restart()` Restart app in debug or cache mode, or simply exit in default mode. Take care when using this method. Notice that every time you modify `fwconfig.js`, server will automatically call this method.

RPC and server side rendering: the `conn` object (represent a connection from sub-page, a rendering request, or a special page request).

* `conn.rpc(func, [args, ...], [callback])` Make an RPC from server side.
* `conn.msg(event, [args, ...])` Send an event to the sub-page. When reconnected, the conn object is rebuilt, so ALWAYS notify servers to use new conn object when reconnected (considering `socketConnect` event of sub-pages). ONLY available in RPC from clients.
* `conn.on(event, func)` Bind a function to an event. Currently there's only a "close" event, trigged when connection is closed. ONLY available in RPC from clients.
* `conn.session` The session object. You can write session data here. Session data is shared in connections from one browser.
* `conn.session.id` (Read-Only) The session ID.
* `conn.session.save(callback)` Save session data to the database.
* `conn.session.reload(callback)` Reload session data from the database.
* `conn.host` (Read-Only) The host (domain name with port) requested by the client.
* `conn.ip` (Read-Only) The remote address of the client.
* `conn.headers` (Read-Only) The request headers. You can read user-agent from here.
* `conn.language` (Read-Only) The language used for the client. It's one of the `app.locale` in configuration, or an empty string. NOT available in RPC from clients.
* `conn.selectLanguage([prefer])` Select the language used for the client. A preferred locale can be given, or the framework will auto-select one. NOT available in RPC from clients.
