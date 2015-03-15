# fw.mpa Advanced Topics #

## Version Management ##

Unlike common website, client code in fw.mpa apps does not reload unless page refreshes.
Clients may run for a long time in browser, even when you updates server code.
It is possible that the client code does not matches the server code.
A page refresh in browsers always solves this problem, but sometimes you do not want to check whether the refresh is actually required, give a hint before refresh, or do something else.
There are APIs to achieve this.

If you have packaged and run as WebApps, you need to temporarily ignore the problems, and tell users how to update apps.

App's version can be set at "app.version" in app configuration.
Any strings are allowed.
If you do not set this value, it will be changed every time you create the app in framework.
It means that when you restart framework, your app is treated changed by default.

```js
app.setConfig({
	app: {
		version: '1.0.0'
	}
});
```

This value will be passed to clients when they start.
If you updated your code, you can change this value, and existing clients will detect this change.
When the version mismatch is detected, clients will disconnect, so RPC and server messages do not works.
Then the function `fw.onserverchanged` is called.

By default, `fw.onserverchanged` refresh the web page directly (or do nothing in WebApps).
Set it to another function to change the default behavior.
If you want to enable RPC and server messages without page refreshing, you have to do like below.

```js
fw.onserverchanged = function(serverVersion){
	fw.version = serverVersion; // set client's version to server's version to enable RPC and server messages
	// do something else
	// clients may not works correctly if you do not handle the code updates properly
};
```
