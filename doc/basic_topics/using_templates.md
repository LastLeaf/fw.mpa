# fw.mpa Basic Topics #

## Using Templates ##

Templates are used for generating html segments.
Always using templates when you want to generate html contents.
They will help avoid XSS attacks.

### Coding Templates ###

Templates included in a sub-page can be visited by "main" scripts in the same sub-page.
Each template will be converted to a function.

```html
<tmpl id="helloworld" minify>
	<p>helloworld</p>
</tmpl>

<tmpl id="user" minify>
	<div>User: {{username}}</div>
</tmpl>
```

The templates above will be converted to two functions, `pg.tmpl.helloworld()` and `pg.tmpl.user(...)`.

```js
fw.main(function(pg){

	pg.tmpl.helloworld() // => '<p>helloworld</p>'

	pg.tmpl.user({ username: 'LastLeaf' }) // => '<div>User: LastLeaf</div>'

});
```

You can use simple variables like above. Furthermore, `{{#if}}`, `{{#unless}}`, and `{{#each}}` blocks are also allowed.

```html
<tmpl id="userInfo" minify>
	<div>User: {{username}}</div>
	{{#if age}}<div>Age: {{age}}</div>{{/if}}
	<ul>
		{{#each details}}<li>{{@key}}: {{this}}</li>{{/each}}
	</ul>
</tmpl>
```

```js
fw.main(function(pg){
	var data = {
		username: 'LastLeaf',
		details: {
			website: 'http://lastleaf.me'
			visits: 123
		}
	};
	pg.tmpl.userInfo(data) // => '<div>User: LastLeaf</div><ul><li>website: http://lastleaf.me</li><li>visits: 123</li></ul>'
});
```

Read [handlebars docs](http://handlebarsjs.com/) for the features of templates. Currently, external helpers are not supported.

"\`" characters are special in fw.mpa templates. Read [I18n Support](i18n.md) for more details.

### Server Side Templates ###

Using templates in server code is also allowed, except in server modules.
However, you should render pages in client side most of the time.
This feature is mainly designed for generating contents that do not send to clients as RPC response.

You can load a .tmpl file using `fw.tmpl(path)` in server code.
`path` is relative to the current file.
Here is an example in RPC functions.

```js
// RPC: mail.js
var mail = fw.tmpl('mail.tmpl');
exports.sendNotice = function(conn, res){
	mail(conn).notice({ from: 'System admin' }) // => 'System admin send a notice to you!'
};
```

The code above loads "mail.tmpl" in the same directory.

```html
<tmpl id="notice" minify>
	{{from}} send a notice to you!
</tmpl>
```

Take care! The templates loaded by `fw.tmpl(path)` need `conn` as an argument to init templates for the current connection.
It is a little different from client code.
