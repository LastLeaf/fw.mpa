// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict'; (function(){

// console polyfill
if(!window.console) {
	var t = function(){};
	window.console = {
		log: t,
		info: t,
		warn: t,
		error: t
	}
}

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
	if(window.crypto && crypto.getRandomValues) {
		var a = new Uint16Array(8);
		crypto.getRandomValues(a);
		return s4(a[0])+s4(a[1]) + '-' + s4(a[2]) + '-' + s4(a[3]) + '-' + s4(a[4]) + '-' + s4(a[5])+s4(a[6])+s4(a[7]);
	}
	return s4()+s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4()+s4()+s4();
};

// loading logo
if(fw._logo) {
	fw.loadingLogo = {
		disabled: false,
		opacity: function(n){
			fw._logo.style.opacity = n;
			fw._logo.style.filter = 'alpha(opacity='+(n*100)+')';
		}
	};
} else {
	fw.loadingLogo = {
		disabled: true,
		opacity: function(){}
	};
}

// remove fw scripts
var bodyNodes = document.body.childNodes;
for(var i=0; i<bodyNodes.length; i++)
	if(bodyNodes[i].tagName === 'SCRIPT' && bodyNodes[i].getAttribute('fw') === '')
		document.body.removeChild(bodyNodes[i]);

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

// reload page when server version changed, or session lost
fw.onserverchanged = function(){
	location.reload();
};
fw.onsessionlost = function(){
	location.reload();
};
fw._sessionlost = function(){
	localStorage['fw.sid'] = '';
	fw.onsessionlost();
};

// auth string management
if(fw.auth) {
	var serverAuth = fw.auth;
	delete fw.auth;
} else {
	var serverAuth = localStorage['fw.sid'] || '';
}

// select a main server in app mode
if(fw.mode === 'web') {
	fw.mainServerPrefix = '/';
} else {
	if(fw.workingServer) {
		fw.mainServerPrefix = fw.workingServer[ Math.floor(fw.workingServer.length * Math.random()) ];
		if(fw.mainServerPrefix.slice(-1) !== '/') fw.mainServerPrefix += '/';
	} else {
		fw.mainServerPrefix = '/';
	}
}

// select language
if(fw.mode === 'web') {
	fw.selectLanguage = function(str){
		location.replace('/~conf/lang?t=' + new Date().getTime() + '&a=' + encodeURIComponent(serverAuth) + ( typeof(str)==='undefined' ? '' : '&l=' + str) + '&r=' + encodeURIComponent(fw.getPath()));
	};
} else {
	// decide language for app
	var availableLang = fw.language.split(',');
	if(availableLang[0]) availableLang.unshift('');
	var selectedLang = null;
	if(typeof(localStorage['fw.lang']) !== 'undefined') {
		selectedLang = localStorage['fw.lang'];
		for(var i=0; i<availableLang.length; i++)
			if(selectedLang === availableLang[i])
				break;
		if(i >= availableLang.length) {
			delete localStorage['fw.lang'];
			selectedLang = null;
		}
	}
	if(selectedLang === null) {
		var localLang = (navigator.language || '');
		for(var i=0; i<availableLang.length; i++)
			if(availableLang[i].replace('_', '-') === localLang)
				selectedLang = availableLang[i];
		if(selectedLang === null) {
			var localLang = localLang.split(/[-_]/, 2)[0];
			for(var i=0; i<availableLang.length; i++)
				if(availableLang[i] === localLang)
					selectedLang = localLang;
		}
	}
	fw.language = selectedLang || '';
	fw.selectLanguage = function(str){
		if(typeof(str) === 'undefined') {
			delete localStorage['fw.lang'];
			location.reload();
			return;
		}
		for(var i=0; i<availableLang.length; i++)
			if(str === availableLang[i])
				break;
		if(i < availableLang.length) {
			localStorage['fw.lang'] = str;
			location.reload();
		}
	};
}

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
		socket.send(location.host+'/'+fw.language+'/'+auth);
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
		var oriStat = stat;
		stat = 'uninitialized';
		if(fw.debug && oriStat === 'connected') console.log('Socket disconnected.');
		retry(init);
		socket.onopen = socket.onclose = socket.onmessage = function(){};
		if(oriStat === 'connected')
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
			if(fw.debug) console.log('RES '+JSON.stringify(data));
			delete conn.err[method];
			var cb = conn.res[method];
			if(!cb) return;
			delete conn.res[method];
			cb.apply(conn.pgObj, data);
		} else if(method.charAt(0) === '!') {
			// respond err
			method = method.slice(1);
			var conn = conns[connId];
			if(!conn) return;
			if(fw.debug) console.log('ERR '+JSON.stringify(data));
			delete conn.res[method];
			var cb = conn.err[method];
			if(!cb) return;
			delete conn.err[method];
			cb.apply(conn.pgObj, data);
		} else {
			// events
			var conn = conns[connId];
			if(!conn) return;
			if(fw.debug) console.log('MSG '+method+' '+JSON.stringify(data));
			data.unshift(method);
			conn.emit.apply(conn, data);
		}
	};

	// sub conn manager
	var Conn = function(pg){
		this.used = false;
		this.pgObj = pg.obj;
		this.res = {};
		this.err = {};
		this.events = {};
	};
	Conn.prototype = EventHandler;
	var connInit = function(pg){
		do { var connId = uuid().slice(-17); } while(conns[connId]);
		pg.connId = connId;
		var conn = conns[connId] = new Conn(pg);
		var pgObj = pg.obj;
		pgObj.rpc = function(method){
			var sent = false;
			// parse args
			var cb = null;
			var timeoutCb = null;
			var data = [];
			for(var i=1; i<arguments.length; i++)
				if(typeof(arguments[i]) === 'function') {
					cb = arguments[i];
					timeoutCb = arguments[i+1];
					break;
				} else {
					data.push(arguments[i]);
				}
			if(method.charAt(0) !== '/') method = '/' + pg.route.base + method;
			do { var callId = uuid().slice(-17); } while(conn.res[callId]);
			// reg cb
			if(cb) {
				conn.res[callId] = cb;
				if(timeoutCb) conn.err[callId] = timeoutCb;
				setTimeout(function(){
					sent = true;
					if(conn.destroyed || !conn.res[callId]) return;
					delete conn.res[callId];
					if(timeoutCb) {
						delete conn.err[callId];
						timeoutCb.call(pgObj);
					}
				}, fw.timeout);
			}
			// send
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
			if(fw.debug) console.log('RPC '+method+' '+JSON.stringify(data));
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
		if(!pg.connId) return;
		var conn = conns[pg.connId];
		delete conns[pg.connId];
		if(conn.used && stat === 'connected')
			socket.send(JSON.stringify(['', 'end', pg.connId]));
		pg.obj.emit('socketDisconnect');
	};

	// get init data and init
	var rpcServer = '/';
	var selectRpcServer = function(){
		if(fw.workingServer) {
			rpcServer = fw.workingServer[ Math.floor(fw.workingServer.length * Math.random()) ];
			if(rpcServer.slice(-1) !== '/') rpcServer += '/';
		}
	};
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
		selectRpcServer();
		tag.src = rpcServer + '~conf/sock.js?t=' + new Date().getTime() + ( fw.debug ? '' : '&v=' + fw.version ) + '&a=' + encodeURIComponent(serverAuth);
		document.head.appendChild(tag);
	};
	fw._sockConfig = function(newAuth){
		if(stat !== 'initializing') return;
		stat = 'disconnected';
		url = rpcServer + '~sock';
		if(newAuth) {
			serverAuth = newAuth;
			if(fw.mode !== 'web') localStorage['fw.sid'] = newAuth;
			if(fw._renderWaitAuth) fw._renderWaitAuth();
		}
		auth = serverAuth;
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
var scriptMain = null;
var scriptsLoaded = {};
fw.main = function(func){
	scriptMain = func;
};
var requireScript = function(file){
	if(scriptsLoaded[file]) return;
	var url = file;
	if(file.charAt(0) === '/') {
		url += ( fw.debug ? '?t=' + new Date().getTime() : '?v=' + fw.version );
		url = fw.cacheClientPrefix + url;
	}
	fw
		._loadJs(function(){
			scriptMain = null;
		})
		._loadJs(url)
		._loadJs(function(){
			if(scriptMain) {
				scriptsLoaded[file] = scriptMain;
				scriptMain = null;
			} else {
				scriptsLoaded[file] = true;
			}
		});
};
var requireScriptName = function(base, file){
	if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
		if(file.slice(-3) !== '.js') file += '.js';
		if(file.charAt(0) !== '/')
			file = '/' + base + file;
	}
	return file;
};
var requireScripts = function(base, files){
	if(!files) files = [];
	else if(typeof(files) !== 'object') files = [files];
	for(var i=0; i<files.length; i++) {
		var file = requireScriptName(base, files[i]);
		requireScript(file);
	}
};
var requireScriptsMain = function(base, files){
	if(!files) files = [];
	else if(typeof(files) !== 'object') files = [files];
	for(var i=0; i<files.length; i++) {
		var file = requireScriptName(base, files[i]);
		var func = scriptsLoaded[file];
		if(typeof(func) === 'function')
			try {
				func(curPgObj);
			} catch(e) {
				setTimeout(function(){
					throw(e);
				}, 0);
			}
	}
};

// template manager
var tmplsFiles = {};
var curTmplsFile = '';
fw._tmpls = function(tmpls){
	if(!curTmplsFile) return;
	var cur = tmplsFiles[curTmplsFile] = {};
	for(var k in tmpls)
		if(typeof(tmpls[k]) === 'object')
			cur[k] = tmpls[k];
		else
			cur[k] = Handlebars.template(tmpls[k]);
	curTmplsFile = '';
};
var requireTmplsFile = function(file, pgObj, i18nObj){
	var url = file;
	if(file.charAt(0) === '/') {
		url += ( fw.debug ? '?t=' + new Date().getTime() : '?v=' + fw.version );
		url = fw.cacheClientPrefix + url;
	}
	if(!tmplsFiles[file])
		fw._loadJs(function(){
			curTmplsFile = file;
		})._loadJs(url);
	fw._loadJs(function(){
		var tmpls = tmplsFiles[file];
		if(!tmpls) return;
		if(typeof(tmpls.i18n) === 'object')
			for(var k in tmpls.i18n)
				i18nObj[k] = tmpls.i18n[k];
		for(var k in tmpls)
			if(typeof(tmpls[k]) === 'function')
				pgObj.tmpl[k] = tmpls[k];
	});
};
var requireTmplsFiles = function(base, files){
	if(!files) files = [];
	else if(typeof(files) !== 'object') files = [files];
	var i18nObj = {};
	curPgObj.tmpl.i18n = function(str){
		return i18nObj[str] || str;
	};
	for(var i=0; i<files.length; i++) {
		var file = files[i];
		if(file.slice(-5) !== '.tmpl') file += '.tmpl';
		if(fw.language) file += '.' + fw.language + '.js';
		else file += '.js';
		requireTmplsFile(requireScriptName(base, file), curPgObj, i18nObj);
	}
};

// style manager
var styleStack = [];
var removeInitStyles = function(){
	var tags = document.getElementsByTagName('link');
	for(var i=0; i<tags.length; i++) {
		var tag = tags[i];
		if(typeof(tag.getAttribute('fw')) !== 'string') continue;
		document.head.removeChild(tag);
	}
};
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
		imgTag.onerror = this.onerror = this.onabort = this.onload = this.onreadystatechange = null;
		cb(this);
	};
	tag.rel = "stylesheet";
	tag.type = 'text/css';
	if(file.charAt(0) === '/')
		file = fw.cacheClientPrefix + file + (fw.debug ? '?t=' + new Date().getTime() : '?v=' + fw.version);
	tag.href = file;
	document.head.appendChild(tag);
	// img hacks for browsers that does not trigger onload
	var imgTag = document.createElement('img');
	imgTag.onerror = imgTag.onload = function(){
		if(tag.onload) tag.onload.call(tag);
	};
	imgTag.src = file;
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
	var c = files.length + 1;
	var finished = function(){
		c--;
		if(c) return;
		cb();
	};
	for(var i=0; i<files.length; i++) {
		var file = files[i++];
		if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
			if(file.slice(-4) !== '.css') {
				if(file.slice(-7) !== '.stylus') file += '.stylus.css';
				else file += '.css';
			}
			if(file.charAt(0) !== '/')
				file = '/' + base + file;
		}
		requireStyle(file, function(tag){
			if(stopped) {
				document.head.removeChild(tag);
				return;
			}
			tags.push(tag);
			finished();
		});
	}
	finished();
	return stop;
};

// route parser
var routeTree = null;
var clientRoutes = null;
var pathParser = null;
fw._routes = function(tree, parser){
	routeTree = tree;
	clientRoutes = tree.client;
	pathParser = parser;
};

// pg creator
var PgObj = function(parent){
	if(parent) this.parent = parent.obj;
	this.tmpl = {};
	this.events = {};
	this.destroyed = false;
};
var pgProto = PgObj.prototype = EventHandler;
pgProto.form = function(tag, submitCb, cb, timeoutCb){
	shortcutForm(tag, this, submitCb, cb, timeoutCb);
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
fw.host = location.host;
fw.isLoading = function(){
	return pageLoading;
};
fw.stopLoading = function(){
	if(!pageLoading) return;
	pageLoading = 0;
	if(stopLoadSubpage) stopLoadSubpage();
};

// page loader
var loadCount = 0;
var pageLoading = 0;
var pgStack = [];
var stopLoadSubpage = null;
var unloadSubpage = function(){
	var pg = pgStack.pop();
	// destroy pg obj
	if(pg.route.reload === 'out' || pg.route.reload === 'both')
		location.reload();
	pg.destroyed = true;
	pg.obj.destroyed = true;
	pg.obj.readyState = 'unloaded';
	sock.connEnd(pg);
	pg.obj.emit('unload');
	removeStyles();
	// call parent
	pg = pgStack[pgStack.length-1];
	curPgObj = pg.obj;
	curPgObj.emit('childUnload');
};
var loadSubpage = function(id, renderDepth, loadId, cb){
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
	if(parent) parent.obj.emit('childLoadStart');
	pgStack.push(pg);
	curPgObj = pg.obj;
	// insert css
	var stopStyles = requireStyles(route.base, route.style, function(){
		stopStyles = null;
		var startRender = function(){
			// rendering
			if(renderDepth) {
				fw._loadJs(fw.mainServerPrefix + '~render' + curPath + '?t=' + new Date().getTime() + '&d=' + renderDepth + '&a=' + encodeURIComponent(serverAuth) + ( fw.mode === 'web' ? '' : '&l=' + fw.language ))._loadJs(function(){
					if(loadCount === 1) {
						// write result when render first page in app mode
						document.title = fw._renderRes.title;
						var div = document.createElement('div');
						div.innerHTML = fw._renderRes.content;
						while(div.childNodes.length) {
							var childNode = div.childNodes[0];
							div.removeChild(childNode);
							document.body.appendChild(childNode);
						}
					} else if(parent) {
						parent.obj.emit('render', fw._renderRes);
					}
					delete fw._renderRes;
				});
			}
			// load tmpls, libs, and main
			requireTmplsFiles(route.base, route.tmpl);
			requireScripts(route.base, route.lib);
			requireScripts(route.base, route.main);
			fw._loadJs(function(){
				if(pageLoading !== loadId) return;
				sock.connInit(pg);
				pg.obj.readyState = 'loaded';
				requireScriptsMain(route.base, route.main);
				pg.obj.emit('load');
				if(parent) parent.obj.emit('childLoadEnd');
				if(pageLoading === loadId)
					sock.connStart(pg);
				cb();
			})._loadJs();
		};
		// wait for server auth when in app mode;
		if(!serverAuth) {
			fw._renderWaitAuth = function(){
				delete fw._renderWaitAuth;
				startRender();
			};
		} else {
			startRender();
		}
	});
	// stop loading
	stopLoadSubpage = function(){
		if(pg.obj.readyState !== 'loading') return;
		pg.obj.readyState = 'stopped';
		if(stopStyles) {
			stopStyles();
		} else {
			delete fw._renderWaitAuth;
			fw._loadJs(false);
		}
		if(parent) parent.obj.emit('childLoadStop');
		cb();
	};
};
var loadPage = function(path, cb){
	if(pageLoading) return false;
	// routing
	if(path === '/~webapp') path = '/';
	var obj = pathParser(routeTree, path);
	if(obj === 'page') {
		// special page
		if(fw.mode === 'web') location.href = path;
		else location.href = fw.mainServerPrefix.slice(0, -1) + path;
		return true;
	}
	if(!obj) {
		// no route
		return false;
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
	if(stack.length > 16) {
		if(fw.debug) console.error('Page stack is too deep. Loading failed.');
		return false;
	}
	// confirm loading
	var loadId = pageLoading = ++loadCount;
	if(!fw.loadingLogo.disabled)
		fw._logo.style.display = 'block';
	path = obj.path;
	if(cb) cb(path);
	// build new stack
	for(var i=0; i<stack.length-1; i++) {
		if(!pgStack[i]) break;
		if(stack[i] !== pgStack[i].routeId) break;
		// compare args
		var keys = pgStack[i].route.keys;
		if(!keys) continue;
		for(var i=0; i<keys.length; i++)
			if(args[keys[i]] !== curArgs[keys[i]]) break;
		if(i < keys.length) break;
	}
	var loadFrom = i;
	// destroy
	for(var j=pgStack.length-1; j>=loadFrom; j--)
		unloadSubpage();
	curPath = path;
	curArgs = args;
	// check reload needed
	for(var i=loadFrom; i<stack.length; i++) {
		var r = clientRoutes[stack[i]];
		if(loadCount > 1 && (r.reload === 'in' || r.reload === 'both'))
			location.reload();
	}
	// server side rendering
	var renderDepth = 0;
	if(loadCount > 1 || fw.mode !== 'web') {
		for(var i=loadFrom; i<stack.length; i++)
			if(clientRoutes[stack[i]].render) break;
		renderDepth = stack.length - i;
	}
	// load subpages
	var j = loadFrom;
	var next = function(){
		if(pageLoading !== loadId) return end();
		if(j >= stack.length) {
			if(fw._logo) fw._logo.style.display = 'none';
			pageLoading = 0;
			return end();
		}
		loadSubpage(stack[j++], renderDepth, loadId, next);
		renderDepth = 0;
	};
	var end = function(){
		if(loadCount === 1 && fw.mode === 'web') removeInitStyles();
	};
	next();
	return true;
};

// history management
var hashChangeIframe = null;
if(fw.mode === 'web' && window.onpopstate === null) {
	window.onpopstate = function(){
		fw.stopLoading();
		if(location.pathname !== curPath)
			loadPage(location.pathname, function(newPath){
				history.replaceState({}, '', newPath);
			});
	};
} else {
	var prevHash = location.hash.slice(1) || (fw.mode === 'web' ? location.pathname : '/');
	var prevHashChanged = function(curHash){
		fw.stopLoading();
		prevHash = curHash;
		if(prevHash.charAt(0) === '/')
			loadPage(prevHash);
	};
	if(window.onhashchange === null) {
		window.onhashchange = function(){
			var curHash = location.hash.slice(1) || (fw.mode === 'web' ? location.pathname : '/');
			if(prevHash === curHash) return;
			prevHashChanged(curHash);
		};
	} else {
		// use an iframe in IE<8
		hashChangeIframe = document.createElement('iframe');
		hashChangeIframe.src = 'javascript:void(0)';
		hashChangeIframe.tabindex = '-1';
		hashChangeIframe.style.display = 'none';
		document.body.appendChild(hashChangeIframe);
		var doc = hashChangeIframe.contentWindow.document;
		doc.open();
		doc.write('<html><body>' + doc.createTextNode(prevHash).nodeValue + '</body></html>');
		doc.close();
		setInterval(function(){
			try {
				var curHash = hashChangeIframe.contentWindow.document.body.innerText;
				if(prevHash === curHash) return;
				location.href = '#' + curHash;
				prevHashChanged(curHash);
			} catch(e) {}
		}, 200);
	}
}
fw.go = function(path){
	fw.stopLoading();
	if(typeof(path) === 'number') {
		return history.go(path);
	} else {
		// check site
		var m = path.match(/^(https?:|)\/\/([^\/]+)(.*)$/);
		if(m) {
			if((m[1] && m[1] !== location.protocol) || m[2] !== location.host)
				location.href = path;
			path = m[3];
		}
		// fill prefix
		if(path.charAt(0) !== '/')
			path = location.pathname.slice(0, location.pathname.lastIndexOf('/')+1) + path;
		// load page
		return loadPage(path, function(newPath){
			if(fw.mode === 'web' && history.pushState) {
				history.pushState({}, '', newPath);
			} else {
				prevHash = newPath;
				location.href = '#'+newPath;
				if(hashChangeIframe) {
					var doc = hashChangeIframe.contentWindow.document;
					doc.open();
					doc.write('<html><body>' + doc.createTextNode(newPath).nodeValue + '</body></html>');
					doc.close();
				}
			}
		});
	}
};
fw.redirect = function(path){
	fw.stopLoading();
	return loadPage(path, function(path){
		if(fw.mode === 'web' && history.replaceState)
			history.replaceState({}, '', path);
	});
};

// shortcut helpers
var addListener = function(tag, e, func){
	if(tag.addEventListener) tag.addEventListener(e, func, false);
	else tag.attachEvent('on'+e, func);
};
addListener(document, 'click', function(e){
	if(e && e.preventDefault) {
		if(e.defaultPrevented) return;
		var tag = e.target;
	} else {
		if(window.event.returnValue === false) return;
		var tag = window.event.srcElement;
	}
	if(e.buttons > 1) return;
	while(tag && tag.tagName !== 'A') {
		tag = tag.parentNode;
	}
	if(!tag) return;
	if(typeof(tag.getAttribute('fw')) !== 'string') return;
	if(tag.tagName === 'A') {
		// go to page using fw.go
		if(e && e.preventDefault) e.preventDefault();
		else window.event.returnValue = false;
		fw.go(tag.getAttribute('href'));
	}
});
var shortcutForm = function(tag, page, submitCb, cb, timeoutCb){
	addListener(tag, 'submit', function(e){
		if(e && e.preventDefault) {
			if(e.defaultPrevented) return;
			e.preventDefault();
		} else {
			if(window.event.returnValue === false) return;
			window.event.returnValue = false;
		}
		var p = tag.getAttribute('action');
		var m = tag.getAttribute('method');
		if(m) p += ':' + m;
		var a = tag.elements;
		var args = {};
		if(submitCb && submitCb() === false)
			return;
		for(var i=0; i<a.length; i++)
			if(a[i].name) args[a[i].name] = a[i].value;
		page.rpc(p, args, cb, timeoutCb);
	});
};

// load routes and start
var routesLoaded = function(){
	sock.init();
	if(location.hash.charAt(1) === '/') {
		if(fw.mode === 'web')
			location.replace(location.hash.slice(1));
		else
			var path = location.hash.slice(1);
	} else if(fw.mode === 'web') {
		var path = location.pathname;
	} else {
		var path = '/';
	}
	loadPage(path, function(newPath){
		if(path !== newPath && fw.mode === 'web' && history.replaceState)
			history.replaceState({}, '', newPath);
	});
};
fw
	._loadJs(fw.cacheFwPrefix + '/routes.js' + ( fw.debug ? '?t=' + new Date().getTime() : '?v=' + fw.version ))
	._loadJs(routesLoaded)
	._loadJs();

})();