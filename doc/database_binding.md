# fw.mpa Documentation #

## Guide - Database Binding ##

fw.mpa is able to use an database to store sessions. The database is also available for the server-side code as `fw.db` object.

Database binding is done by drivers, which are separated from the main code. Currently, fw.mpa only support [MongoDB](http://www.mongodb.org/) using the `mongoose` driver, but it's easy to make other drivers. You can also use the `none` driver, which means you save sessions in memory, and they will gone when the server restarts.

### The Mongoose Driver ###

Save sessions in MongoDB through [Mongoose](https://github.com/LearnBoost/mongoose). The `fw.db` will be set to the mongoose object. The configuration should contain following settings.

```js
	db: { // the database configuration
		type: 'mongoose',
		host: '127.0.0.1',
		port: 27017,
		user: '',
		password: '',
		name: '',
	},
```

### The None Driver ###

Save sessions in plain js object. The `fw.db` will be set to null. The configuration should contain following settings.

```js
	db: { // the database configuration
		type: 'none',
	},
```
