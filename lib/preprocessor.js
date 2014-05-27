// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var stylus = require('stylus');
var uglifycss = require('uglifycss');
var uglifyjs = require('uglify-js');
var tmplPreparser = require('./tmpl_parser.js').preparser;

module.exports = function(app, file, cb){
	var res = null;
	var ext = path.extname(file).slice(1);
	try {
		var str = fs.readFileSync(file).toString('utf8');
		handlers[ext](app, str, file, function(err, r){
			if(!err) res = r;
			else console.error(err);
			if(cb) cb(res);
		});
	} catch(e) {
		console.trace(e);
		if(cb) cb(res);
	}
};

var handlers = {};

// template
handlers.tmpl = function(app, str, file, cb){
	var obj = tmplPreparser(app, str, file);
	var copyright = '';
	if(!app.debug) {
		var m = str.match(/^\s*\<!--([\s\S]+?)--\>/);
		if(m) copyright = '/*' + m[1] + '*/\n';
	}
	var res = {};
	for(var k in obj)
		res[( k ? '.'+k+'.js' : '.js' )] = copyright + uglifyjs.minify('fw._tmpls({'+obj[k]+'})', {fromString: true}).code;
	cb(null, res);
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
	if(!app.debug) {
		var copyright = '';
		var m = str.match(/^\s*(\/\*[\s\S]+?\*\/)/);
		if(m) copyright = m[1] + '\n';
		var res = copyright + uglifycss.processString(str);
	} else {
		var res = str;
	}
	if(path.extname(file) === '.css') cb(null, {'': res});
	else cb(null, {'.css': res});
};

// js
handlers.js = function(app, str, file, cb){
	if(!app.debug) {
		var copyright = '';
		var m = str.match(/^\s*(\/\*[\s\S]+?\*\/)/);
		if(m) copyright = m[1] + '\n';
		m = str.match(/^\s*(\/\/.+?)[\r\n]/);
		if(m) copyright = m[1] + '\n';
		var res = copyright + uglifyjs.minify(str, {fromString: true}).code;
	} else {
		var res = str;
	}
	cb(null, {'': res});
};
