// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = {

	app: {
		title: 'fw.mpa test',
		version: '0.1.1',
	},

	server: {
		port: 1180,
		cwd: __dirname,
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