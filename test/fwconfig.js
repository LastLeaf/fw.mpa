// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = {

	app: {
		title: 'fw.mpa test',
		locale: ['zh'],
		loadingLogo: 'loading.gif'
	},

	server: {
		port: 1180,
		workingServer: 'http://127.0.0.1:1180'
	},

	db: {
		type: 'none',
		host: 'localhost',
		port: 27017,
		user: 'fw',
		password: 'fwtest',
		name: 'fw',
	},

	secret: {
		cookie: 'test!',
	},

};