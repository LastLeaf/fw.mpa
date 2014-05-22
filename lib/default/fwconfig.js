// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = {

	app: {
		title: '',
		version: String(new Date().getTime()),
		locale: [],
		loadingLogo: '',
		loadingLogoBackground: '#fff',
	},

	server: {
		ip: '',
		port: 80,
		timeout: 20*1000,
		sessionLifeTime: 14*24*60*60*1000,
		bodySizeLimit: 1024*1024,
		cacheServer: '',
		workingServer: ''
	},

	path: {
		rc: 'rc',
		script: 'client',
		tmpl: 'client',
		style: 'client',
		rpc: 'rpc',
		module: 'module',
		render: 'render',
		page: 'page',
		static: 'static',
		cache: 'cache',
	},

	socket: {
		disableWebsocket: false,
		heartbeat: 25000,
	},

	db: {
		type: 'none',
		host: 'localhost',
		port: 27017,
		user: '',
		password: '',
		name: '',
	},

	secret: {
		cookie: '',
	},

};