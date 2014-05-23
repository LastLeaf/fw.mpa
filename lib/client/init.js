// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict'; (function(){

// document.ready partly from jQuery, jquery.org/license
var bindReady=function(){var funcs=[];var executeReady=function(){if(funcs===null)return;for(var i=0;i<funcs.length;i++)funcs[i].call(window);funcs=null};if(document.addEventListener){document.addEventListener("DOMContentLoaded",function f(){document.removeEventListener("DOMContentLoaded",f,false);executeReady()},false)}else if(document.attachEvent){document.attachEvent("onreadystatechange",function f(){if(document.readyState==="complete"){document.detachEvent("onreadystatechange",f);executeReady()}});if(document.documentElement.doScroll&&window==window.top)(function f(){if(funcs===null)return;try{document.documentElement.doScroll("left")}catch(error){setTimeout(f,0);return}executeReady()})()}else{window.onload=executeReady}return function(func){if(funcs!==null)funcs.push(func);else func.call(window)}}();

// script loader
var loadJs = (function(){
	var q = [];
	var running = false;
	var run = function(){
		if(!q.length) return;
		running = true;
		var job = q.shift();
		if(typeof(job) === 'function') {
			if(q.length) {
				job();
				run();
			} else {
				running = false;
				job();
			}
		} else {
			if(q.length) var cont = true;
			else var cont = running = false;
			var tag = document.createElement('script');
			tag.onerror = tag.onabort = tag.onload = tag.onreadystatechange = function(){
				if(this.readyState && this.readyState !== 'loaded' && this.readyState !== 'complete')
					return;
				this.onerror = this.onabort = this.onload = this.onreadystatechange = null;
				document.head.removeChild(this);
				if(cont) run();
			};
			tag.src = job;
			document.head.appendChild(tag);
		}
	};
	return function(obj){
		if(typeof(obj) === 'undefined') {
			if(!running) {
				running = true;
				setTimeout(run, 0);
			}
		} else if(obj === false) {
			q = [];
		} else {
			q.push(obj);
		}
		return this;
	};
})();

// ready function
bindReady(function(){
	if(!document.head) document.head = document.getElementsByTagName('head')[0];
	// select cache server
	if(fw.cacheServer) {
		var p = fw.cacheServer[ Math.floor(fw.cacheServer.length * Math.random()) ];
		if(p.slice(-1) !== '/') p += '/';
		fw.cacheClientPrefix = p + 'client';
		fw.cacheFwPrefix = p + 'fw';
	} else if(fw.mode === 'web') {
		fw.cacheClientPrefix = '/~';
		fw.cacheFwPrefix = '/~fw';
	} else {
		fw.cacheClientPrefix = 'client';
		fw.cacheFwPrefix = 'fw';
	}
	// start loading
	fw._loadJs = loadJs;
	fw
		._loadJs(fw.cacheFwPrefix + '/libs.js' + ( fw.debug ? '?t=' + new Date().getTime() : '?v=' + fw.version ))
		._loadJs(fw.cacheFwPrefix + '/fw.js' + ( fw.debug ? '?t=' + new Date().getTime() : '?v=' + fw.version ))
		._loadJs();
});

})();