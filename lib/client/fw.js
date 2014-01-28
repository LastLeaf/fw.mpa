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

// connect socket
(function(){
	var socket = null;
	var url = '';
	var authStr = '';
	var socketRes = {};
	var socketFuncs = {};
	var socketFuncsSave = {};
	var online = false;
	var isSubClean = true;
	var connecting = false;
	var reconnectTimeouts = [1, 3, 10, 30, 60];
	var reconnectTimes = 0;
	var connectTimeout = 20;
	var reconnectObj = null;
	var doneFuncs = [];
	var failFuncs = [];
	var onlineFuncs = [];
	var offlineFuncs = [];
	var onlineFuncsSave = [];
	var offlineFuncsSave = [];

	// connection management
	var connect = function(){
		if(online || connecting || !url) return;
		connecting = true;
		if(reconnectObj) {
			clearTimeout(reconnectObj);
			reconnectObj = null;
		}
		socket = new SockJS(url);
		socket.onopen = onopen;
		socket.onclose = onclose;
		socket.onmessage = onmessage;
	};
	var onopen = function(){
		socket.send(authStr);
	};
	var onauth = function(){
		online = true;
		connecting = false;
		reconnectTimes = 0;
		isSubClean = true;
		var f = doneFuncs;
		doneFuncs = [];
		failFuncs = [];
		for(var i=0; i<onlineFuncs.length; i++)
			onlineFuncs[i]();
		for(var i=0; i<f.length; i++)
			f[i]();
	};
	var onclose = function(){
		online = false;
		connecting = false;
		socket.onopen = socket.onclose = function(){};
		reconnectObj = setTimeout(connect, reconnectTimeouts[reconnectTimes]*1000);
		if(reconnectTimes < reconnectTimeouts.length-1)
			reconnectTimes++;
		var f = failFuncs;
		doneFuncs = [];
		failFuncs = [];
		for(var i=0; i<f.length; i++)
			f[i]();
		for(var i=0; i<offlineFuncs.length; i++)
			offlineFuncs[i]();
	};
	fw.checkSocketOnline = function(){
		return online;
	};
	fw.reconnect = function(doneFunc, failFunc){
		if(online) {
			doneFunc();
			return;
		}
		if(doneFunc) doneFuncs.push(doneFunc);
		if(failFunc) failFuncs.push(failFunc);
		connect();
	};

	// send
	fw.rpc = function(method, data, replyFunc, sendFunc, failFunc){
		isSubClean = false;
		var id = new Date().getTime() + Math.random();
		fw.reconnect(function(){
			if(replyFunc) socketRes[id] = replyFunc;
			if(typeof(data) === 'undefined')
				socket.send(JSON.stringify([id, method]));
			else
				socket.send(JSON.stringify([id, method, data]));
			//console.log('RPC '+method+':'+JSON.stringify(data));
			if(sendFunc) sendFunc();
		}, failFunc);
	};
	fw.resetSubConnection = function(){
		if(isSubClean) return;
		socket.send('[0,""]');
		isSubClean = true;
	};

	// listners
	fw.socketListenersStateRestore = function(){
		socketRes = {};
		socketFuncs = shallowExtend({}, socketFuncsSave);
		doneFuncs = [];
		failFuncs = [];
		onlineFuncs = [];
		offlineFuncs = [];
		for(var i=0; i<onlineFuncsSave.length; i++)
			onlineFuncs.push(onlineFuncsSave);
		for(var i=0; i<offlineFuncsSave.length; i++)
			offlineFuncs.push(offlineFuncsSave);
	};
	fw.socketListenersStateSave = function(){
		socketFuncsSave = shallowExtend({}, socketFuncs);
		onlineFuncsSave = [];
		offlineFuncsSave = [];
		for(var i=0; i<onlineFuncs.length; i++)
			onlineFuncsSave.push(onlineFuncs);
		for(var i=0; i<offlineFuncs.length; i++)
			offlineFuncsSave.push(offlineFuncs);
	};

	// socket events
	var onmessage = function(e){
		var json = e.data;
		var data = JSON.parse(json);
		var method = data[0];
		var data = data[1];
		if(typeof(method) === 'number') {
			if(method === 0) {
				// auth
				onauth();
			} else {
				// responded message
				//console.log('RPC respond:'+JSON.stringify(data));
				if(socketRes.hasOwnProperty(method))
					socketRes[method](data);
			}
		} else {
			// events
			//console.log('EVENT '+method+':'+JSON.stringify(data));
			var f = socketFuncs[method];
			if(socketFuncs.hasOwnProperty(method))
				for(var i=0; i<f.length; i++)
					f[i](data);
		}
	};
	fw.on = function(method, func){
		if(!socketFuncs.hasOwnProperty(method))
			socketFuncs[method] = [func];
		else
			socketFuncs[method].push(func);
	};

	// socket status listeners
	fw.onSocketOnline = function(func){
		onlineFuncs.push(func);
	};
	fw.onSocketOffline = function(func){
		offlineFuncs.push(func);
	};

	fw.socketConnect = function(u, a){
		url = u;
		authStr = a;
		connect();
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
			curPg.tmpl[k] = tmpls[k];
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
	tag.onload = tag.onerror = tag.onabort = function(){
		cb(tag);
	};
	tag.rel = "stylesheet";
	tag.type = 'text/css';
	if(!fw.debug) file += '?v=' + fw.version;
	tag.href = file;
	document.head.appendChild(tag);
};
var requireStyles = function(base, files, cb){
	if(!files) {
		styleStack.push([]);
		setTimeout(cb, 0);
		return;
	}
	if(typeof(files) !== 'object') files = [files];
	var c = files.length;
	var tags = [];
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
			tags.push(tag);
			c--;
			if(c) return;
			styleStack.push(tags);
			cb();
		});
	}
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
	routesLoaded();
};

// pg creator
var PgObj = function(parent){
	this.parent = parent;
	this.tmpl = {};
};
var pgProto = PgObj.prototype = new EventEmitter();

// page manager
var curPath = '';
var curArgs = {};
var curPg = null;
fw.getPath = function(){
	return curPath;
};
fw.getArgs = function(){
	return curArgs;
};
fw.getPage = function(){
	return curPg;
};

// page loader
var pageLoading = false;
var pgStack = [];
var unloadSubpage = function(){
	var pg = pgStack.pop();
	pg.obj.trigger('unload');
	// remove css
	removeStyles();
	// call parent
	pg = pgStack[pgStack.length-1];
	curPg = pg.obj;
	curPg.trigger('childUnload');
};
var loadSubpage = function(id, cb){
	var parent = pgStack[pgStack.length-1];
	var route = clientRoutes[id];
	var pg = {
		routeId: id,
		route: route,
		obj: new PgObj(parent)
	};
	if(parent) parent.obj.trigger('childLoad');
	pgStack.push(pg);
	curPg = pg.obj;
	// insert css
	requireStyles(route.base, route.style, function(){
		// load tmpls, libs, and main
		requireTmplsFiles(route.base, route.tmpl);
		requireScripts(route.base, route.lib, true);
		requireScripts(route.base, route.main, false);
		fw.loadJs(function(){
			pg.obj.trigger('load');
			cb();
		}).loadJs();
	});
};
var loadPage = function(path){
	if(pageLoading) return false;
	pageLoading = true;
	// routing
	var obj = pathParser(routeTree, path);
	if(obj === 'page') {
		// special page
		location.pathname = path;
		pageLoading = false;
		return true;
	}
	if(!obj) {
		// 404
		var id = 404;
		var route = clientRoutes[404];
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
	if(j >= 0) pgStack[j].obj.trigger('childSwitch');
	var j = i;
	var next = function(){
		if(j >= stack.length) {
			pageLoading = false;
			return;
		}
		loadSubpage(stack[j++], next);
	};
	next();
	return true;
};

// history management
window.onpopstate = function(){
	if(location.pathname !== curPath)
		loadPage(location.pathname);
};
fw.go = function(path){
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
	var path = location.pathname;
	loadPage(path);
};
fw.loadJs('/$rc/routes.js').loadJs();
