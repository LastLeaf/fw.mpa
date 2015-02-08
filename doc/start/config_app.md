# fw.mpa Quick Start #

## Configuring App ##

An app is initialized after framework initialization. The app start file of this app will be run.
You can start other apps in this app (or any started apps further) using the APIs provided by fw.mpa.

The app start file handles an initialized app. This app start file should be written like below.

```js
module.exports = function(app){
	// configuring app
	// binding directory
	// routing
	// starting app
};
```

Before starting the app, you have to configure app, bind directory, and set the route.

When configuring the app, pass an configure object to `app.setConfig(...)`.

```js
module.exports = function(app){
	// ...
	// configuring app
	app.setConfig({
		app: {
			host: '127.0.0.1:1180',
			title: 'My fw.mpa App',
		},
		secret: {
			cookie: 'LONG RANDOM STRING',
		}
	});
	// ...
};
```

The example above is a minimum configuration.
"app.host" is the host binded to this app. Here, you have to visit "http://127.0.0.1:1180" to visit this app after it is started. Others such as "http://localhost:1180" will not be routed to this app by the framework.
"app.title" is the app's title.
"secret.cookie" should be a long random string to encrypt the session ID stored in cookie.
