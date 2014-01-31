// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// extend
var deepExtend = function(dest, src) {
	for (var prop in src) {
		if (typeof src[prop] === "object" && src[prop] !== null ) {
			dest[prop] = dest[prop] || {};
			deepExtend(dest[prop], src[prop]);
		} else {
			dest[prop] = src[prop];
		}
	}
	return dest;
};
var shallowExtend = function(dest, src) {
	for (var prop in src) {
		dest[prop] = src[prop];
	}
	return dest;
};

// uuid utils
var uuid = fw.uuid = function(){
	var s4 = function(n){
		if(typeof(n) !== 'undefined')
			return (n+0x10000).toString(16).slice(1);
		return Math.floor((1+Math.random())*0x10000).toString(16).slice(1);
	};
	if(crypto && crypto.getRandomValues) {
		var a = new Uint16Array(8);
		crypto.getRandomValues(a);
		return s4(a[0])+s4(a[1]) + '-' + s4(a[2]) + '-' + s4(a[3]) + '-' + s4(a[4]) + '-' + s4(a[5])+s4(a[6])+s4(a[7]);
	}
	return s4()+s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4()+s4()+s4();
};

// Event Handler
var EventHandler = {
	on: function(e, func){
		if(this.events[e]) this.events[e].push(func);
		else this.events[e] = [func];
		return this;
	},
	off: function(e, func){
		if(!this.events[e]) return this;
		var a = this.events[e];
		for(var i=0; i<a.length; i++)
			if(a[i] === func) {
				a.splice(i, 1);
				break;
			}
		if(a.length === 0) delete this.events[e];
		return this;
	},
	trigger: function(e, args){
		var a = this.events[e];
		if(!a) return this;
		var fs = [];
		for(var i=0; i<a.length; i++) fs.push(a[i]);
		while(fs.length) {
			try {
				if(!args) args = [];
				fs.shift().apply(this, args);
			} catch(e) {
				setTimeout(function(){
					throw e;
				}, 0);
			};
		}
		return this;
	}
};

// connect socket
var sock = (function(){
	var stat = 'uninitialized';
	var socket = null;
	var url = '';
	var auth = '';
	var conns = {};

	// retry manager
	var retryTimeouts = [1000, 3000, 10000, 25000, 60000];
	var retryTimes = 0;
	var retryObj = null;
	var retryCancel = function(){
		if(!retryObj) return;
		clearTimeout(retryObj);
	};
	var retryReset = function(){
		retryCancel();
		retryTimes = 0;
	};
	var retry = function(func){
		retryObj = setTimeout(function(){
			retryObj = null;
			func();
		}, retryTimeouts[retryTimes]);
		if(retryTimes < retryTimeouts.length - 1)
			retryTimes++;
	};

	// connection management
	var connect = function(){
		if(stat !== 'disconnected') return;
		stat = 'connecting';
		socket = new SockJS(url);
		socket.onopen = onopen;
		socket.onclose = onclose;
		socket.onmessage = onmessage;
	};
	var onopen = function(){
		stat = 'auth';
		socket.send(auth);
	};
	var onauth = function(){
		if(stat !== 'auth') return;
		retryReset();
		for(var k in conns)
			conns[k].pgObj.trigger('socketConnect');
	};
	var onclose = function(){
		stat = 'uninitialized';
		retry(init);
		socket.onopen = socket.onclose = socket.onmessage = function(){};
		for(var k in conns)
			conns[k].pgObj.trigger('socketDisconnect');
	};
	var onmessage = function(e){
		var json = e.data;
		var data = JSON.parse(json);
		var connId = data[0];
		var method = data[1];
		var data = data[2];
		if(!conn) {
			if(method === 'auth') {
				// auth
				onauth();
				if(fw.debug) console.log('Socket connected: '+auth);
			}
		} else if(typeof(method) === 'number') {
			// respond
			var conn = conns[connId];
			if(!conn) return;
			if(fw.debug) console.log('RPC respond: '+JSON.stringify(data));
			var cb = conn.res[method];
			if(!cb) return;
			delete conn.res[method];
			cb.call(conn.pgObj, data);
		} else {
			// events
			var conn = conns[connId];
			if(!conn) return;
			if(fw.debug) console.log('MSG '+method+': '+JSON.stringify(data));
			conn.trigger(method, data);
		}
	};

	// sub conn manager
	var Conn = function(pg){
		this.pgObj = pg.obj;
		this.res = {};
		this.events = {};
	};
	Conn.prototype = EventHandler;
	var conn = function(pg){
		do { var connId = uuid().slice(-17); } while(conns[connId]);
		var conn = conns[connId] = new Conn(pg);
		var pgObj = pg.obj;
		pgObj.rpc = function(method, data, cb, timeoutCb){
			if(typeof(data) === 'function') {
				var t = data;
				data = cb;
				cb = t;
			}
			do { var callId = uuid().slice(-17); } while(conn.res[callId]);
			if(cb) {
				conn.res[callId] = cb;
				setTimeout(function(){
					if(conn.res[callId]) {
						delete conn.res[callId];
						if(timeoutCb) timeoutCb.call(pgObj);
					}
				}, fw.timeout);
			}
			socket.send([connId, callId, method, data]);
		};
		pgObj.msg = function(e, func){
			conn.on(e, func);
		};
		pgObj.msgOff = function(e, func){
			conn.off(e, func);
		};
		return conn;
	};

	// get init data and init
	var init = function(){
		if(stat !== 'uninitialized') return;
		stat = 'initializing';
		retryCancel();
		var tag = document.createElement('script');
		tag.onerror = tag.onabort = tag.onload = tag.onreadystatechange = function(){
			if(this.readyState && this.readyState !== 'loaded' && this.readyState !== 'complete')
				return;
			this.onerror = this.onabort = this.onload = this.onreadystatechange = null;
			document.head.removeChild(this);
			if(stat === 'initializing') {
				stat = 'uninitialized';
				retry(init);
			}
		};
		tag.src = '/$conf/sock.js';
		document.head.appendChild(tag);
	};
	fw.sockConfig = function(config){
		if(stat !== 'initializing') return;
		stat = 'disconnected';
		url = config.url;
		auth = config.auth;
		connect();
	};

	return {
		init: init,
		conn: conn,
		getStatus: function(){
			return stat;
		}
	};
})();

// script loader
var scriptsLoaded = {};
var requireScript = function(file, isLib){
	if(isLib && scriptsLoaded[file]) return;
	fw
		.loadJs(file + ( fw.debug ? '' : '?v=' + fw.version ))
		.loadJs(function(){
			scriptsLoaded[file] = true;
		});
};
var requireScriptName = function(base, file){
	if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
		if(file.slice(-3) !== '.js') file += '.js';
		if(file.charAt(0) === '/') {
			file = '/$' + file;
		} else {
			file = '/$/' + base + file;
		}
	}
	return file;
};
var requireScripts = function(base, files, isLib){
	if(!files) files = [];
	else if(typeof(files) !== 'object') files = [files];
	for(var i=0; i<files.length; i++) {
		var file = requireScriptName(base, files[i]);
		requireScript(file, isLib);
	}
};

// template manager
var tmplsFiles = {};
var curTmplsFile = '';
fw.newTmpls = function(tmpls){
	if(!curTmplsFile) return;
	var cur = tmplsFiles[curTmplsFile] = {};
	for(var k in tmpls)
		cur[k] = Handlebars.template(tmpls[k]);
	curTmplsFile = '';
};
var requireTmplsFile = function(file){
	if(!tmplsFiles[file])
		fw.loadJs(function(){
			curTmplsFile = file;
		}).loadJs(file + ( fw.debug ? '' : '?v=' + fw.version ));
	fw.loadJs(function(){
		var tmpls = tmplsFiles[file];
		for(var k in tmpls)
			curPgObj.tmpl[k] = tmpls[k];
	});
};
var requireTmplsFiles = function(base, files){
	if(!files) files = [];
	else if(typeof(files) !== 'object') files = [files];
	for(var i=0; i<files.length; i++) {
		var file = files[i];
		if(file.slice(-5) !== '.tmpl') file += '.tmpl.js';
		requireTmplsFile(requireScriptName(base, file));
	}
};

// style manager
var styleStack = [];
var removeStyles = function(){
	var tags = styleStack.pop();
	for(var i=0; i<tags.length; i++)
		document.head.removeChild(tags[i]);
};
var requireStyle = function(file, cb){
	var tag = document.createElement('link');
	tag.onerror = tag.onabort = tag.onload = tag.onreadystatechange = function(){
		if(this.readyState && this.readyState !== 'loaded' && this.readyState !== 'complete')
			return;
		this.onerror = this.onabort = this.onload = this.onreadystatechange = null;
		cb(this);
	};
	tag.rel = "stylesheet";
	tag.type = 'text/css';
	if(!fw.debug) file += '?v=' + fw.version;
	tag.href = file;
	document.head.appendChild(tag);
};
var requireStyles = function(base, files, cb){
	var stopped = false;
	var stop = function(){
		stopped = true;
	};
	var tags = [];
	styleStack.push(tags);
	if(!files) {
		cb();
		return stop;
	}
	if(typeof(files) !== 'object') files = [files];
	var c = files.length;
	for(var i=0; i<files.length; i++) {
		var file = files[i++];
		if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
			if(file.slice(-4) !== '.css') file += '.stylus.css';
			if(file.charAt(0) === '/') {
				file = '/$' + file;
			} else {
				file = '/$/' + base + file;
			}
		}
		requireStyle(file, function(tag){
			if(stopped) {
				document.head.removeChild(tag);
				return;
			}
			tags.push(tag);
			c--;
			if(c) return;
			cb();
		});
	}
	return stop;
};

// route parser
var routeTree = null;
var clientRoutes = null;
var routeParser = function(client, page){
	var tree = {
		client: client,
		page: page,
		val: false,
		children: {}
	};
	var treeChild = function(node, index){
		if(node.hasOwnProperty.call(node.children, index))
			return node.children[index];
	};
	var treeAdd = function(path, val){
		var cur = tree;
		var segs = path.split('/');
		while(segs.length) {
			var seg = segs.shift();
			if(!seg) continue;
			if(seg.charAt(0) === ':') seg = '';
			var child = treeChild(cur, seg);
			if(!child)
				child = cur.children[seg] = {
					val: false,
					children: {}
				};
			cur = child;
		}
		cur.val = val;
	};
	for(var k in client) {
		var keys = k.match(/\/:[a-z0-9_]*/gi);
		if(keys) {
			for(var i=0; i<keys.length; i++)
				keys[i] = keys[i].slice(2);
			client[k].keys = keys;
		}
		treeAdd(k, k);
	}
	for(var i=0; i<page.length; i++)
		treeAdd(page[i], true);
	return tree;
};
var pathParser = function(tree, path){
	// find node
	var cur = tree;
	var argVals = [];
	var segs = path.split('/');
	while(segs.length && cur) {
		var seg = segs.shift();
		if(!seg) continue;
		var child = cur.hasOwnProperty.call(cur.children, seg);
		if(child) {
			cur = cur.children[seg];
		} else {
			cur = cur.children[''];
			argVals.push(seg);
		}
	}
	if(!cur || !cur.val) return null;
	if(cur.val === true) return 'page';
	// get vals
	var obj = tree.client[cur.val];
	var args = {};
	if(obj.keys)
		for(var i=0; i<obj.keys.length; i++)
			args[obj.keys[i]] = argVals[i];
	return {
		id: cur.val,
		route: obj,
		args: args
	};
};
fw.routes = function(routes){
	clientRoutes = routes.client;
	routeTree = routeParser(routes.client, routes.page);
};

// pg creator
var PgObj = function(parent){
	this.parent = parent;
	this.tmpl = {};
	this.events = {};
};
var pgProto = PgObj.prototype = EventHandler;

// page manager
var curPath = '';
var curArgs = {};
var curPgObj = null;
fw.getPath = function(){
	return curPath;
};
fw.getArgs = function(){
	return curArgs;
};
fw.getPage = function(){
	return curPgObj;
};
fw.isLoading = function(){
	return pageLoading;
};
fw.stopLoading = function(){
	if(!pageLoading) return;
	pageLoading = false;
	if(stopLoadSubpage) stopLoadSubpage();
};

// page loader
var pageLoading = false;
var pgStack = [];
var stopLoadSubpage = null;
var unloadSubpage = function(){
	var pg = pgStack.pop();
	// destroy pg obj
	pg.destroyed = true;
	pg.obj.readyState = 'unloaded';
	pg.obj.trigger('unload');
	removeStyles();
	// call parent
	pg = pgStack[pgStack.length-1];
	curPgObj = pg.obj;
	curPgObj.trigger('childUnload');
};
var loadSubpage = function(id, cb){
	var parent = pgStack[pgStack.length-1];
	var route = clientRoutes[id];
	var pg = {
		destroyed: false,
		routeId: id,
		route: route,
		obj: new PgObj(parent)
	};
	pg.obj.readyState = 'loading';
	pg.obj.routeId = id;
	if(parent) parent.obj.trigger('childLoadStart');
	pgStack.push(pg);
	curPgObj = pg.obj;
	// insert css
	var stopStyles = requireStyles(route.base, route.style, function(){
		stopStyles = null;
		// load tmpls, libs, and main
		requireTmplsFiles(route.base, route.tmpl);
		requireScripts(route.base, route.lib, true);
		requireScripts(route.base, route.main, false);
		fw.loadJs(function(){
			if(!pageLoading) return;
			pg.obj.readyState = 'loaded';
			pg.obj.trigger('load');
			if(parent) parent.obj.trigger('childLoadEnd');
			cb();
		}).loadJs();
	});
	// stop loading
	stopLoadSubpage = function(){
		if(pg.obj.readyState !== 'loading') return;
		pg.obj.readyState = 'stopped';
		if(stopStyles) stopStyles();
		else fw.loadJs(false);
		if(parent) parent.obj.trigger('childLoadStopped');
		cb();
	};
};
var loadPage = function(path){
	if(pageLoading) return false;
	pageLoading = true;
	// routing
	if(path === '/$webapp') path = '/';
	var obj = pathParser(routeTree, path);
	if(obj === 'page') {
		// special page
		location.pathname = path;
		pageLoading = false;
		return true;
	}
	if(!obj) {
		// 404
		var id = '*';
		var route = clientRoutes['*'];
		var args = {};
		if(!route) {
			pageLoading = false;
			return false;
		}
	} else {
		// common
		var id = obj.id;
		var route = obj.route;
		var args = obj.args;
	}
	// compare parents stack
	var stack = [id];
	for(var r=route; r.parent; r=clientRoutes[r.parent])
		stack.unshift(r.parent);
	for(var i=0; i<stack.length-1; i++)
		if(!pgStack[i] || stack[i] !== pgStack[i].routeId) break;
	// destroy and load subpages
	for(var j=pgStack.length-1; j>=i; j--)
		unloadSubpage();
	curPath = path;
	curArgs = args;
	var j = i;
	var next = function(){
		if(!pageLoading || j >= stack.length) {
			pageLoading = false;
			return;
		}
		loadSubpage(stack[j++], next);
	};
	next(false);
	return true;
};

// history management
window.onpopstate = function(){
	if(location.pathname !== curPath)
		loadPage(location.pathname);
};
fw.go = function(path){
	fw.stopLoading();
	if(typeof(path) === 'number') {
		return history.go(path);
	} else {
		if(history.pushState) {
			history.pushState({}, '', path);
			return loadPage(path);
		} else {
			return location.href = path;
		}
	}
};
fw.redirect = function(path){
	if(history.replaceState) {
		history.replaceState({}, '', path);
		return loadPage(path);
	} else {
		return location.replace(path);
	}
};

// shortcut helpers
fw.sc = {
	go: function(tag, e){
		if(e && e.preventDefault) e.preventDefault();
		else window.event.returnValue = false;
		fw.go(tag.getAttribute('href'));
	}
};

// load routes and start
var routesLoaded = function(){
	sock.init();
	var path = location.pathname;
	loadPage(path);
};
fw
	.loadJs('/$rc/routes.js' + ( fw.debug ? '' : '?v=' + fw.version ))
	.loadJs(routesLoaded)
	.loadJs();
