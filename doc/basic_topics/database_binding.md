# fw.mpa Basic Topics #

## Sessions and Database Binding ##

fw.mpa support sessions, which can contain any JSON-compatible data for a user.
Sessions are shared in multiple connections and pages from a browser.

By default, session data are stored in memory. Session data will lost whenever framework is restarted.
If you want to store sessions in persistent storage, you can use database binding.
Currently, only mongodb is supported (through [mongoose](http://mongoosejs.com/)).

"db" section in app configuration should provide database information. To use mongodb, available options are listed below.

```js
app.setConfig({
	db: {
		type: 'mongoose',
		host: '127.0.0.1', // server's ip or hostname
		port: 27017, // mongodb port
		name: '', // database name
		user: '', // optional, used for auth
		password: '', // optional, used for auth
		sessionCollection: '' // optional, specify the collection name to store sessions
	}
});
```

If a database is binded, it can be visit through `app.db` in server code.
For mongoose, it is a mongoose object that can be used to visit mongodb collections.
You can visit other databases using external modules as well.
