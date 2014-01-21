// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var handlebars = require('handlebars');
var stylus = require('stylus');
var uglifycss = require('uglifycss');
var uglifyjs = require('uglify-js');

module.exports = function(app, files, cache, cb){
	if(typeof(files) !== 'object')
		files = [files];
	var res = '';
	var next = function(){
		if(!files.length) {
			if(cache && res) fs.writeFileSync(cache, res);
			if(cb) cb(res);
			return;
		}
		var file = files.shift();
		var ext = path.extname(file).slice(1);
		try {
			var str = fs.readFileSync(file, {encoding: 'utf8'});
			handlers[ext](app, str, file, function(err, r){
				if(!err) res += r;
				else console.error(err);
				next();
			});
		} catch(e) {
			console.error(e);
			next();
		}
	};
	next();
};

var handlers = {};

// template
handlers.tmpl = function(app, str, file, cb){
	// parse tmpls
	var tmpl = '';
	str = str.replace(/<!--[\s\S]*?-->/g, '');
	var matches = str.match(/<template[^>]*?>[\s\S]*?<\/template>/gi);
	if(!matches) return;
	for(var i=0; i<matches.length; i++) {
		var a = matches[i].match(/^<template([^>]+?)>([\s\S]*?)<\/template>$/i);
		if(!a) continue;
		var id = a[1].match(/id="([a-z0-9_\-]+?)"/i);
		if(!id) continue;
		if(tmpl) tmpl += ',';
		tmpl += '"'+id[1]+'":'+handlebars.precompile(a[2]);
	}
	// minify
	cb(null, uglifyjs.minify('fw.newTmpls({'+tmpl+'})', {fromString: true}).code);
};

// stylus
handlers.stylus = function(app, str, file, cb){
	stylus.render(str, {filename: file}, function(err, res){
		if(err) cb(err);
		else handlers.css(app, res, file, cb);
	});
};

// css
handlers.css = function(app, str, file, cb){
	if(!app.debug) cb(null, uglifycss.processString(str));
	else cb(null, str);
};

// js
handlers.js = function(app, str, file, cb){
	if(!app.debug) cb(null, uglifyjs.minify(str, {fromString: true}).code);
	else cb(null, str);
};
