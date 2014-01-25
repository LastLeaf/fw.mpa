// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// init page
$LAB.script('/$routes.js');

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
fw.setCurPg = function(pg){
	window.pg = pg;
};
fw.setCurPg(new Pg());

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
		$LAB.queueWait(function(){
			curTmplsFile = file;
		}).queueScript(file);
	$LAB.queueWait(function(){
		var tmpls = tmplsFiles[file];
		for(var k in tmpls)
			window.pg.tmpl[k] = tmpls[k];
	});
};

// TODO

// page define
fw.pagesRe = [];
for(var k in fw.pages) {
	if(!k.match(/:/)) continue;
	if(!k.match(/^[\/:a-z0-9_]+$/i)) continue;
	var keys = k.match(/:[a-z0-9_]+/gi);
	for(var i=0; i<keys.length; i++)
		keys[i] = keys[i].slice(1);
	var reStr = '^' + k.replace(/:[a-z0-9_]+/gi, '([^/]+)') + '$';
	fw.pagesRe.push({
		pattern: k,
		re: new RegExp(reStr, ''),
		keys: keys,
		page: fw.pages[k]
	});
	delete fw.pages[k];
}

// resource loaders
var resLoaded = {};
var loadScript = function(url, func){
	if(resLoaded[url]) {
		func();
		return;
	}
	$LAB.script(url).wait(function(){
		resLoaded[url] = true;
		func();
	});
	resLoaded[url] = false;
};
var loadStyle = function(url, func){
	if(resLoaded[url]) {
		func();
		return;
	}
	var tag = document.createElement('link');
	tag.onload = function(){
		resLoaded[url] = true;
		func();
	};
	tag.rel = "stylesheet";
	tag.type = 'text/css';
	tag.href = url;
	document.head.appendChild(tag);
	resLoaded[url] = false;
};
var loadTemplate = function(url, func){
	if(resLoaded[url]) {
		func();
		return;
	}
	var tag = document.createElement('script');
	tag.onload = function(){
		resLoaded[url] = true;
		func();
	};
	tag.type = 'text/javascript';
	tag.src = url;
	document.body.appendChild(tag);
	resLoaded[url] = false;
};

// page init events
var pageInitFuncs = {};
fw.bindPageInit = function(pathname, func){
	if(!pageInitFuncs[pathname])
		pageInitFuncs[pathname] = [];
	pageInitFuncs[pathname].push(func);
};

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

// load preload resource
var preloadFiles = function(){
	if(fw.preload.styles && fw.preload.styles.length) {
		loadStyle('/styles/'+fw.preload.styles.shift(), preloadFiles);
	} else if(fw.preload.templates && fw.preload.templates.length) {
		loadTemplate('/templates/'+fw.preload.templates.shift(), preloadFiles);
	} else if(fw.preload.scripts && fw.preload.scripts.length) {
		loadScript('/scripts/'+fw.preload.scripts.shift(), preloadFiles);
	} else {
		fwInit();
	}
};
preloadFiles();