// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var handlebars = require('handlebars');

var I18n = function(app, file){
	var locale = app.config.app.locale;
	var prefix = file.slice(0, file.lastIndexOf('.')) + '.locale/';
	var trans = [];
	var dynTrans = {};
	for(var i=0; i<locale.length; i++)
		try {
			trans[i] = JSON.parse(fs.readFileSync(prefix+locale[i]).toString('utf8'));
			if(trans[i].constructor === Array) {
				dynTrans[locale[i]] = trans[i][1] || {};
				trans[i] = trans[i][0];
			}
		} catch(e) {
			if(fs.existsSync(prefix+locale[i]))
				console.trace(e);
			trans[i] = null;
		}
	var i18n = function(str){
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
	return {
		i18n: i18n,
		dynamic: dynTrans
	};
};

exports.preparser = function(app, str, file){
	var res = {};
	var obj = I18n(app, file);
	var i18n = obj.i18n;
	var dynamic = obj.dynamic;
	for(var k in dynamic)
		res[k] = 'i18n:' + JSON.stringify(dynamic[k]);
	var tmpls = str.match(/<(tmpl|json)\s+id\=\"\w+\"\s*>[\s\S]*?<\/(tmpl|json)>/gi);
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<(tmpl|json)\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/(tmpl|json)>$/i);
		var translated = i18n(tmpl[3]);
		for(var k in translated) {
			if(res[k]) res[k] += ',';
			else res[k] = '';
			if(tmpl[1] === 'json')
				res[k] += tmpl[2] + ':' + JSON.stringify(JSON.parse(translated[k]));
			else
				res[k] += tmpl[2] + ':' + handlebars.precompile(translated[k]);
		}
	}
	return res;
};

exports.parser = function(app, str, file){
	var res = {};
	var obj = I18n(app, file);
	var i18n = obj.i18n;
	var dynamic = obj.dynamic;
	var tmpls = str.match(/<(tmpl|json)\s+id\=\"\w+\"\s*>[\s\S]*?<\/(tmpl|json)>/gi);
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<(tmpl|json)\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/(tmpl|json)>$/i);
		var translated = i18n(tmpl[3]);
		for(var k in translated) {
			if(!res[k]) res[k] = {};
			if(tmpl[1] === 'json')
				res[k][tmpl[2]] = JSON.parse(translated[k]);
			else
				res[k][tmpl[2]] = handlebars.compile(translated[k]);
		}
	}
	var resFunc = {i18n: function(conn, str){
		return (dynamic[conn.language] && dynamic[conn.language][str]) || str;
	}};
	for(var k in res['']) (function(k){
		resFunc[k] = function(conn, args){
			return (res[conn.language] || res[''])[k](args);
		};
	})(k);
	return resFunc;
};
