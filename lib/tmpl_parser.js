// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var mkdirp = require('mkdirp');
var handlebars = require('handlebars');

var tmplMinify = require('./tmpl_minify.js');

var I18n = function(app, file, locale, cb){
	var prefix = file.slice(0, file.lastIndexOf('.')) + '.locale/';
	var trans = [];
	var dynTrans = {};
	var i18n = function(str){
		var def = str.replace(/`[^`]*`/g, function(match){
			if(match === '``') return '`';
			return match.slice(1, -1);
		});
		var res = {};
		for(var i=0; i<locale.length; i++) {
			var lang = locale[i];
			var tran = trans[i];
			if(!tran) {
				res[lang] = def;
				continue;
			}
			res[lang] = str.replace(/`[^`]*`/g, function(match){
				if(match === '``') return '`';
				match = match.slice(1, -1);
				if(typeof(tran[match]) !== 'undefined')
					return tran[match];
				return match;
			});
		}
		return res;
	};
	var res = {
		i18n: i18n,
		dynamic: dynTrans
	};
	var localeCount = locale.length;
	if(!localeCount) cb(res);
	for(var i=0; i<locale.length; i++)(function(i){
		var loc = locale[i];
		if(loc === '') {
			if(!--localeCount) cb(res);
			return;
		}
		fs.readFile(prefix+loc, function(err, buf){
			if(!err) {
				try {
					trans[i] = JSON.parse(buf.toString('utf8'));
					if(trans[i].constructor === Array) {
						dynTrans[loc] = trans[i][1] || {};
						trans[i] = trans[i][0];
					}
				} catch(err) {
					fs.exists(prefix+loc, function(exists){
						if(!exists) return;
						console.error('Failed Parsing Locale File: ' + prefix + loc);
						console.error(err.stack || 'Error: ' + err.message);
					});
					trans[i] = null;
				}
			}
			if(!--localeCount) cb(res);
		});
	})(i);
};

exports.preparser = function(app, str, file, locale, cb){
	I18n(app, file, locale, function(obj){
		var res = {};
		var i18n = obj.i18n;
		var dynamic = obj.dynamic;
		for(var k in dynamic)
			res[k] = 'i18n:' + JSON.stringify(dynamic[k]);
		var tmpls = str.match(/<(tmpl|json)\s+id\=\"\w+\"\s*(minify|)\s*>[\s\S]*?<\/(tmpl|json)>/gi);
		for(var i=0; i<locale.length; i++) {
			if(!res[locale[i]]) res[locale[i]] = '';
		}
		while(tmpls && tmpls.length) {
			var tmpl = tmpls.shift().match(/^<(tmpl|json)\s+id\=\"(\w+)\"\s*(minify|)\s*>([\s\S]*?)<\/(tmpl|json)>$/i);
			var needMinify = tmpl[3];
			var tmplStr = tmpl[4];
			if(tmpl[1] === 'tmpl' && needMinify) tmplStr = tmplMinify(tmplStr);
			var translated = i18n(tmplStr);
			for(var k in translated) {
				if(res[k]) res[k] += ',';
				if(tmpl[1] === 'json')
					res[k] += tmpl[2] + ':' + JSON.stringify(JSON.parse(translated[k]));
				else
					res[k] += tmpl[2] + ':' + handlebars.precompile(translated[k]);
			}
		}
		cb(res);
	});
};

exports.parser = function(app, str, file, locale, cb){
	I18n(app, file, locale, function(obj){
		var res = {};
		var i18n = obj.i18n;
		var dynamic = obj.dynamic;
		for(var k in dynamic)
			(function(k){
				res[k] = { i18n: function(str){
					return dynamic[k][str] || str;
				} };
			})(k);
		var tmpls = str.match(/<(tmpl|json)\s+id\=\"\w+\"\s*(minify|)\s*>[\s\S]*?<\/(tmpl|json)>/gi);
		while(tmpls && tmpls.length) {
			var tmpl = tmpls.shift().match(/^<(tmpl|json)\s+id\=\"(\w+)\"\s*(minify|)\s*>([\s\S]*?)<\/(tmpl|json)>$/i);
			var needMinify = tmpl[3];
			var tmplStr = tmpl[4];
			if(tmpl[1] === 'tmpl' && needMinify) tmplStr = tmplMinify(tmplStr);
			var translated = i18n(tmplStr);
			for(var k in translated) {
				if(!res[k]) res[k] = {
					i18n: function(s) {return s;}
				};
				if(tmpl[1] === 'json')
					res[k][tmpl[2]] = JSON.parse(translated[k]);
				else
					res[k][tmpl[2]] = handlebars.compile(translated[k]);
			}
		}
		cb(res);
	});
};

exports.generateLocaleFiles = function(str, file, locale, cb){
	if(typeof(locale) !== 'object') {
		locale = [locale];
	}
	if(!locale.length) {
		cb(0);
		return;
	}
	// parse string
	var tmpls = str.match(/<(tmpl|json)\s+id\=\"\w+\"\s*(minify|)\s*>[\s\S]*?<\/(tmpl|json)>/gi);
	var oriStrings = [];
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<(tmpl|json)\s+id\=\"(\w+)\"\s*(minify|)\s*>([\s\S]*?)<\/(tmpl|json)>$/i);
		var matches = tmpl[4].match(/`[^`]*`/g);
		if(!matches) matches = [];
		for(var i=0; i<matches.length; i++)
			oriStrings.push(matches[i].slice(1, -1));
	}
	// write locale files
	var prefix = file.slice(0, file.lastIndexOf('.')) + '.locale/';
	var processTrans = function(err){
		if(err) {
			console.error(err.stack || 'Error: ' + err.message);
			cb(0);
			return;
		}
		for(var i=0; i<locale.length; i++) {
			file = prefix + locale[i];
			fs.readFile(file, function(err, json){
				// read original translation
				try {
					if(!err) {
						var trans = JSON.parse(json);
						if(trans.constructor !== Array) trans = [trans];
						if(trans.length < 3) trans.push({});
						if(trans.length < 3) trans.push({});
					} else {
						var trans = [{}, {}, {}];
					}
					var oldTrans = {};
					for(var k in trans[0])
						if(trans[0][k] !== '')
							oldTrans[k] = trans[0][k];
					for(var k in trans[2])
						if(typeof(oldTrans[k]) === 'undefined' && trans[2][k] !== '')
							oldTrans[k] = trans[2][k];
					var newTrans = {};
				} catch(e) {
					console.log(e.stack);
					cb(0);
					return;
				}
				// contruct translation object
				var needTrans = 0;
				for(var i=0; i<oriStrings.length; i++) {
					var match = oriStrings[i];
					if(typeof(newTrans[match]) !== 'undefined') continue;
					if(typeof(oldTrans[match]) !== 'undefined') {
						newTrans[match] = oldTrans[match];
						delete oldTrans[match];
						if(newTrans[match] === '') needTrans++;
					} else {
						newTrans[match] = '';
						needTrans++;
					}
				}
				trans[0] = newTrans;
				trans[2] = oldTrans;
				// write back
				fs.writeFile(file, JSON.stringify(trans, null, '\t'), function(err){
					if(err) {
						console.error(err.stack || 'Error: ' + err.message);
						cb(0);
						return;
					}
					var oldLen = 0;
					for(var k in oldTrans) oldLen++;
					if(oldLen)
						console.log(needTrans+' in '+file+' ('+oldLen+' unused)');
					else if(needTrans)
						console.log(needTrans+' in '+file);
					if(cb) cb(needTrans, oldLen);
				});
			});
		}
	};
	// check .locale dir
	fs.exists(prefix, function(exists){
		if(exists) return processTrans();
		if(!oriStrings.length) {
			cb(0);
			return;
		}
		mkdirp(prefix, processTrans);
	});
};
