// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

module.exports = {

	app: {
		title: '', // app's title
		version: String(new Date().getTime()), // app's version
		locale: [], // app's locale list, used in i18n
	},

	client: {
		favicon: '', // the favicon in rc/
		loadingLogo: '', // the loading logo filename in rc/
		loadingLogoBackground: '#fff', // the loading logo's background color
		meta: { // the <meta> tags added in <head>
			viewport: '',
		},
	},

	server: {
		ip: '', // the ip address to bind, default binded to any address
		port: 80, // the port to bind (it may requires root privilege to bind to 80, and it's dangerous!)
		timeout: 20*1000, // the timeout (in ms) for network requests such as RPC
		sessionLifeTime: 14*24*60*60*1000, // the session's lifetime
		bodySizeLimit: 1024*1024, // the http request's body size limit, influence the request's content size
		cacheServer: '', // the cache server's address, including "http://" (can be several address separated by blanks, but NOT suggest)
		workingServer: '', // the working server's address, including "http://" (can be several address separated by blanks)
	},

	socket: {
		disableWebsocket: false, // whether websocket should be disabled (some cloud platforms does not support websocket) 
		heartbeat: 25*1000, // the heartbeat to keep connections alive
	},

	db: { // the database configuration, a bit different for each database driver
		type: 'none',
		host: '127.0.0.1',
		port: 0,
		user: '',
		password: '',
		name: '',
	},

	path: { // this section specifies the alias for the child dirs in project dir (usually, no need to modify)
		rc: 'rc',
		routes: 'rc',
		client: 'client',
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

	secret: {
		cookie: '', // a RANDOM and SECRET string to sign the cookie
	},

};