# fw.mpa Basic Topics #

## Multi-Apps in One Instance ##

You can run multiple apps in one fw.mpa instance.
Framework allows you dynamically create/destroy any apps without stopping framework.

To start multiple apps immediately after framework starts, list the app start file paths in the framework configuration.

```js
fw({
	ip: '0.0.0.0',
	port: 1180,
	app: ['app1/app.js', 'app2/app.js']
});
```

There is [a simple example](../../examples/multi_apps).
The [127.0.0.1:1180](http://127.0.0.1:1180) and [localhost:1180](http://localhost:1180) matches two different apps.

Each app can be specified one or more hosts via "app.host" in app configuration.
This field can be a single string or an array of strings.
If you do not specify it, it will be a default app when no other apps matches the visiting host.
A sample app configuration:

```js
module.exports = function(app){
	// ...
	// configuring app
	app.setConfig({
		app: {
			host: '127.0.0.1:1180',
			title: 'App1',
		},
		client: {
			cache: 'app1/cache',
		},
		secret: {
			cookie: 'LONG RANDOM STRING',
		}
	});
	// ...
};
```

You can dynamically create a new app with `fw.createApp(startFilePath [, args...] [, cb])`, and destroy an app with `app.destroy()`.

`app.start(cb)`, `app.stop(cb)`, `app.restart(cb)` is designed for start/stop/restart serving.
An app is stopped when created.
If you changed app configuration, directory bindings, or routes when app running, you need to restart it.

Some warnings and tips:

* Apps are running in one node process and sharing one global context! Apps are not totally isolated from others. If an app blocks the process, it blocks all apps!
* If you put your apps into separated sub directories, be careful when writing paths. Paths in all apps are relative to `process.cwd()`.
* You ALWAYS need to specify cache directory for each app (via "client.cache" in app configurations) to prevent apps cached in the same directory!
* You can start multiple apps with the same start file, but take care of the [require cache](https://nodejs.org/api/modules.html#modules_caching)! You may want to [uncache](https://www.npmjs.com/package/require-uncache) some modules such as [Mongoose](https://www.npmjs.com/package/mongoose).
