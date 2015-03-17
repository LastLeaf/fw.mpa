// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var stylus = require('stylus');
var CleanCSS = require('clean-css');
var uglifyjs = require('uglify-js');
var tmplPreparser = require('./tmpl_parser.js').preparser;

module.exports = function(app, file, cb){
	var res = {};
	var ext = path.extname(file).slice(1);
	var extraArg = null;
	// locale file
	var locale = file.match(/\.locale[\/\\](.+)$/);
	if(locale) {
		ext = 'tmpl';
		extraArg = locale[1];
		file = file.replace(/\.locale[\/\\].+$/, '.tmpl');
	}
	// read and call handlers
	fs.readFile(file, function(err, buf){
		try {
			if(err) throw err;
			handlers[ext](app, buf.toString('utf8'), file, function(err, r){
				if(!err) res = r;
				else console.error(err.stack || 'Error: ' + err.message);
				if(cb) cb(res);
			}, extraArg);
		} catch(err) {
			console.error('Error processing file: '+file);
			console.error(err.stack || 'Error: ' + err.message);
			if(cb) cb(res);
		}
	});
};

var handlers = {};

// template
handlers.tmpl = function(app, str, file, cb, locale){
	tmplPreparser(app, str, file, [locale || ''], function(obj){
		var copyright = '';
		if(!fw.debug) {
			var m = str.match(/^\s*\<!--([\s\S]+?)--\>/);
			if(m) copyright = '/*' + m[1] + '*/\n';
		}
		var res = {};
		for(var k in obj)
			res[( k ? '.'+k+'.js' : '.js' )] = copyright + uglifyjs.minify('fw._tmpls({'+obj[k]+'})', {fromString: true}).code;
		cb(null, res);
	});
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
	if(!fw.debug) {
		var copyright = '';
		var m = str.match(/^\s*(\/\*[\s\S]+?\*\/)/);
		if(m) copyright = m[1] + '\n';
		var res = copyright + new CleanCSS().minify(str);
	} else {
		var res = str;
	}
	if(path.extname(file) === '.css') cb(null, {'': res});
	else cb(null, {'.css': res});
};

// js
handlers.js = function(app, str, file, cb){
	if(!fw.debug) {
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
