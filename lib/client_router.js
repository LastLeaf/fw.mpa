// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var uglifyjs = require('uglify-js');

var utils = require('./utils.js');

var ROUTE_PROP_MAP = {
	redirect: '_',
	base: 'b',
	reload: 'e',
	render: 'r',
	parent: 'p',
	lib: 'l',
	main: 'm',
	style: 's',
	tmpl: 't'
};
var ROUTE_PROP_REVERSE_MAP = {
	k: 'keys',
	b: 'base',
	e: 'reload',
	r: 'render',
	p: 'parent',
	l: 'lib',
	m: 'main',
	s: 'style',
	t: 'tmpl'
};

module.exports = function(app){

	// list special pages
	var generatePageRoutes = function(pageRouterInfo, cb){
		var routes = {};
		var c = pageRouterInfo.length + 1;
		pageRouterInfo.forEach(function(r){
			var prefix = r.prefix;
			var dir = r.dir;
			utils.walkFileTree(dir, function(path){
				if(path.slice(-3) !== '.js') return;
				routes[prefix + '/' + path.slice(0, -3)] = true;
			}, function(){
				if(--c) return;
				cb(routes);
			});
		});
		if(!--c) cb(routes);
	};

	// parse submodules
	var parseSubmodules = function(app, cb){
		var submodules = {};
		var pendingCount = app.clientSubmodules.length + 1;
		var pendingEnd = function(){
			if(--pendingCount) return;
			cb(submodules);
		};
		app.clientSubmodules.forEach(function(submInfo){
			var subm = submodules[submInfo.path] = {};
			fs.readFile(submInfo.src, function(err, buf){
				if(err) return pendingEnd();
				try { var submDefine = JSON.parse(buf.toString('utf8')); }
				catch(err) {
					if(fw.debug) console.error('Error: Parsing "' + submInfo.src + '" failed.');
					return pendingEnd();
				}
				// base
				var base = submInfo.path.slice(1, submInfo.path.lastIndexOf('/'));
				if(submDefine.base) base = path.resolve('/', base, submDefine.base);
				subm[ROUTE_PROP_MAP.base] = base;
				// set main, lib, tmpl, style
				var filterList = function(list, defExt){
					if(!list) return;
					var res = [].concat(list);
					for(var i=0; i<res.length; i++) {
						var item = res[i];
						if(typeof(item) === 'object') {
							// remove default extname
							if(item.src.constructor === Array) {
								for(var j=0; j<item.src.length; j++) {
									if(item.src[j].slice(-defExt.length) === defExt) {
										item.src[j] = item.src[j].slice(0, -defExt.length);
									}
								}
							} else {
								item.src = String(item.src);
								if(item.src.slice(-defExt.length) === defExt) {
									item = item.src.slice(0, -defExt.length);
								}
							}
						} else {
							res[i] = String(res[i]);
							if(res[i].slice(-defExt.length) === defExt) {
								res[i] = res[i].slice(0, -defExt.length);
							}
						}
					}
					if(res.length <= 1) return res[0];
					return res;
				};
				subm[ROUTE_PROP_MAP.lib] = filterList(submDefine.lib, '.js');
				if(!subm[ROUTE_PROP_MAP.lib]) delete subm[ROUTE_PROP_MAP.lib];
				subm[ROUTE_PROP_MAP.main] = filterList(submDefine.main, '.js');
				if(!subm[ROUTE_PROP_MAP.main]) delete subm[ROUTE_PROP_MAP.main];
				subm[ROUTE_PROP_MAP.style] = filterList(submDefine.style, '.css');
				if(!subm[ROUTE_PROP_MAP.style]) delete subm[ROUTE_PROP_MAP.style];
				subm[ROUTE_PROP_MAP.tmpl] = filterList(submDefine.tmpl, '.tmpl');
				if(!subm[ROUTE_PROP_MAP.tmpl]) delete subm[ROUTE_PROP_MAP.tmpl];
				pendingEnd();
			});
		});
		pendingEnd();
	};

	// route tree management
	var routeTree = null;
	// build route tree from client route table and special page route table
	var routeTreeBuilder = function(client, submodules, page){
		var tree = {
			client: client,
			subm: submodules,
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
	// route a path in route tree
	var pathParser = function(propMap, tree, path){
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
			if(!obj._) break;
			path = obj._.replace(/\/:\w*/g, function(m){
				return '/'+args[m.slice(2)];
			});
		}
		var resObj = {};
		for(var k in obj) {
			if(propMap[k]) resObj[propMap[k]] = obj[k];
		}
		return {
			path: path,
			id: id,
			route: resObj,
			args: args
		};
	};
	var pathParserStr = pathParser.toString();

	// write routes into app object
	var updateRoutes = function(client, submodules, page, cb){
		// calculate parent
		for(var id in client) {
			var route = client[id];
			if(!route.p) continue;
			var parent = route.p;
			if(parent.indexOf('.') >= 0 || parent.indexOf('/') >= 0 || parent.indexOf('*') >= 0) {
				if(parent.charAt(0) !== '/') id = path.resolve('/', route[ROUTE_PROP_MAP.base], id);
			} else if(parent.indexOf(':') < 0) {
				var i = ':/' + route.b;
				while(1) {
					if(client[parent+i]) {
						route.p += i;
						break;
					}
					var p = i.lastIndexOf('/', i.length-2) + 1;
					if(!p) {
						delete route.p;
						if(fw.debug) console.error('Error: no parent "'+parent+'" found for "'+id+'".');
						break;
					}
					i = i.slice(0, p);
				}
			}
		}
		routeTree = routeTreeBuilder(client, submodules, page);
		// write to app object
		var routesFile =
			'fw._routes(' +
			JSON.stringify(ROUTE_PROP_REVERSE_MAP) + ', ' +
			JSON.stringify(routeTree) + ', ' +
			pathParserStr + ', ' +
			JSON.stringify(app.clientCacheVersions.client) + ')';
		app.clientRoutesFileContent = uglifyjs.minify(routesFile, {fromString: true}).code;
		app.clientRouteDetail = function(id){
			var obj = routeTree.client[id];
			if(!obj) return;
			var resObj = {};
			for(var k in obj) {
				if(ROUTE_PROP_REVERSE_MAP[k]) resObj[ROUTE_PROP_REVERSE_MAP[k]] = obj[k];
			}
			return resObj;
		};
		app.clientRoute = function(path){
			return pathParser(ROUTE_PROP_REVERSE_MAP, routeTree, path);
		};
		// write to cache if needed
		if(fw.debug) return cb();
		fs.writeFile(app.config.client.cache + '/~fw/routes.js', app.clientRoutesFileContent, function(err){
			if(err) {
				console.error(err.stack || 'Error: ' + err.message);
			}
			cb();
		});
	};

	// client route management
	var client = {};
	var minifyJobs = [];
	var clear = function(){
		client = {};
		minifyJobs = [];
	};
	// set a single route
	var setRoute = function(base, id, oriObj, isAdd){
		// normalize base
		if(base.slice(-1) !== '/') base += '/';
		if(base.charAt(0) === '/') base = base.slice(1);
		if(oriObj.base) base = path.resolve('/', base, oriObj.base);
		// convert relative id to absolute
		if(id.indexOf('.') >= 0 || id.indexOf('/') >= 0 || id.indexOf('*') >= 0) {
			// relative path routing
			if(id.charAt(0) !== '/') id = path.resolve('/', base, id);
		} else {
			id += ':/' + base;
		}
		// get initial route obj
		if(!isAdd) var obj = {};
		else var obj = client[id] || {};
		client[id] = obj;
		// basic route properties
		if(!isAdd && oriObj.redirect) {
			// redirect
			var r = oriObj.redirect;
			if(r.charAt(0) !== '/') r = path.resolve('/', base, r);
			obj[ROUTE_PROP_MAP.redirect] = r;
			return;
		}
		// base, reload, render
		if(!isAdd) {
			obj[ROUTE_PROP_MAP.base] = base;
			if(oriObj.reload) obj[ROUTE_PROP_MAP.reload] = oriObj.reload;
			if(oriObj.render) {
				obj[ROUTE_PROP_MAP.render] = oriObj.render;
				if(obj[ROUTE_PROP_MAP.render].slice(-3) === '.js') {
					obj[ROUTE_PROP_MAP.render] = obj[ROUTE_PROP_MAP.render].slice(0, -3);
				}
			}
			if(oriObj.parent) obj[ROUTE_PROP_MAP.parent] = oriObj.parent;
		}
		// filter main, lib, tmpl, style
		var combineList = function(oldList, newList, defExt){
			var res = [];
			if(oldList) res = res.concat(oldList);
			if(newList) res = res.concat(newList);
			for(var i=0; i<res.length; i++) {
				var item = res[i];
				if(typeof(item) === 'object') {
					// remove default extname
					if(item.src.constructor === Array) {
						for(var j=0; j<item.src.length; j++) {
							if(item.src[j].slice(-defExt.length) === defExt) {
								item.src[j] = item.src[j].slice(0, -defExt.length);
							}
						}
					} else {
						item.src = String(item.src);
						if(item.src.slice(-defExt.length) === defExt) {
							item = item.src.slice(0, -defExt.length);
						}
					}
				} else {
					res[i] = String(res[i]);
					if(res[i].slice(-defExt.length) === defExt) {
						res[i] = res[i].slice(0, -defExt.length);
					}
				}
			}
			if(res.length <= 1) return res[0];
			return res;
		};
		obj[ROUTE_PROP_MAP.lib] = combineList(obj[ROUTE_PROP_MAP.lib], oriObj.lib, '.js');
		if(!obj[ROUTE_PROP_MAP.lib]) delete obj[ROUTE_PROP_MAP.lib];
		obj[ROUTE_PROP_MAP.main] = combineList(obj[ROUTE_PROP_MAP.main], oriObj.main, '.js');
		if(!obj[ROUTE_PROP_MAP.main]) delete obj[ROUTE_PROP_MAP.main];
		obj[ROUTE_PROP_MAP.style] = combineList(obj[ROUTE_PROP_MAP.style], oriObj.style, '.css');
		if(!obj[ROUTE_PROP_MAP.style]) delete obj[ROUTE_PROP_MAP.style];
		obj[ROUTE_PROP_MAP.tmpl] = combineList(obj[ROUTE_PROP_MAP.tmpl], oriObj.tmpl, '.tmpl');
		if(!obj[ROUTE_PROP_MAP.tmpl]) delete obj[ROUTE_PROP_MAP.tmpl];
	};
	// set route api
	var set = function(prefix, id, obj){
		if(typeof(id) === 'object') {
			obj = id;
			id = prefix;
			prefix = '/';
		}
		setRoute(prefix, id, obj);
	};
	var setList = function(prefix, obj){
		if(typeof(prefix) === 'object') {
			obj = prefix;
			prefix = '/';
		}
		for(var k in obj) {
			setRoute(prefix, k, obj[k]);
		}
	};
	var add = function(prefix, id, obj){
		if(typeof(id) === 'object') {
			obj = id;
			id = prefix;
			prefix = '/';
		}
		setRoute(prefix, id, obj, true);
	};

	// update to app object
	var update = function(pageRouterInfo, cb){
		generatePageRoutes(pageRouterInfo, function(page){
			parseSubmodules(app, function(submodules){
				updateRoutes(client, submodules, page, cb);
			});
		});
	};

	return {
		clear: clear,
		set: set,
		setList: setList,
		add: add,
		update: update
	};
};
