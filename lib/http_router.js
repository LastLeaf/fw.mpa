// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var handlebars = require('handlebars');
var fsListener = require('./fs_listener.js');
var preprocessor = require('./preprocessor.js');

// rmdirp
var rmdirp = function(path) {
	var files = [];
	if(fs.existsSync(path)) {
		files = fs.readdirSync(path);
		files.forEach(function(file,index){
			var curPath = path + '/' + file;
			if(fs.statSync(curPath).isDirectory()) {
				rmdirp(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

// preprocess client files
var clientFiles = function(app, cb){
	if(app.debug) {
		// run with client code in memory
		var clientFiles = app.clientFileCache = {};
		var clientFileHandler = function(file, type, match){
			if(path.basename(file) === 'routes.js') return;
			if(match === '.locale/') {
				if(!type) return;
				file = file.slice(0, file.lastIndexOf('.locale')) + '.tmpl';
			}
			var cache = file.split(path.sep).slice(1).join('/');
			if(type !== 'removed') {
				preprocessor(app, file, function(res){
					if(!res) return;
					for(var k in res)
						clientFiles[cache+k] = res[k];
				});
				if(type) console.log('Client Code Updated: '+file);
			} else {
				delete clientFiles[cache];
			}
		};
	} else if(app.mode === 'CACHE') {
		// run with cache
		rmdirp(app.config.path.cache);
		var clientFileHandler = function(file, type, match){
			if(type) return;
			if(path.basename(file) === 'routes.js') return;
			if(match === '.locale/') return;
			var cache = app.config.path.cache + '/' + file.split(path.sep).slice(1).join('/');
			if(type !== 'removed') {
				mkdirp(path.dirname(cache));
				preprocessor(app, file, function(res){
					if(!res) return;
					for(var k in res)
						fs.writeFileSync(cache+k, res[k]);
				});
			} else {
				fs.unlinkSync(cache);
			}
		};
	} else {
		// run with previous cached code
		var clientFileHandler = null;
	}
	if(clientFileHandler) {
		var c = 3;
		var finished = function(){
			c--;
			if(!c) cb();
		};
		// listen for changes in debug or cache mode
		fsListener(app.config.path.script, {
			'.js': clientFileHandler,
		}, finished);
		fsListener(app.config.path.tmpl, {
			'.tmpl': clientFileHandler,
			'.locale/': clientFileHandler,
		}, finished);
		fsListener(app.config.path.style, {
			'.css': clientFileHandler,
			'.stylus': clientFileHandler
		}, finished);
	} else {
		cb();
	}
};

// generate client routes
var clientRoutes = function(app, cb){
	var routes = app.clientRoutes = {};
	// listen for changes
	fsListener(app.config.path.script, {
		'routes.js': function(file, type){
			if(type && !fw.debug) return;
			if(type !== 'removed') {
				try {
					delete require.cache[app.cwd+'/'+file];
					var basepath = file.split(path.sep).slice(1, -1).join('/');
					if(basepath) basepath += '/';
					fw.currentLoading = app.config.path.script + '/' + basepath + 'routes.js';
					routes[basepath] = require(app.cwd+'/'+file);
					if(app.debug && type) console.log('Routes Updated: '+file);
				} catch(e) {
					delete routes[file];
					console.trace(e);
				}
				fw.currentLoading = '';
			} else
				delete routes[file];
			if(type) updateRoutesFile(app);
		}
	}, cb);
};

// generate pages routes
var pageRoutes = function(app, cb){
	var routes = app.pageRoutes;
	fsListener(app.config.path.page, {
		'.js': function(file, type){
			if(type && !fw.debug) return;
			var pagePath = '/' + file.split(path.sep).slice(1).join('/').slice(0, -3);
			if(type !== 'removed') {
				try {
					delete require.cache[app.cwd+'/'+file];
					fw.currentLoading = app.config.path.page + pagePath + '.js';
					routes[pagePath] = require(app.cwd+'/'+file);
					if(app.debug && type) console.log('Page Updated: '+pagePath);
				} catch(e) {
					delete routes[pagePath];
					console.trace(e);
				}
				fw.currentLoading = '';
			} else
				delete routes[pagePath];
			if(type) updateRoutesFile(app);
		},
		'.tmpl': function(file, type){
			if(!type || !fw.debug) return;
			app.restart();
		},
		'.locale/': function(file, type){
			if(!type || !fw.debug) return;
			app.restart();
		}
	}, cb);
};

// cache routes json string
var routesFile = '';
var routeTree = null;
var routeParser = function(client, page){
	var tree = {
		client: client,
		c: {}
	};
	var treeChild = function(node, index){
		if(node.hasOwnProperty.call(node.c, index))
			return node.c[index];
	};
	var treeAdd = function(path, v){
		var cur = tree;
		var segs = path.split('/');
		while(segs.length) {
			var seg = segs.shift();
			if(!seg) continue;
			if(seg === '*') {
				cur.d = {};
				cur = cur.d;
				break;
			}
			if(seg.charAt(0) === ':') seg = ':';
			var child = treeChild(cur, seg);
			if(!child)
				child = cur.c[seg] = {
					c: {}
				};
			cur = child;
		}
		cur.v = v;
	};
	for(var k in client) {
		if(k.charAt(0) !== '/') continue;
		var keys = k.match(/\/:\w*/g);
		if(keys) {
			for(var i=0; i<keys.length; i++)
				keys[i] = keys[i].slice(2);
			client[k].k = keys;
		}
		treeAdd(k, k);
	}
	for(var k in page)
		treeAdd(k, '');
	return tree;
};
var pathParser = function(tree, path){
	while(1) {
		// find node
		var cur = tree;
		var def = null;
		var defSegs = null;
		var argVals = [];
		var args = {};
		var segs = path.split('/');
		while(segs.length) {
			if(cur.d) {
				def = cur.d;
				defSegs = [];
			}
			var seg = segs.shift();
			if(!seg) continue;
			defSegs.push(seg);
			var child = cur.hasOwnProperty.call(cur.c, seg);
			if(child) {
				cur = cur.c[seg];
			} else if(cur.c[':']) {
				cur = cur.c[':'];
				argVals.push(seg);
			} else {
				cur = def;
				args['*'] = defSegs.concat(segs).join('/');
				break;
			}
		}
		if(!cur) return null;
		if(typeof(cur.v) !== 'string') {
			if(!def) return null;
			cur = def;
			args['*'] = defSegs.concat(segs).join('/');
		}
		if(cur.v === '') return 'page';
		// get obj
		var id = cur.v;
		var obj = tree.client[id];
		if(id.slice(-1) === '/' && path.slice(-1) !== '/')
			path += '/';
		else if(id.slice(-1) !== '/' && path.slice(-1) === '/')
			path = path.slice(0, -1);
		// get args
		if(obj.k)
			for(var i=0; i<obj.k.length; i++)
				args[obj.k[i]] = argVals[i];
		// redirect
		if(!obj.redirect) break;
		path = obj.redirect.replace(/\/:\w*/g, function(m){
			return '/'+args[m.slice(2)];
		});
	}
	return {
		path: path,
		id: id,
		route: obj,
		args: args
	};
};
var pathParserStr = pathParser.toString();
var updateRoutesFile = function(app){
	var client = app.clientRoutes;
	var clientRoutes = {};
	// combine client routes
	for(var base in client) {
		for(var id in client[base]) {
			var route = client[base][id];
			if(id.indexOf('/') >= 0 || id.indexOf('*') >= 0) {
				// relative path routing
				if(id.charAt(0) !== '/') id = ('/' + base + id).replace(/\/\.\//g, '/');
			} else {
				id += ':/' + base;
			}
			if(route.redirect) {
				// redirect
				var r = route.redirect;
				if(r.charAt(0) !== '/') route.redirect = ('/' + base + r).replace(/\/\.\//g, '/');
			}
			route.base = base;
			clientRoutes[id] = route;
		}
	}
	// calculate parent
	for(var id in clientRoutes) {
		var route = clientRoutes[id];
		if(!route.parent) continue;
		var parent = route.parent;
		if(parent.indexOf('/') >= 0 || parent.indexOf('*') >= 0) {
			if(parent.charAt(0) !== '/') id = ('/' + route.base + id).replace(/\/.\//g, '/');
		} else {
			var i = ':/' + route.base;
			while(1) {
				if(clientRoutes[parent+i]) {
					route.parent += i;
					break;
				}
				var p = i.lastIndexOf('/', i.length-2) + 1;
				if(!p) {
					route.parent = '';
					if(fw.debug) console.error('fw root error: no parent page "'+parent+'" found for "'+id+'".');
					break;
				}
				i = i.slice(0, p);
			}
		}
	}
	routeTree = routeParser(clientRoutes, app.pageRoutes);
	routesFile = 'fw._routes(' + JSON.stringify(routeTree) + ', ' + pathParserStr + ')';
	app.pathParser = pathParser;
	app.routeTree = routeTree;
};

exports.route = function(app, express, cb){
	// init routes
	if(app.debug) console.log('Generating routes...');
	app.clientRoutes = {};
	app.pageRoutes = {};

	// default cache
	if(app.debug)
		app.use(function(req, res, next){
			res.set('Cache-Control', 'no cache, no store');
			next();
		});

	// static cache
	var staticCache = function(req, res, next){
		if(!app.debug && req.query.v) {
			if(req.query.v !== app.config.app.version) {
				res.send(481, 'Version Not Match');
				return;
			} else {
				res.set('Cache-Control', 'public, max-age=31536000');
			}
		}
		next();
	};
	app.use('/~rc', staticCache);
	app.use('/~fw', staticCache);
	app.use('/~', staticCache);

	// prevent cache
	var preventCache = function(req, res, next){
		res.set('Cache-Control', 'no-cache, no-store');
		next();
	};
	app.use('/~conf', preventCache);
	app.use('/~render', preventCache);

	// special files
	app.use('/~rc', express.static(app.config.path.rc));
	app.use('/~fw', express.static(__dirname+'/client'));
	app.use('/', express.static(app.config.path.static));

	// client files
	if(app.debug) {
		app.use('/~', function(req, res, next){
			var file = req.path.slice(1);
			if(typeof(app.clientFileCache[file]) === 'undefined') {
				next();
				return;
			}
			var ext = path.extname(file);
			if(ext === '.js') res.type('text/javascript');
			else if(ext === '.css') res.type('text/css');
			res.send(app.clientFileCache[file]);
		});
		app.use('/~', express.static(app.config.path.script));
	} else {
		app.use('/~', express.static(app.config.path.cache));
		app.use('/~', express.static(app.config.path.script));
	}

	// index page generator
	var indexFile = __dirname+'/default/index.html';
	if(fs.existsSync(app.config.path.rc+'/index.html'))
		indexFile = app.config.path.rc+'/index.html';
	var index = handlebars.compile(fs.readFileSync(indexFile).toString('utf8'));
	var indexPage = function(styles, title, content){
		return index({
			debug: app.debug || 0,
			version: app.config.app.version,
			timeout: app.config.server.timeout,
			loadingLogo: app.config.app.loadingLogo,
			loadingLogoBackground: app.config.app.loadingLogoBackground,
			title: title || app.config.app.title,
			styles: styles,
			content: content || ''
		});
	};

	// default routes
	app.get('*', function(req, res){
		if(req.path === '/~rc/routes.js') {
			// routes file
			res.type('text/javascript');
			res.send(routesFile);
		} else if(req.path === '/~conf/sock.js') {
			// sock config file
			res.type('text/javascript');
			if(!app.debug && req.query.v && req.query.v !== app.config.app.version) {
				// server version changed
				res.send('fw.onserverchanged('+app.config.app.version+')');
				return;
			}
			if(req.sessionID !== req.cookies['fw.sid'].slice(2, 2+req.sessionID.length)) {
				// session lost
				res.send('fw.onserverchanged()');
				return;
			}
			res.send('fw._sockConfig('+JSON.stringify({
				url: '/~sock',
				auth: req.cookies['fw.sid'],
				lang: req.language
			})+')');
		} else if(req.path === '/~conf/lang') {
			// set language
			var auth = req.query.a || '';
			var lang = req.query.s || '';
			if(req.query.a !== req.cookies['fw.sid']) {
				res.send(403);
				return;
			}
			req.selectLanguage(lang);
			res.redirect(req.query.r || '/');
		} else if(req.path.slice(0, 8) === '/~render') {
			// rendering request
			var path = req.path.slice(8);
			var depth = req.query.d;
			if(!path || !depth) {
				res(403);
				return;
			}
			res.type('text/javascript');
			app.render.path(app, req, path, depth, function(css, r){
				res.send('fw._renderRes=' + JSON.stringify(r));
			});
		} else if(req.path.slice(0, 2) === '/~') {
			// prevent protected path
			res.send(404, '');
		} else if(app.pageRoutes[req.path]) {
			// special page
			app.pageRoutes[req.path](req, res);
		} else {
			// default file
			res.type('text/html');
			res.set('Cache-Control', 'no-cache, no-store');
			app.render.path(app, req, req.path, 0, function(css, r){
				res.send(indexPage(css, r.title, r.content));
			});
		}
	});

	// head, post, put, delete, options, trace for special pages
	app.all('*', function(req, res){
		if(app.pageRoutes[req.path]) {
			// special page
			app.pageRoutes[req.path](req, res);
		} else {
			res.send(404, '');
		}
	});

	// dynamic contents
	var c = 3;
	var finished = function(){
		c--;
		if(!c) {
			updateRoutesFile(app);
			app.render = require('./render.js');
			app.render.init(app, cb);
		}
	};
	clientFiles(app, finished);
	clientRoutes(app, finished);
	pageRoutes(app, finished);
};
