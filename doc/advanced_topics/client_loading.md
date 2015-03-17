# fw.mpa Advanced Topics #

## Client Loading Features ##

fw.mpa provides some features about client code loading.

### Async Sub-Page Loading ###

Sometimes you would like to do some async jobs in "main" scripts.
For example, in a parent sub-page, you would like to check user login status through an RPC request, and prevent child sub-page loading if not logged in.
In these cases, use `fw.mainAsync(pg, subm, cb)` instead.

```js
fw.mainAsync(function(pg, subm, cb){
	pg.rpc('/helloworld', function(){
		// if success, continue loading
		cb();
	}, function(err){
		// if error, stop loading
		fw.stopLoading();
	});
});
```

The loading process will suspend until you call `cb` like above.

### Loading Logos ###

You may want to show a logo (a common image file) while initially loading.
fw.mpa provides a simple way to achieve that.
In app configuration, "client.loadingLogo" and "client.loadingLogoBackground" can be configured.

```js
app.setConfig({
	client: {
		favicon: '', // the favicon image file
		loadingLogo: 'loading.gif', // an image file, path relative to process.cwd()
		loadingLogoBackground: '#fff'
	}
});
```

If set, the loading logo will be shown as soon as minimal content loaded, even earlier before framework totally initialized.
If you find you do not need it after initial loading, disable it with `fw.loadingLogo.disabled = true`.

Because loading logo is an html div in document body, you should not directly write `document.body.innerHTML` with loading logo enabled.
Doing this will break the loading logo.
Please insert other elements instead.
