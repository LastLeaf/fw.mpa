// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = {

	app: {
		host: [], // the app's addr:port pair(s), default to any
		title: '', // app's title
		version: String(new Date().getTime()), // app's version
		locale: [], // app's locale list, used in i18n
	},

	client: {
		cache: '', // the client code cache dir
		favicon: '', // the favicon's path in server
		loadingLogo: '', // the loading logo's path in server
		loadingLogoBackground: '#fff', // the loading logo's background color
		meta: { // the <meta> tags added in <head>
			viewport: '',
		},
	},

	server: {
		timeout: 20*1000, // the timeout (in ms) for network requests such as RPC
		sessionLifeTime: 14*24*60*60*1000, // the session's lifetime
		bodySizeLimit: 1024*1024, // the http request's body size limit, influence the request's content size
		cacheServer: '', // the cache server's address, including "http://" (can be several address separated by blanks, but NOT suggest)
		workingServer: '', // the working server's address, including "http://" (can be several address separated by blanks)
	},

	db: { // the database configuration, a bit different for each database driver
		type: 'none',
		host: '127.0.0.1',
		port: 0,
		user: '',
		password: '',
		name: '',
	},

	secret: {
		cookie: '', // a RANDOM and SECRET string to sign the cookie
	},

};
