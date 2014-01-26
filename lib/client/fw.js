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

// pg creator
var Pg = function(){
	var that = this;
	that.tmpl = function(name, args){
		return that.tmpl[name](args);
	};
};
var pgProto = Pg.prototype;

// init empty page
var curPg = null;
fw.getPage = function(){
	return curPg;
};

// script loader
var scriptsLoaded = {};
var requireScript = function(file, isLib){
	if(isLib && scriptsLoaded[file]) return;
	fw.loadJs(file).loadJs(function(){
		scriptsLoaded[file] = true;
	});
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
var requireTmpls = function(file){
	if(!tmplsFiles[file])
		fw.loadJs(function(){
			curTmplsFile = file;
		}).loadJs(file);
	fw.loadJs(function(){
		var tmpls = tmplsFiles[file];
		for(var k in tmpls)
			window.pg.tmpl[k] = tmpls[k];
	});
};

// style manager
var styleFiles = {};
var removeStyles = function(files){
	for(var i=0; i<files.length; i++)
		document.head.removeChild(styleFiles[files[i]]);
};
var requireStyle = function(file, cb){
	var tag = styleFiles[file];
	var insertTag = function(tag){
		document.head.appendChild(tag);
		setTimeout(cb, 0);
	};
	if(tag) {
		insertTag(tag);
		return;
	}
	tag = document.createElement('link');
	tag.onload = function(){
		insertTag(this);
	};
	tag.rel = "stylesheet";
	tag.type = 'text/css';
	tag.href = file;
	resLoaded[url] = false;
};
var requireStyles = function(files, cb){
	var i = 0;
	var next = function(){
		if(i >= files.length) cb();
		else {
			requireStyle(files[i++], next);
		}
	};
	next();
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

/*
// page loader
var loadingPathname = '';
var loadPage = function(pathname){
	var oriPathname = loadingPathname = pathname;
	// get resource list
	var pageRes = null;
	var pageArgs = {};
	if(fw.pages[pathname])
		pageRes = fw.pages[pathname];
	else {
		for(var i=0; i<fw.pagesRe.length; i++) {
			var match = pathname.match(fw.pagesRe[i].re);
			if(match) {
				pageRes = fw.pagesRe[i].page;
				var keys = fw.pagesRe[i].keys;
				for(var j=0; j<keys.length; j++)
					pageArgs[keys[j]] = match[j+1];
				pathname = fw.pagesRe[i].pattern;
				break;
			}
		}
	}
	if(!pageRes) {
		pageRes = fw.pages['404'];
		pathname = '404';
	}
	// reset bindings and show page
	var initPage = function(){
		if(loadingPathname !== oriPathname) return;
		if(fw.checkSocketOnline()) fw.resetSubConnection();
		fw.resizeFuncsStateRestore();
		fw.socketListenersStateRestore();
		fw.wrapper.innerHTML = '';
		window.pg = {};
		fw.currentPathname = loadingPathname;
		loadingPathname = '';
		for(var i=0; i<pageInitFuncs[pathname].length; i++)
			pageInitFuncs[pathname][i](pageArgs);
	};
	// load resource
	var listed = false;
	var waiting = 0;
	var waitingDown = function(){
		waiting--;
		if(listed && !waiting) initPage();
	};
	var loadPageRes = function(pageRes){
		if(pageRes.require)
			for(var i=0; i<pageRes.require.length; i++)
				loadPageRes(fw.pages[pageRes.require[i]]);
		if(pageRes.styles)
			for(var i=0; i<pageRes.styles.length; i++) {
				waiting++;
				loadStyle('/styles/'+pageRes.styles[i], waitingDown);
			}
		if(pageRes.templates)
			for(var i=0; i<pageRes.templates.length; i++) {
				waiting++;
				loadTemplate('/templates/'+pageRes.templates[i], waitingDown);
			}
		if(pageRes.scripts)
			for(var i=0; i<pageRes.scripts.length; i++) {
				waiting++;
				loadScript('/scripts/'+pageRes.scripts[i], waitingDown);
			}
	};
	loadPageRes(pageRes);
	if(!waiting) initPage();
	listed = true;
};

// history control
fw.go = function(pathname){
	var a = pathname.split('#', 2);
	pathname = a[0];
	if(a[1]) var state = '#'+a[1];
	else var state = '';
	if(history.pushState) {
		history.pushState({}, '', pathname+state);
		loadPage(pathname);
	} else {
		if(location.pathname !== pathname) {
			location.pathname = pathname+state;
		} else {
			location.pathname = pathname+state;
			location.reload();
		}
	}
};
fw.redirect = function(pathname, state){
	var a = pathname.split('#', 2);
	pathname = a[0];
	if(a[1]) var state = a[1];
	else var state = '';
	if(history.replaceState) {
		history.replaceState({}, '', pathname+state);
		loadPage(pathname);
	} else {
		if(location.pathname !== pathname) {
			location.pathname = pathname+state;
		} else {
			location.pathname = pathname+state;
			location.reload();
		}
	}
};
fw.back = function(){
	history.go(-1);
};
var stateLeaveFunc = null;
window.onpopstate = function(e){
	e.preventDefault();
	if(location.pathname !== fw.currentPathname)
		loadPage(location.pathname);
	else if(stateLeaveFunc)
		stateLeaveFunc();
	stateLeaveFunc = null;
};
window.onhashchange = function(e){
	e.preventDefault();
	if(stateLeaveFunc)
		stateLeaveFunc();
	stateLeaveFunc = null;
};
fw.goState = function(state, leaveFunc){
	stateLeaveFunc = leaveFunc;
	if(history.pushState) {
		history.pushState({}, '', (state ? '#'+state : location.pathname));
	} else {
		location.hash = '#'+state;
	}
};
fw.switchState = function(state, leaveFunc){
	stateLeaveFunc = leaveFunc;
	if(history.replaceState) {
		history.replaceState({}, '', (state ? '#'+state : location.pathname));
	} else {
		location.hash = '#'+state;
	}
};
fw.getState = function(state){
	var str = location.hash;
	if(str.slice(0, 1) === '#')
		return str.slice(1);
	return '';
};

// framework init
var fwInitFuncs = [];
fw.bindFrameworkInit = function(func){
	fwInitFuncs.push(func);
};
var fwInit = function(){
	var fwInited = function(){
		// start from request path
		fw.resizeFuncsStateSave();
		fw.socketListenersStateSave();
		var tryInitConnect = function(){
			loadScript('/socket.js?t='+new Date().getTime(), function(){
				clearInterval(tryInitConnectObj);
			});
		};
		var tryInitConnectObj = setInterval(tryInitConnect, 30000);
		tryInitConnect();
		loadPage(location.pathname);
	};
	var c = fwInitFuncs.length;
	if(c === 0) fwInited();
	for(var i=0; i<fwInitFuncs.length; i++)
		fwInitFuncs[i](function(){
			c--;
			if(c === 0) fwInited();
		});
};
*/

// page loader
var curPath = '';
var curPathArgs = {};
fw.getPath = function(){
	return curPath;
};
fw.getPathArgs = function(){
	return curPathArgs;
};
var pageLoading = false;
var pageStack = [];
var unloadSubpage = function(){
	// TODO
};
var loadSubpage = function(id, cb){
	// TODO
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
	var stack = [];
	for(var r=route; r.parent; r=clientRoutes[r.parent])
		stack.unshift(r);
	stack.unshift(r);
	for(var i=0; i<stack.length-1; i++)
		if(stack[i] !== pageStack[i]) break;
	// destroy and load subpages
	for(var j=pageStack.length-1; j>=i; j--)
		unloadSubpage();
	curPath = path;
	curPathArgs = args;
	var j = i;
	var next = function(){
		if(j >= pageStack.length) {
			pageLoading = false;
			return;
		}
		loadSubpage(stack[j++], next);
	};
	return true;
};

// load routes and start
var routesLoaded = function(){
	var path = location.pathname;
	loadPage(path);
};
fw.loadJs('/$routes.js').loadJs();
