# fw.mpa Documentation #

## Guide - Creating New Project ##

### Configuration ###

fw.mpa apps and websites should be built in an empty project dir. Create it and install framework in it using `npm install fw.mpa`.

Then write a configure file (named `fwconfig.js`) and a start file (usually `app.js`). See the example below.

```js
// /fwconfig.js
module.exports = {
	app: {
		title: 'Hello World', // the app's title
		version: '0.0.1', // the app's version, must change when a new version is deployed
	},
	client: {
		loadingLogo: 'loading.gif', // a logo to show when page is loading or switching
		loadingLogoBackground: '#fff' // the background color of the loading logo
	},
	server: {
		port: 80, // the server port
		cacheServer: '', // the cache server address, e.g. http://127.0.0.1/
		workingServer: '', // the working server address, e.g. http://127.0.0.1/
	},
	db: {
		type: 'mongoose', // should be "mongoose" if you want to use database
		host: 'localhost', // here's some database configuration, differrent for each database engine
		port: 27017,
		user: '',
		password: '',
		name: '',
	},
	secret: {
		cookie: 'This is a RANDOM and SECRET string!', // should not be too short, and must keep secret!
	},
};
```
```js
// /app.js
require('fw.mpa')(__dirname);
```

### Dir Structure ###

In the project dir, create several subdirs for coding.

* `client/` The client side code including js, css, and templates.
* `cache/` The client side code cache generated in cache mode. Client side code will be minimized while caching.
* `rpc/` The server side RPC functions.
* `module/` Server modules.
* `render/` The server side rendering code.
* `page/` The special page code. Special pages are generated on server side.
* `static/` Static contents. This dir has the top priority. Put static files here and they will be served to clients directly.
* `rc/` Routes and some special files used by the framework, described below.

Currently, `rc/` contains following files.

* `rc/routes.js` The routes. Descendents of `rc/` can also contains routes.
* `rc/favicon.ico` The favicon for this website. The file name is specified in `client.loadingLogo` of the configuration.
* `rc/loading.gif` The logo to show when loading. The file name is specified in `client.loadingLogo` of the configuration.

### Running Modes ###

Now the app should be runnable. There are three run modes for the app: debug, cache, and default.

* Debug mode: the app should always run in this mode while coding and debuging, otherwise the client side code may be cached in browsers. To run in this mode, you should specify environment variable "DEBUG": `FW=DEBUG node app.js`
* Cache mode: the app should better run in this mode on running servers. In this mode, code cache will be dynamically generated. To run in this mode, you should specify environment variable "CACHE": `FW=CACHE node app.js`
* Default mode: this mode should be used when the running environment is limited. In this mode, framework will never try to write anything to the project dir, which means that you need to provide code cache (the `cache/` generated in cache mode) manually. The framework itself will not try to restart automatically in this mode. Just do `node app.js` to run in this mode.

### Code Cache and Static Content Server ###

In cache mode, the code cache is generated and updated in `cache/`. You can host them in another static http server or CDN, and specify the address in the configuration (server.cacheServer).

A static html file named `webapp.html` is also generated. It's used for running as a packaged web-app. Just delete it if you do not want to host it on the static http server.
