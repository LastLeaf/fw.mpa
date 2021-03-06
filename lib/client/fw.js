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
		},
		show: function(){
			fw._logo.forceShown = true;
			fw._logo.style.display = 'block';
		},
		hide: function(){
			fw._logo.forceShown = false;
			fw._logo.style.display = 'none';
		}
	};
} else {
	fw.loadingLogo = {
		disabled: true,
		opacity: function(){}
	};
}

// remove fw scripts
var headNodes = fw._docHead.childNodes;
for(var i=0; i<headNodes.length; i++)
	if(headNodes[i].tagName === 'SCRIPT' && headNodes[i].getAttribute('fw') === '')
		fw._docHead.removeChild(headNodes[i--]);
var bodyNodes = document.body.childNodes;
for(var i=0; i<bodyNodes.length; i++)
	if(bodyNodes[i].tagName === 'SCRIPT' && bodyNodes[i].getAttribute('fw') === '')
		document.body.removeChild(bodyNodes[i--]);

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
	if(fw.mode === 'web') location.reload();
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
					if(conn.pgObj.destroyed || !conn.res[callId]) return;
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
			fw._docHead.removeChild(this);
			if(stat === 'initializing') {
				stat = 'uninitialized';
				retry(init);
			}
		};
		selectRpcServer();
		tag.src = rpcServer + '~conf/sock.js?t=' + new Date().getTime() + ( fw.debug ? '' : '&v=' + fw.version ) + '&a=' + encodeURIComponent(serverAuth);
		fw._docHead.appendChild(tag);
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

// user agent checking for loaders
var userAgentDenied = function(ua, uaNot){
	if(ua && !navigator.userAgent.match(new RegExp(ua))) return true;
	if(uaNot && navigator.userAgent.match(new RegExp(uaNot))) return true;
	return false;
};

// loader files parser
var parseLoaderFiles = function(files){
	if(!files) files = [];
	else if(files.constructor !== Array) files = [files];
	var pending = [];
	for(var i=0; i<files.length; i++) {
		var file = files[i];
		if(typeof(file) === 'object') {
			if(userAgentDenied(file.userAgent, file.userAgentNot)) continue;
			if(fw.debug) pending = pending.concat(file.src);
			else pending = pending.concat(file.src);
		} else {
			pending.push(file);
		}
	}
	return pending;
};

// script loader
var scriptsLoaded = {};
fw.main = function(func){
	fw.exports = function(pg, subm, cb){
		func(pg, subm);
		cb();
	};
};
fw.mainAsync = function(func){
	fw.exports = func;
};
var requireScript = function(file){
	if(typeof(scriptsLoaded[file]) !== 'undefined') return;
	scriptsLoaded[file] = {};
	var url = file;
	if(file.charAt(0) === '/') {
		url += ( fw.debug ? '?t=' + new Date().getTime() : '?v=' + cacheVersion(url) );
		url = fw.cacheClientPrefix + url;
	}
	fw
		._loadJs(function(){
			fw.exports = {};
		})
		._loadJs(url)
		._loadJs(function(){
			scriptsLoaded[file] = fw.exports;
		});
};
var requireScriptName = function(base, file){
	if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
		if(file.charAt(0) !== '/')
			file = '/' + base + file;
		file += '.js';
	}
	return file;
};
var requireScripts = function(base, files){
	var pending = parseLoaderFiles(files);
	var res = [];
	for(var i=0; i<pending.length; i++) {
		var file = pending[i];
		file = requireScriptName(base, file);
		requireScript(file);
		res.push(scriptsLoaded[file]);
	}
	return res;
};
var requireScriptsMain = function(base, files, pgObj, subm, cb){
	var pending = parseLoaderFiles(files);
	var loadingCount = pending.length;
	if(!loadingCount) cb();
	var loadedOne = function(){
		if(--loadingCount) return;
		cb();
	};
	for(var i=0; i<pending.length; i++) {
		var file = pending[i];
		file = requireScriptName(base, file);
		var func = scriptsLoaded[file];
		if(typeof(func) === 'function') {
			func(pgObj, subm, loadedOne);
		} else {
			loadedOne();
		}
	}
};
var scriptManager = function(base, initFiles, initFiles2, cb){
	var res = requireScripts(base, initFiles);
	requireScripts(base, initFiles2);
	fw._loadJs(function(){
		cb(res);
	})._loadJs();
	var add = function(files, cb){
		var res = requireScripts(base, files);
		fw._loadJs(function(){
			cb(res);
		})._loadJs();
	};
	return { add: add };
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
var requireTmplsFile = function(file, tmpl, i18nObj){
	var url = file;
	if(file.charAt(0) === '/') {
		url += ( fw.debug ? '?t=' + new Date().getTime() : '?v=' + cacheVersion(url) );
		url = fw.cacheClientPrefix + url;
	}
	if(!tmplsFiles[file])
		fw._loadJs(function(){
			curTmplsFile = file;
		})._loadJs(url);
	fw._loadJs(function(){
		var tmpls = tmplsFiles[file];
		if(!tmpls) return;
		for(var k in tmpls)
			if(k !== 'i18n')
				tmpl[k] = tmpls[k];
		for(var k in tmpls.i18n)
			i18nObj[k] = tmpls.i18n[k];
	});
};
var requireTmplsFiles = function(base, files){
	var tmpl = {};
	var i18nObj = {};
	tmpl.i18n = function(str){
		return i18nObj[str] || str;
	};
	var pending = parseLoaderFiles(files);
	for(var i=0; i<pending.length; i++) {
		var file = pending[i];
		file += '.tmpl';
		if(fw.language) file += '.' + fw.language;
		requireTmplsFile(requireScriptName(base, file), tmpl, i18nObj);
	}
	return tmpl;
};
var tmplManager = function(base, initFiles, cb){
	var res = requireTmplsFiles(base, initFiles);
	fw._loadJs(function(){
		cb(res);
	})._loadJs();
	var add = function(files, cb){
		var res = requireTmplsFiles(base, files);
		fw._loadJs(function(){
			cb(res);
		})._loadJs();
	};
	return { add: add };
};

// style manager
var removeInitStyles = function(){
	// TODO optimize this func
	var tags = document.getElementsByTagName('link');
	for(var i=0; i<tags.length; i++) {
		var tag = tags[i];
		if(typeof(tag.getAttribute('fw')) !== 'string') continue;
		fw._docHead.removeChild(tag);
		i--;
	}
};
var requireStyle = function(file, beforeTag, cb){
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
		file = fw.cacheClientPrefix + file + (fw.debug ? '?t=' + new Date().getTime() : '?v=' + cacheVersion(file));
	tag.href = file;
	fw._docHead.insertBefore(tag, beforeTag);
	// img hacks for browsers that does not trigger onload
	var imgTag = document.createElement('img');
	imgTag.onerror = imgTag.onload = function(){
		if(tag.onload) tag.onload.call(tag);
	};
	imgTag.src = file;
	return tag;
};
var requireStyles = function(base, files, beforeTag, cb){
	var tags = [];
	var pending = parseLoaderFiles(files);
	if(!pending) {
		setTimeout(cb, 0);
		return tags;
	}
	var c = pending.length + 1;
	var finished = function(){
		if(--c) return;
		setTimeout(cb, 0);
	};
	for(var i=0; i<pending.length; i++) {
		var file = pending[i];
		if(!file.match(/^([-_a-z0-9]+:|\/\/)/i)) {
			if(file.charAt(0) !== '/')
				file = '/' + base + file;
			file += '.css';
		}
		tags.push(requireStyle(file, beforeTag, finished));
	}
	finished();
	return tags;
};
var styleManager = function(base, initFiles, cb){
	var destroyed = false;
	var posElem = document.createComment('');
	fw._docHead.appendChild(posElem);
	var tags = requireStyles(base, initFiles, posElem, function(){
		if(!destroyed) cb();
	});
	var add = function(files, cb){
		tags = tags.concat(requireStyles(base, files, posElem, function(){
			if(!destroyed) cb();
		}));
	};
	var destroy = function(){
		if(destroyed) return;
		destroyed = true;
		for(var i=0; i<tags.length; i++) fw._docHead.removeChild(tags[i]);
		fw._docHead.removeChild(posElem);
	};
	return { add: add, destroy: destroy };
};

// resource loader
var submManager = function(pg, info, cb){
	var destroyed = false;
	var childSubmCtrls = [];
	var addChild = function(info, cb){
		childSubmCtrls.push(submManager(pg, info, function(submodule){
			if(destroyed) return;
			requireScriptsMain(info.base, info.main, pg.obj, submodule, cb);
		}));
	};
	var childSubmInfo = [];
	// load child submodules
	var i = 0;
	var children = [].concat(info.subm || []);
	var next = function(){
		if(!children[i]) return end();
		var detail = submDetail(children[i]) || submDetail(children[i] + '/index');
		if(!detail) throw(new Error('No submodule "' + children[i] + '" found.'));
		addChild(detail, function(submodule){
			if(destroyed) return;
			childSubmInfo.push(submodule);
			i++;
			next();
		});
	};
	// load self
	var style = null;
	var end = function(){
		style = styleManager(info.base, info.style, function(){
			if(destroyed) return;
			var tmpl = tmplManager(info.base, info.tmpl, function(tmpl){
				if(destroyed) return;
				var script = scriptManager(info.base, info.lib, info.main, function(lib){
					if(destroyed) return;
					cb({
						tmpl: tmpl,
						lib: lib,
						subm: childSubmInfo,
						require: function(){
							var len = arguments.length;
							var cb = arguments[len-1];
							if(typeof(cb) !== 'function') cb = function(){};
							else len--;
							var res = [];
							var pendingCount = len;
							var pendingEnd = function(r){
								res.push(r || null);
								if(--pendingCount) return;
								if(!destroyed) cb.apply(fw, res);
							};
							for(var i=0; i<len; i++) {
								var url = arguments[i];
								var splitDot = url.lastIndexOf('.');
								var ext = url.slice(splitDot + 1);
								url = url.slice(0, splitDot);
								if(ext === 'css') {
									style.add(url, pendingEnd);
								} else if(ext === 'tmpl') {
									tmpl.add(url, pendingEnd);
								} else if(ext === 'js') {
									script.add(url, pendingEnd);
								} else {
									addChild(url, pendingEnd);
								}
							}
						}
					});
				});
			});
		});
	};
	next();
	// return controller object
	return {
		destroy: function(){
			while(childSubmCtrls.length) childSubmCtrls.shift().destroy();
			if(style) style.destroy();
		}
	};
};

// route parser
var clientRouteDetail = null;
var pathParser = null;
var cacheVersion = null;
var submDetail = null;
fw._routes = function(propMap, tree, parser, cacheVers){
	clientRouteDetail = function(id){
		var obj = tree.client[id];
		if(!obj) return;
		var resObj = {};
		for(var k in obj) {
			if(propMap[k]) resObj[propMap[k]] = obj[k];
		}
		return resObj;
	}
	pathParser = function(path){
		return parser(propMap, tree, path);
	};
	cacheVersion = function(path){
		return cacheVers[path.slice(1)] || fw.version;
	};
	submDetail = function(id){
		var obj = tree.subm[id];
		if(!obj) return;
		var resObj = {};
		for(var k in obj) {
			if(propMap[k]) resObj[propMap[k]] = obj[k];
		}
		return resObj;
	};
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
	if(fw.debug) console.log('Loading aborted.');
	pageLoading = 0;
	if(stopLoadSubpage) stopLoadSubpage();
};

// page loader
var loadCount = 0;
var pageLoading = 0;
var pgStack = [];
var stopLoadSubpage = null;
var unloadSubpage = function(loadId){
	var pg = pgStack.pop();
	pg.obj.emit('beforeUnload');
	// destroy pg obj
	if(pg.route.reload === 'out' || pg.route.reload === 'both')
		location.reload();
	pg.destroyed = true;
	pg.obj.destroyed = true;
	pg.obj.readyState = 'unloaded';
	pg.submCtrl.destroy();
	if(fw.debug) console.log('Unloaded Sub-Page: ' + pg.routeId);
	if(pageLoading !== loadId) return;
	// find parent
	var pgParent = pgStack[pgStack.length-1];
	if(pgParent) curPgObj = pgParent.obj;
	else curPgObj = null;
	// call triggers
	sock.connEnd(pg);
	pg.obj.emit('unload');
	if(pgParent) pgParent.obj.emit('childUnload');
};
var loadSubpage = function(id, renderDepth, loadId, cb){
	if(fw.debug) console.log('Loading Sub-Page: '+id);
	var parent = pgStack[pgStack.length-1];
	var route = clientRouteDetail(id);
	var subm = route.subm;
	var pg = {
		destroyed: false,
		routeId: id,
		route: route,
		submCtrl: null,
		obj: new PgObj(parent)
	};
	pg.obj.readyState = 'loading';
	pg.obj.routeId = id;
	pg.obj.route = route;
	if(parent) parent.obj.emit('childLoadStart');
	curPgObj = pg.obj;
	// load
	var startLoading = function(){
		var startRender = function(){
			if(pageLoading !== loadId) return;
			// rendering
			if(renderDepth) {
				fw._loadJs(fw.mainServerPrefix + '~render' + curPath + '?t=' + new Date().getTime() + '&d=' + renderDepth + '&a=' + encodeURIComponent(serverAuth) + ( fw.mode === 'web' ? '' : '&l=' + fw.language ))._loadJs(function(){
					if(loadCount === 1 || !parent) {
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
			// main subpage
			pg.submCtrl = submManager(pg, route, function(res){
				if(pageLoading !== loadId) return;
				pgStack.push(pg);
				sock.connInit(pg);
				pg.obj.lib = res.lib;
				pg.obj.tmpl = res.tmpl;
				pg.obj.subm = res.subm;
				pg.obj.require = res.require;
				pg.obj.readyState = 'loaded';
				requireScriptsMain(route.base, route.main, pg.obj, null, function(){
					if(pageLoading !== loadId) return;
					pg.obj.emit('load');
					if(parent) parent.obj.emit('childLoadEnd');
					if(pageLoading === loadId)
						sock.connStart(pg);
					cb();
				});
			});
		};
		// wait for server auth when in app mode;
		if(renderDepth && !serverAuth) {
			fw._renderWaitAuth = function(){
				delete fw._renderWaitAuth;
				startRender();
			};
		} else {
			startRender();
		}
	};
	startLoading();
	// stop loading
	stopLoadSubpage = function(){
		if(pg.obj.readyState !== 'loading') return;
		pg.obj.readyState = 'stopped';
		if(submodules) {
			pg.submCtrl.destroy();
		} else {
			delete fw._renderWaitAuth;
		}
		fw._loadJs(false);
		if(parent) parent.obj.emit('childLoadStop');
		cb();
	};
};
var loadPage = function(path, reloadDepth, cb){
	if(pageLoading) return false;
	if(typeof(reloadDepth) === 'function') {
		cb = reloadDepth;
		reloadDepth = 0;
	}
	// routing
	var obj = pathParser(path);
	if(!obj) {
		// no route
		return false;
	} else if(obj.route.page) {
		// special page
		if(fw.mode === 'web') location.href = path;
		else location.href = fw.mainServerPrefix.slice(0, -1) + path;
		return true;
	} else {
		// common
		var id = obj.id;
		var route = obj.route;
		var args = obj.args;
	}
	// compare parents stack
	var stack = [id];
	for(var r=route; r.parent; r=clientRouteDetail(r.parent))
		stack.unshift(r.parent);
	if(stack.length > 16) {
		if(fw.debug) console.error('Page stack is too deep. Loading failed.');
		return false;
	}
	// confirm loading
	var loadId = pageLoading = ++loadCount;
	if(!fw.loadingLogo.disabled && !fw._logo.forceShown)
		fw._logo.style.display = 'block';
	path = obj.path;
	if(cb) cb(path);
	// build new stack
	for(var i=0; i<stack.length-reloadDepth; i++) {
		if(!pgStack[i]) break;
		if(stack[i] !== pgStack[i].routeId) break;
		// compare args
		var keys = pgStack[i].route.keys;
		if(!keys) continue;
		for(var t=0; t<keys.length; t++)
			if(args[keys[t]] !== curArgs[keys[t]]) break;
		if(t < keys.length) break;
	}
	var loadFrom = i;
	// destroy
	for(var j=pgStack.length-1; j>=loadFrom; j--) {
		unloadSubpage(loadId);
		if(pageLoading !== loadId) return;
	}
	curPath = path;
	curArgs = args;
	// check reload needed
	for(var i=loadFrom; i<stack.length; i++) {
		var r = clientRouteDetail(stack[i]);
		if(loadCount > 1 && (r.reload === 'in' || r.reload === 'both'))
			location.reload();
	}
	// server side rendering
	var renderDepth = 0;
	var renderFrom = 0;
	if(loadCount > 1 || fw.mode !== 'web') {
		for(var i=loadFrom; i<stack.length; i++)
			if(clientRouteDetail(stack[i]).render) break;
		renderDepth = stack.length - i;
		renderFrom = i;
	}
	// load subpages
	var j = loadFrom;
	var next = function(){
		if(pageLoading !== loadId) {
			return end();
		}
		if(j >= stack.length) {
			if(fw._logo && !fw._logo.forceShown) fw._logo.style.display = 'none';
			pageLoading = 0;
			return end();
		}
		if(j === renderFrom) {
			loadSubpage(stack[j++], renderDepth, loadId, next);
		} else {
			loadSubpage(stack[j++], 0, loadId, next);
		}
	};
	var end = function(){
		if(loadCount === 1 && fw.mode === 'web') removeInitStyles();
	};
	next();
	return true;
};
// handle page unload events
window.onbeforeunload = function(e){
	var arg = { message: '' };
	for(var j=pgStack.length-1; j>=0; j--) {
		pgStack[j].obj.emit('pageBeforeUnload', arg);
	}
	if(arg.message) {
		(e || window.event).returnValue = arg.message;
		return arg.message;
	}
};
window.onunload = function(){
	for(var j=pgStack.length-1; j>=0; j--) {
		pgStack[j].obj.emit('pageUnload');
	}
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
var normalizePath = function(path){
	// check site
	var m = path.match(/^(https?:|)\/\/([^\/]+)(.*)$/);
	if(m) {
		if((m[1] && m[1] !== location.protocol) || m[2] !== location.host)
			location.href = path;
		path = m[3];
	}
	// fill prefix
	if(path.charAt(0) !== '/')
		path = curPath.slice(0, location.pathname.lastIndexOf('/')+1) + path;
	return path;
};
fw.go = function(path){
	if(typeof(path) === 'number') {
		return history.go(path);
	} else {
		// load page
		path = normalizePath(path);
		if(path === curPath) return;
		fw.stopLoading();
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
	path = normalizePath(path);
	return loadPage(path, function(newPath){
		if(fw.mode === 'web' && history.replaceState) {
			history.replaceState({}, '', newPath);
		} else {
			prevHash = newPath;
			location.replace('#'+newPath);
			if(hashChangeIframe) {
				// There will be a new state for IE<8
				var doc = hashChangeIframe.contentWindow.document;
				doc.open();
				doc.write('<html><body>' + doc.createTextNode(newPath).nodeValue + '</body></html>');
				doc.close();
			}
		}
	});
};
fw.reload = function(depth){
	if(typeof(depth) === 'number') {
		loadPage(curPath, depth, function(){});
	} else {
		location.reload();
	}
};
fw.open = function(path){
	path = normalizePath(path);
	if(fw.mode === 'web' && history.replaceState) {
		window.open(path);
	} else {
		window.open(location.pathname+'#'+path);
	}
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
		if(window.event.which > 1) return;
		var tag = window.event.srcElement;
	}
	if(e.button || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
	while(tag && tag.tagName !== 'A') {
		tag = tag.parentNode;
	}
	if(!tag) return;
	var fwTarget = tag.getAttribute('fw');
	if(typeof(fwTarget) !== 'string') return;
	if(tag.tagName === 'A') {
		// go to page
		if(e && e.preventDefault) e.preventDefault();
		else window.event.returnValue = false;
		var href = tag.getAttribute('href');
		if(fwTarget === '_blank') {
			fw.open(href);
		} else if(fwTarget === '_redirect') {
			fw.redirect(href);
		} else {
			fw.go(href);
		}
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
		// read action
		var p = tag.getAttribute('action');
		var m = tag.getAttribute('method');
		if(m) p += ':' + m;
		// read elements
		var a = tag.elements;
		var args = {};
		if(submitCb && submitCb() === false)
			return;
		for(var i=0; i<a.length; i++) {
			// parse inputs
			var name = a[i].name;
			if(!name || ((a[i].type === 'radio' || a[i].type === 'checkbox') && a[i].checked === false)) continue;
			if(name.slice(-2) === '[]') {
				name = name.slice(0, -2);
				if(args[name]) args[name].push(a[i].value);
				else args[name] = [a[i].value];
			} else {
				args[name] = a[i].value;
			}
		}
		page.rpc(p, args, cb, timeoutCb);
	});
};

// load routes and start
var routesLoaded = function(){
	if(fw.mode === 'web' || fw.workingServer) sock.init();
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
