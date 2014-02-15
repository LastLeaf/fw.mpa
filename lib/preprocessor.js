// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var htmlparser = require('htmlparser2');
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
	// shortcuts
	var shortcut = function(tag, id){
		var defId = {
			a: 'go',
			form: 'form'
		};
		var cases = {
			go: 'onclick="fw._s.go(this,event)"',
			form: 'onsubmit="fw._s.form(this,event)"'
		};
		return cases[ id || defId[tag] ];
	};
	// parse tmpls
	var parser = function(str){
		var tmpls = '';
		var curId = '';
		var curStr = '';
		var htmlp = new htmlparser.Parser({
			onopentag: function(name, attr){
				if(name === 'template' || name === 'tmpl') {
					curStr = '';
					curId = attr.id;
				} else {
					curStr += '<' + name;
					for(var k in attr) {
						if(k === 'fw')
							curStr += ' ' + shortcut(name, attr[k]);
						else
							curStr += ' ' + k + '=' + '"' + attr[k] + '"';
					}
					curStr += '>';
				}
			},
			ontext: function(text){
				curStr += text;
			},
			onclosetag: function(name){
				if(name === 'template' || name === 'tmpl') {
					if(curId) {
						tmpls += '"' + curId + '":' + handlebars.precompile(curStr);
					}
					curStr = '';
					curId = '';
				} else {
					curStr += '</' + name + '>';
				}
			}
		});
		htmlp.write(str);
		htmlp.end();
		return tmpls;
	};
	// minify
	cb(null, uglifyjs.minify('fw._tmpls({'+parser(str)+'})', {fromString: true}).code);
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
