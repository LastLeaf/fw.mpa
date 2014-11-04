// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var express = require('express');

var renderCreator = require('./render.js');

module.exports = function(app, render){
	var expressApp = app.express;
	var render = renderCreator(app);

	// default cache
	if(fw.debug) {
		expressApp.use(function(req, res, next){
			res.set('Cache-Control', 'no cache, no store');
			next();
		});
	}

	// static cache
	if(!fw.debug) {
		expressApp.use('/~fw', function(req, res, next){
			if(req.query.v) {
				if(req.query.v !== app.clientCacheVersions[req.path.slice(1)]) {
					res.send(481, 'Version Not Match');
					return;
				} else {
					res.set('Cache-Control', 'public, max-age=31536000');
				}
			}
			next();
		});
		expressApp.use('/~client', function(req, res, next){
			if(req.query.v) {
				if(req.query.v !== app.clientCacheVersions[req.path.slice(1)]) {
					res.send(481, 'Version Not Match');
					return;
				} else {
					res.set('Cache-Control', 'public, max-age=31536000');
				}
			}
			next();
		});
	}

	// prevent cache
	var preventCache = function(req, res, next){
		res.set('Cache-Control', 'no-cache, no-store');
		next();
	};
	expressApp.use('/~conf', preventCache);
	expressApp.use('/~render', preventCache);

	// fw files
	if(fw.debug) {
		expressApp.use('/~fw', express.static(__dirname + '/client'));
	} else {
		expressApp.use('/~fw', express.static(app.config.client.cache + '/~fw'))
	}

	// client files
	if(fw.debug) {
		expressApp.use('/~client', function(req, res, next){
			if(req.method !== 'GET' && req.method !== 'HEAD') {
				res.send(404);
				return;
			}
			var reqPath = req.path;
			app.serverRoute.client(reqPath, function(file){
				if(!file) {
					res.send(404);
					return;
				}
				if(file.match(/\.locale[\/\\]/)) {
					// ignore locale files
					res.send(404);
					return;
				}
				if(!file.match(/\.(js|tmpl|css|stylus)$/)) {
					// direct send
					res.sendFile(file);
					return;
				}
				preprocessor(app, file, function(files){
					if(file.slice(-5) === '.tmpl') {
						// match lang for tmpl files
						res.send(files['.'+req.language+'.js'] || files['.js']);
					} else {
						// get the only file
						for(var k in files) {
							res.send(files[k]);
							break;
						}
					}
				});
			});
		});
	} else {
		expressApp.use('/~client', express.static(app.config.client.cache + '/~client'));
	}

	// index page generator for web
	// TODO sync calls
	var index = handlebars.compile(fs.readFileSync(__dirname+'/default/index.html').toString('utf8'));
	var indexPage = function(auth, lang, styles, extraHead, title, content){
		var stylesInfo = [];
		for(var i=0; i<styles.length; i++) {
			stylesInfo.push({
				href: styles[i],
				version: app.clientCacheVersions.client[styles[i].slice(1)];
			});
		}
		return index({
			debug: app.debug || 0,
			timestamp: new Date().getTime(),
			version: app.config.app.version,
			fwVersion: fw.version,
			timeout: app.config.server.timeout,
			language: lang || '',
			cacheServer: app.config.server.cacheServer,
			workingServer: app.config.server.workingServer,
			favicon: app.config.client.favicon,
			faviconVersion: app.clientCacheVersions.fw[path.basename(app.config.client.favicon)],
			loadingLogo: app.config.client.loadingLogo,
			loadingLogoVersion: app.clientCacheVersions.fw[path.basename(app.config.client.loadingLogo)],
			loadingLogoBackground: app.config.client.loadingLogoBackground,
			title: title || app.config.app.title,
			meta: app.config.client.meta,
			styles: stylesInfo,
			extraHead: extraHead,
			content: content,
			auth: auth,
		});
	};
	app.sendRender = function(req, res){
		// default file
		res.type('text/html');
		res.set('Cache-Control', 'no-cache, no-store');
		render(app, req, req.path, 0, function(css, r){
			res.status(r.statusCode).send(indexPage(app.sessionCookieVal(req.sessionID), req.language, css, r.extraHead, r.title, r.content));
		});
	};

	// index page generator for app
	if(fw.mode === 'cache') {
		var packaged = handlebars.compile(fs.readFileSync( __dirname+'/default/webapp.html' ).toString('utf8'));
		var html = packaged({
			debug: app.debug || 0,
			version: app.config.app.version,
			fwVersion: fw.version,
			timeout: app.config.server.timeout,
			language: app.config.app.locale.join(','),
			cacheServer: app.config.server.cacheServer,
			workingServer: app.config.server.workingServer,
			favicon: app.config.client.favicon,
			loadingLogo: app.config.client.loadingLogo,
			loadingLogoBackground: app.config.client.loadingLogoBackground,
			title: app.config.app.title,
			meta: app.config.client.meta,
		});
		fs.writeFileSync(app.config.client.cache+'/webapp.html', html);
	}

	// default routes
	expressApp.get('*', function(req, res){
		if(req.path.slice(0, 2) === '/~') {
			if(fw.debug && req.path === '/~fw/routes.js') {
				// routes file
				res.type('text/javascript');
				res.send(app.clientRoutesFileContent);
			} else if(fw.debug && req.path === '/~fw/'+app.config.client.loadingLogo) {
				// loading logo
				res.sendFile(app.config.client.loadingLogo, {root: process.cwd()});
			} else if(fw.debug && req.path === '/~fw/'+app.config.client.favicon) {
				// loading logo
				res.sendFile(app.config.client.favicon, {root: process.cwd()});
			} else if(req.path === '/~conf/sock.js') {
				// sock config file
				res.type('text/javascript');
				if(!fw.debug && req.query.v && req.query.v !== app.config.app.version) {
					// server version changed
					res.send('fw.onserverchanged("'+app.config.app.version+'")');
					return;
				}
				if(!req.query.a) {
					// generate new session
					app.generateSession(function(id){
						res.send('fw._sockConfig("' + id + '")');
					});
					return;
				}
				app.getAuthSession(req.query.a, function(session){
					if(!session) {
						// session lost
						res.send('fw._sessionlost()');
						return;
					}
					res.send('fw._sockConfig()');
				});
			} else if(req.path === '/~conf/lang') {
				// set language, must in same-origin
				var auth = req.query.a || '';
				if(req.query.a !== req.cookies['fw.sid']) {
					res.send(403);
					return;
				}
				var lang = req.query.l;
				if(typeof(lang) === 'string')
					req.selectLanguage(lang);
				else
					req.selectLanguage();
				if(req.query.r) {
					res.redirect(req.query.r || '/');
				} else {
					res.type('text/javascript');
					res.send(';');
				}
			} else if(req.path.slice(0, 9) === '/~render/') {
				// rendering request
				var path = req.path.slice(8);
				var depth = req.query.d;
				if(!path || !depth) {
					res.send(403);
					return;
				}
				if(typeof(req.query.l) === 'string')
					req.language = req.conn.language = req.query.l;
				app.getAuthSession(req.query.a, function(session){
					if(!session) {
						// session lost
						res.send(403);
						return;
					}
					req.sessionID = req.query.a;
					req.session = req.conn.session = session;
					res.type('text/javascript');
					app.render.path(app, req, path, depth, function(css, r){
						res.send('fw._renderRes=' + JSON.stringify(r));
					});
				});
			} else {
				// prevent protected path
				res.send(404);
			}
		} else {
			app.serverRoute.static(req.path);
		}
	});

	// head, post, put, delete, options, trace for special pages
	app.all('*', function(req, res){
		if(req.path.slice(0, 2) === '/~') {
			res.send(404);
		} else {
			app.serverRoute.static(req.path);
		}
	});
};
