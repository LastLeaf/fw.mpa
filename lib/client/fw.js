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
	emit: function(e, args){
		var a = this.events[e];
		if(!a) return this;
		var fs = [];
		for(var i=0; i<a.length; i++) fs.push(a[i]);
		while(fs.length) {
			try {
				var a = [];
				for(var i=1; i<arguments.length; i++)
					a.push(arguments[i]);
				fs.shift().apply(this, a);
			} catch(e) {
				setTimeout(function(){
					throw e;
				}, 0);
			};
		}
		return this;
	}
};

// reload page when server version changed
fw.onupgradeneeded = function(){
	location.reload();
};

// connect socket
var sock = (function(){
	var stat = 'uninitialized';
	var socket = null;
	var url = '';
	var auth = '';
	var conns = {};
	var connectedFuncs = [];

	// retry manager
	var retryTimeouts = [1000, 3000, 10000, 25000, 60000];
	var retryTimes = 0;
	var retryObj = null;
	var retryFunc = null;
	var retryCancel = function(){
		if(!retryObj) return;
		clearTimeout(retryObj);
	};
	var retryReset = function(){
		retryCancel();
		retryTimes = 0;
	};
	var retry = function(func){
		retryCancel();
		retryFunc = func;
		retryObj = setTimeout(function(){
			retryObj = null;
			retryFunc();
		}, retryTimeouts[retryTimes]);
		if(retryTimes < retryTimeouts.length - 1)
			retryTimes++;
	};
	var retryNow = function(){
		if(!retryObj) return;
		clearTimeout(retryObj);
		retryObj = null;
		retryFunc();
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
		stat = 'connected';
		retryReset();
		for(var k in conns) {
			conns[k].used = false;
			conns[k].pgObj.emit('socketConnect');
		}
		while(connectedFuncs.length)
			(connectedFuncs.shift())();
	};
	var onclose = function(){
		stat = 'uninitialized';
		if(fw.debug) console.log('Socket disconnected.');
		retry(init);
		socket.onopen = socket.onclose = socket.onmessage = function(){};
		for(var k in conns)
			conns[k].pgObj.emit('socketDisconnect');
	};
	var onmessage = function(e){
		var json = e.data;
		var data = JSON.parse(json);
		var connId = data[0];
		var method = data[1];
		var data = data[2];
		if(!connId) {
			if(method === 'auth') {
				// auth
				if(fw.debug) console.log('Socket connected.');
				onauth();
			}
		} else if(method.charAt(0) === '~') {
			// respond
			method = method.slice(1);
			var conn = conns[connId];
			if(!conn) return;
			if(fw.debug) console.log('RPC res: '+JSON.stringify(data));
			var cb = conn.res[method];
			if(!cb) return;
			delete conn.res[method];
			cb.call(conn.pgObj, data);
		} else {
			// events
			var conn = conns[connId];
			if(!conn) return;
			if(fw.debug) console.log('MSG '+method+': '+JSON.stringify(data));
			conn.emit(method, data);
		}
	};

	// sub conn manager
	var Conn = function(pg){
		this.used = false;
		this.pgObj = pg.obj;
		this.res = {};
		this.events = {};
	};
	Conn.prototype = EventHandler;
	var connInit = function(pg){
		do { var connId = uuid().slice(-17); } while(conns[connId]);
		pg.connId = connId;
		var conn = conns[connId] = new Conn(pg);
		var pgObj = pg.obj;
		pgObj.rpc = function(method, data, cb, timeoutCb){
			if(typeof(data) === 'function') {
				timeoutCb = cb;
				cb = data;
			}
			do { var callId = uuid().slice(-17); } while(conn.res[callId]);
			if(cb) {
				conn.res[callId] = cb;
				setTimeout(function(){
					if(!conn.res[callId]) return;
					delete conn.res[callId];
					if(timeoutCb) timeoutCb.call(pgObj);
				}, fw.timeout);
			}
			var sent = false;
			var req = function(){
				if(sent) return;
				sent = true;
				conn.used = true;
				socket.send(JSON.stringify([connId, callId, method, data]));
			};
			if(stat === 'connected') req();
			else {
				connectedFuncs.push(req);
				retryNow();
			}
			if(fw.debug) console.log('RPC '+method+': '+JSON.stringify(data));
		};
		pgObj.msg = function(e, func){
			conn.on(e, func);
		};
		pgObj.msgOff = function(e, func){
			conn.off(e, func);
		};
		return conn;
	};
	var connStart = function(pg){
		if(stat === 'connected') pg.obj.emit('socketConnect');
	};
	var connEnd = function(pg){
		var conn = conns[pg.connId];
		delete conns[pg.connId];
		if(conn.used && stat === 'connected') socket.send(['', 'end', pg.connId]);
		pg.obj.emit('socketDisconnect');
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
		tag.src = '/~conf/sock.js' + ( fw.debug ? '' : '?v=' + fw.version );
		document.head.appendChild(tag);
	};
	fw._sockConfig = function(config){
		if(stat !== 'initializing') return;
		stat = 'disconnected';
		url = config.url;
		auth = config.auth;
		connect();
	};

	return {
		init: init,
		connInit: connInit,
		connStart: connStart,
		connEnd: connEnd,
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
		._loadJs(file + ( fw.debug ? '' : '?v=' + fw.version ))
		._loadJs(function(){
			scriptsLoaded[file] = true;
		});
};
var requireScriptName = function(base, file){
	if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
		if(file.slice(-3) !== '.js') file += '.js';
		if(file.charAt(0) === '/') {
			file = '/~' + file;
		} else {
			file = '/~/' + base + file;
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
fw._tmpls = function(tmpls){
	if(!curTmplsFile) return;
	var cur = tmplsFiles[curTmplsFile] = {};
	for(var k in tmpls)
		cur[k] = Handlebars.template(tmpls[k]);
	curTmplsFile = '';
};
var requireTmplsFile = function(file){
	if(!tmplsFiles[file])
		fw._loadJs(function(){
			curTmplsFile = file;
		})._loadJs(file + ( fw.debug ? '' : '?v=' + fw.version ));
	fw._loadJs(function(){
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
				file = '/~' + file;
			} else {
				file = '/~/' + base + file;
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
fw._routes = function(routes){
	clientRoutes = routes.client;
	routeTree = routeParser(routes.client, routes.page);
};

// pg creator
var PgObj = function(parent){
	if(parent) this.parent = parent.obj;
	this.tmpl = {};
	this.events = {};
};
var pgProto = PgObj.prototype = EventHandler;
pgProto.form = function(tag, submitCb, cb, timeoutCb){
	if(!tag.fw) tag.fw = {};
	tag.fw.page = this;
	tag.fw.formSubmitCb = submitCb;
	tag.fw.formCb = cb;
	tag.fw.formTimeoutCb = timeoutCb;
};

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
var loadCount = 0;
var pageLoading = false;
var pgStack = [];
var stopLoadSubpage = null;
var unloadSubpage = function(){
	var pg = pgStack.pop();
	// destroy pg obj
	if(pg.route.reload === 'out' || pg.route.reload === 'both')
		location.reload();
	pg.destroyed = true;
	pg.obj.readyState = 'unloaded';
	sock.connEnd(pg);
	pg.obj.emit('unload');
	removeStyles();
	// call parent
	pg = pgStack[pgStack.length-1];
	curPgObj = pg.obj;
	curPgObj.emit('childUnload');
};
var loadSubpage = function(id, cb){
	var parent = pgStack[pgStack.length-1];
	var route = clientRoutes[id];
	if(loadCount > 1 && (route.reload === 'in' || route.reload === 'both'))
		location.reload();
	var pg = {
		destroyed: false,
		routeId: id,
		route: route,
		obj: new PgObj(parent)
	};
	pg.obj.readyState = 'loading';
	pg.obj.routeId = id;
	if(parent) parent.obj.emit('childLoadStart');
	pgStack.push(pg);
	curPgObj = pg.obj;
	// insert css
	var stopStyles = requireStyles(route.base, route.style, function(){
		stopStyles = null;
		// load tmpls, libs, and main
		requireTmplsFiles(route.base, route.tmpl);
		requireScripts(route.base, route.lib, true);
		requireScripts(route.base, route.main, false);
		fw._loadJs(function(){
			if(!pageLoading) return;
			sock.connInit(pg);
			pg.obj.readyState = 'loaded';
			pg.obj.emit('load');
			if(parent) parent.obj.emit('childLoadEnd');
			sock.connStart(pg);
			cb();
		})._loadJs();
	});
	// stop loading
	stopLoadSubpage = function(){
		if(pg.obj.readyState !== 'loading') return;
		pg.obj.readyState = 'stopped';
		if(stopStyles) stopStyles();
		else fw._loadJs(false);
		if(parent) parent.obj.emit('childLoadStop');
		cb();
	};
};
var loadPage = function(path){
	if(pageLoading) return false;
	pageLoading = true;
	// routing
	if(path === '/~webapp') path = '/';
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
	loadCount++;
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
if(location.hash.slice(0, 2) === '#/')
	location.replace(location.hash.slice(1));
if(window.onpopstate === null) {
	window.onpopstate = function(){
		if(location.pathname !== curPath)
			loadPage(location.pathname);
	};
} else {
	var prevHash = location.hash;
	var prevHashCheck = function(){
		if(prevHash === location.hash) return;
		prevHash = location.hash;
		if(prevHash.slice(0, 2) === '#/')
			loadPage(prevHash.slice(1));
	};
	if(window.onhashchange === null)
		window.onhashchange = prevHashCheck;
	else
		setInterval(prevHashCheck, 250);
}
fw.go = function(path){
	fw.stopLoading();
	if(typeof(path) === 'number') {
		return history.go(path);
	} else {
		if(history.pushState)
			history.pushState({}, '', path);
		else
			prevHash = location.hash = '#'+path;
		return loadPage(path);
	}
};
fw.redirect = function(path){
	if(history.replaceState)
		history.replaceState({}, '', path);
	return loadPage(path);
};

// shortcut helpers
var addListener = function(tag, e, func){
	if(tag.addEventListener) tag.addEventListener(e, func, false);
	else tag.attachEvent(e, func);
};
addListener(document, 'click', function(e){
	if(e) {
		if(e.defaultPrevented) return;
		var tag = e.target;
	} else {
		if(!window.event.returnValue) return;
		var tag = window.event.srcElement;
	}
	if(typeof(tag.getAttribute('fw')) !== 'string') return;
	if(tag.tagName === 'A') {
		// go to page using fw.go
		if(e && e.preventDefault) e.preventDefault();
		else window.event.returnValue = false;
		fw.go(tag.getAttribute('href'));
	}
});
addListener(document, 'submit', function(e){
	if(e) {
		if(e.defaultPrevented) return;
		var tag = e.target;
	} else {
		if(!window.event.returnValue) return;
		var tag = window.event.srcElement;
	}
	if(typeof(tag.getAttribute('fw')) !== 'string') return;
	if(tag.tagName === 'FORM') {
		// submit
		if(e && e.preventDefault) e.preventDefault();
		else window.event.returnValue = false;
		for(var pgTag = tag; pgTag; pgTag = pgTag.parentNode)
			if(pgTag.fw && pgTag.fw.page) break;
		if(!pgTag) return;
		var p = tag.getAttribute('action');
		var m = tag.getAttribute('method');
		if(m) p += ':' + m;
		var a = tag.elements;
		var args = {};
		for(var i=0; i<a.length; i++)
			if(a[i].name) args[a[i].name] = a[i].value;
		if(pgTag.fw.formSubmitCb && pgTag.fw.formSubmitCb() === false)
			return;
		pgTag.fw.page.rpc(p, args, pgTag.fw.formCb, pgTag.fw.formTimeoutCb);
	}
});

// load routes and start
var routesLoaded = function(){
	sock.init();
	var path = location.pathname;
	loadPage(path);
};
fw
	._loadJs('/~rc/routes.js' + ( fw.debug ? '' : '?v=' + fw.version ))
	._loadJs(routesLoaded)
	._loadJs();
