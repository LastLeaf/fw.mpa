// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// TODO cache routes json string
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
		var keys = k.match(/\/(:\w*|\*)/g);
		if(keys) {
			for(var i=0; i<keys.length; i++)
				keys[i] = (keys[i] === '/*' ? '*' : keys[i].slice(2));
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
		var defSegs = [];
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
			path = path.slice(0, -1) || '/';
		// get args
		if(obj.k)
			for(var i=0; i<obj.k.length; i++)
				if(obj.k[i] !== '*') args[obj.k[i]] = argVals[i];
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
			// scan for minify path in file lists
			if(!app.debug) {
				var combineFiles = function(files, nameFunc){
					if(!files) return;
					if(files.constructor !== Array) files = [files];
					for(var i=0; i<files.length; i++) {
						var file = files[i];
						if(!file.minify) continue;
						var out = nameFunc(file.minify);
						if(out.charAt(0) !== '/')
							out = app.config.path.cache + '/client/' + route.base + out;
						else
							out = app.config.path.cache + '/client' + out;
						mkdirp.sync(path.dirname(out));
						var fd = fs.openSync(out, 'w');
						if(file.src.constructor === Array) {
							for(var j=0; j<files[i].src.length; j++) {
								if(j) {
									var buf = new Buffer('\n');
									fs.writeSync(fd, buf, 0, buf.length);
								}
								if(file.src[j].charAt(0) !== '/')
									buf = fs.readFileSync(app.config.path.cache + '/client/' + route.base + nameFunc(file.src[j]));
								else
									buf = fs.readFileSync(app.config.path.cache + '/client' + nameFunc(file.src[j]));
								fs.writeSync(fd, buf, 0, buf.length);
							}
						} else {
							if(file.src.charAt(0) !== '/')
								var buf = fs.readFileSync(app.config.path.cache + '/client/' + route.base + nameFunc(file.src));
							else
								var buf = fs.readFileSync(app.config.path.cache + '/client' + nameFunc(file.src));
							fs.writeSync(fd, buf, 0, buf.length);
						}
						fs.closeSync(fd);
					}
				};
				combineFiles(route.main, function(file){
					if(file.slice(-3) !== '.js') file += '.js';
					return file;
				});
				combineFiles(route.lib, function(file){
					if(file.slice(-3) !== '.js') file += '.js';
					return file;
				});
				combineFiles(route.style, function(file){
					if(file.slice(-4) !== '.css') {
						if(file.slice(-11) !== '.stylus.css')
							file += '.stylus.css';
						else
							file += '.css';
					}
					return file;
				});
				combineFiles(route.tmpl, function(file){
					if(file.slice(-5) !== '.tmpl')
						file += '.tmpl';
					file += '.js';
					return file;
				});
				var locale = app.config.app.locale;
				for(var i=0; i<locale.length; i++) {
					var loc = locale[i];
					combineFiles(route.tmpl, function(file){
						if(file.slice(-5) !== '.tmpl')
							file += '.tmpl';
						if(loc)
							file += '.' + loc;
						file += '.js';
						return file;
					});
				}
			}
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
					if(app.debug) console.error('fw root error: no parent page "'+parent+'" found for "'+id+'".');
					break;
				}
				i = i.slice(0, p);
			}
		}
	}
	routeTree = routeParser(clientRoutes, app.pageRoutes);
	routesFile = 'fw._routes(' + JSON.stringify(routeTree) + ', ' + pathParserStr + ')';
	if(app.mode === 'CACHE')
		fs.writeFileSync(app.config.path.cache+'/fw/routes.js', uglifyjs.minify(routesFile, {fromString: true}).code);
	app.pathParser = pathParser;
	app.routeTree = routeTree;
};
