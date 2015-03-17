# fw.mpa Quick Start #

## Configuring Framework ##

Install fw.mpa in your project directory using `$ npm install fw.mpa`.

In the framework, you can run several apps in one framework process. Write an `index.js` to start the framework.

```js
var fw = require('fw.mpa');
fw({
	ip: '0.0.0.0',
	port: 1180,
	app: 'app.js'
});
```

You have to pass the configuration object to fw.mpa.
`ip` and `port` is the http binding information.
`app` is the app start file to run immediately after framework initialization.
