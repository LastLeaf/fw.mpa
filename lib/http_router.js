// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var send = require('send');
var handlebars = require('handlebars');

var renderCreator = require('./render.js');
var preprocessor = require('./preprocessor.js');
var tmplMinify = require('./tmpl_minify.js');
var errorCatcher = require('./error_catcher.js');

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
				var requiredVersion = app.clientCacheVersions.fw[req.path.slice(1)] || fw.fwVersion;
				if(req.path === '/routes.js') requiredVersion = app.config.app.version;
				if(req.query.v !== requiredVersion) {
					res.status(481).send('Version Not Match');
					return;
				} else {
					res.set('Cache-Control', 'public, max-age=31536000');
				}
			}
			next();
		});
		expressApp.use('/~client', function(req, res, next){
			if(req.query.v) {
				if(req.query.v !== (app.clientCacheVersions.client[req.path.slice(1)] || app.config.app.version)) {
					res.status(481).send('Version Not Match');
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
		expressApp.use('/~fw', function(req, res, next){
			if(req.path === '/routes.js') {
				// routes file
				res.type('text/javascript');
				res.send(app.clientRoutesFileContent);
			} else if(req.path === '/'+path.basename(app.config.client.loadingLogo)) {
				// loading logo
				res.sendFile(app.config.client.loadingLogo, {root: process.cwd()});
			} else if(req.path === '/'+path.basename(app.config.client.favicon)) {
				// favicon
				res.sendFile(app.config.client.favicon, {root: process.cwd()});
			} else {
				send(req, req.path, {index: false, root: __dirname + '/client'}).pipe(res);
			}
		});
	} else {
		expressApp.use('/~fw', function(req, res, next){
			send(req, req.path, {index: false, root: app.config.client.cache + '/~fw'}).pipe(res);
		});
	}

	// client files
	if(fw.debug) {
		expressApp.use('/~client', function(req, res, next){
			if(req.method !== 'GET' && req.method !== 'HEAD') {
				res.sendStatus(404);
				return;
			}
			var reqPath = req.path;
			var reqLang = '';
			if(reqPath.match(/\.(stylus|tmpl|locale[\/\\])$/)) {
				// ignore stylus/tmpl/locale files
				res.sendStatus(404);
				return;
			}
			if(reqPath.slice(-11) === '.stylus.css') {
				// find original stylus file
				reqPath = reqPath.slice(0, -11);
			} else if(reqPath.match(/\.tmpl\.[^\/\.]+\.js$/)) {
				// find original locale file
				reqPath = reqPath.replace(/\.([^\/\.]+)\.js$/, function(match, lang){
					reqLang = lang;
					return '';
				});
			} else if(reqPath.match(/\.tmpl\.js$/)) {
				reqPath = reqPath.slice(0, -3);
			}
			app.serverRoute.client(reqPath, function(file){
				if(!file) {
					res.sendStatus(404);
					return;
				}
				if(!file.match(/\.(js|css|stylus|tmpl)$/)) {
					// direct send
					res.sendFile(file, {root: process.cwd()});
					return;
				}
				if(reqLang) {
					file = file.replace(/\.tmpl$/, '.locale/' + reqLang);
				}
				preprocessor(app, file, function(files){
					if(path.extname(file) === '.tmpl' || reqLang) {
						// match lang for tmpl files
						res.type('text/javascript');
						res.send(files[reqLang ? '.'+reqLang+'.js' : '.js']);
					} else {
						// get the only file
						if(path.extname(file) === '.js')
							res.type('text/javascript');
						else
							res.type('text/css');
						for(var k in files) {
							res.send(files[k]);
							break;
						}
					}
				});
			});
		});
	} else {
		expressApp.use('/~client', function(req, res, next){
			send(req, req.path, {index: false, root: app.config.client.cache + '/~client'}).pipe(res);
		});
	}

	// jobs need to delay until app start
	var startRouter = function(cb){
		var finishedCount = 2;
		var finished = function(){
			if(--finishedCount) return;
			cb();
		};
		// index page generator for web
		// TODO improve security by not writing session id (auth) into page source
		fs.readFile(__dirname+'/default/index.html', function(err, buf){
			var index = handlebars.compile(tmplMinify(buf.toString('utf8')));
			var indexPage = function(auth, lang, styles, extraHead, title, content){
				var stylesInfo = [];
				for(var i=0; i<styles.length; i++) {
					stylesInfo.push({
						href: styles[i],
						version: app.clientCacheVersions.client[styles[i].slice(9)]
					});
				}
				return index({
					debug: fw.debug || 0,
					timestamp: new Date().getTime(),
					version: app.config.app.version,
					fwVersion: fw.fwVersion,
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
				errorCatcher(function(){
					render(req, req.path, 0, function(css, r){
						res.status(r.statusCode).send(indexPage(app.sessionCookieVal(req.sessionID), req.language, css, r.extraHead, r.title, r.content));
					});
				}, function(err){
					console.error('An error in render "' + req.path + '".');
					console.log(err.stack);
					if(fw.debug) process.exit();
					else app.restart();
				});
			};
			finished();
		});
		// index page generator for app
		if(fw.mode === 'cache') {
			fs.readFile(__dirname+'/default/webapp.html', function(err, buf){
				var packaged = handlebars.compile(tmplMinify(buf.toString('utf8')));
				var html = packaged({
					debug: fw.debug || 0,
					version: app.config.app.version,
					fwVersion: fw.fwVersion,
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
				fs.writeFile(app.config.client.cache+'/webapp.html', html, finished);
			});
		} else {
			finished();
		}
	};

	// default routes
	expressApp.get('*', function(req, res){
		if(req.path.slice(0, 2) === '/~') {
			if(req.path === '/~conf/sock.js') {
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
					res.sendStatus(403);
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
					res.sendStatus(403);
					return;
				}
				if(typeof(req.query.l) === 'string')
					req.language = req.conn.language = req.query.l;
				app.getAuthSession(req.query.a, function(session){
					if(!session) {
						// session lost
						res.sendStatus(403);
						return;
					}
					req.sessionID = req.query.a;
					req.session = req.conn.session = session;
					res.type('text/javascript');
					render(req, path, depth, function(css, r){
						res.send('fw._renderRes=' + JSON.stringify(r));
					});
				});
			} else {
				// prevent protected path
				res.sendStatus(404);
			}
		} else {
			if(!app.serverRoute.static(req.path, req, res)) {
				// when no static routes found, route special pages
				var func = app.serverRoute.page(req.path);
				if(func) {
					errorCatcher(function(){
						func.call(app, req, res);
					}, function(err){
						console.error('An error occurred in page "' + req.path + '".');
						console.log(err.stack);
						if(fw.debug) process.exit();
						else app.restart();
					});
				} else {
					app.sendRender(req, res);
				}
			}
		}
	});

	// post, put, delete, options, trace for special pages
	expressApp.all('*', function(req, res){
		if(req.path.slice(0, 2) === '/~') {
			res.sendStatus(404);
		} else {
			app.serverRoute.static(req.path);
		}
	});

	return startRouter;
};
