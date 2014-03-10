// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var stylus = require('stylus');
var uglifycss = require('uglifycss');
var uglifyjs = require('uglify-js');
var tmplParser = require('./tmpl_parser.js').preparser;

module.exports = function(app, file, cb){
	var res = null;
	var ext = path.extname(file).slice(1);
	try {
		var str = fs.readFileSync(file, {encoding: 'utf8'});
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
	var obj = tmplParser(app, str, file);
	var res = {};
	for(var k in obj)
		res[( k ? '.'+k+'.js' : '.js' )] = uglifyjs.minify('fw._tmpls({'+obj[k]+'})', {fromString: true}).code;
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
	if(!app.debug) var res = uglifycss.processString(str);
	else var res = str;
	if(path.extname(file) === '.css') cb(null, {'': res});
	else cb(null, {'.css': res});
};

// js
handlers.js = function(app, str, file, cb){
	if(!app.debug) var res = uglifyjs.minify(str, {fromString: true}).code;
	else var res = str;
	cb(null, {'': res})
};
