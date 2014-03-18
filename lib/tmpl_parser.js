// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var handlebars = require('handlebars');

var I18n = function(app, file){
	var locale = app.config.app.locale;
	var prefix = file.slice(0, file.lastIndexOf('.')) + '.locale/';
	var trans = [];
	for(var i=0; i<locale.length; i++)
		try {
			trans[i] = JSON.parse(fs.readFileSync(prefix+locale[i]).toString('utf8'));
		} catch(e) {
			if(fs.existsSync(prefix+locale[i]))
				console.trace(e);
			trans[i] = null;
		}
	return function(str){
		var def = str.replace(/`[^`]+?`/g, function(match){
			if(match === '``') return '`';
			return match.slice(1, -1);
		});
		var res = {'': def};
		for(var i=0; i<locale.length; i++) {
			var lang = locale[i];
			var tran = trans[i];
			if(!tran) {
				res[lang] = def;
				continue;
			}
			res[lang] = str.replace(/`[^`]+?`/g, function(match){
				if(match === '``') return '`';
				match = match.slice(1, -1);
				if(typeof(tran[match]) !== 'undefined')
					return tran[match];
				return match;
			});
		}
		return res;
	};
};

exports.preparser = function(app, str, file){
	var res = {};
	var i18n = I18n(app, file);
	var tmpls = str.match(/<tmpl\s+id\=\"\w+\"\s*>[\s\S]*?<\/tmpl>/gi);
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<tmpl\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/tmpl>$/i);
		var translated = i18n(tmpl[2]);
		for(var k in translated) {
			if(res[k]) res[k] += ',';
			else res[k] = '';
			res[k] += tmpl[1] + ':' + handlebars.precompile(translated[k]);
		}
	}
	return res;
};

exports.parser = function(app, str, file){
	var res = {};
	var i18n = I18n(app, file);
	var tmpls = str.match(/<tmpl\s+id\=\"\w+\"\s*>[\s\S]*?<\/tmpl>/gi);
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<tmpl\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/tmpl>$/i);
		var translated = i18n(tmpl[2]);
		for(var k in translated) {
			if(!res[k]) res[k] = {};
			res[k][tmpl[1]] = handlebars.compile(translated[k]);
		}
	}
	var resFunc = {};
	for(var k in res['']) (function(k){
		resFunc[k] = function(conn, args){
			return res[conn.language][k](args);
		};
	})(k);
	return resFunc;
};
