// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var mkdirp = require('mkdirp');
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
		var def = str.replace(/`[^`]*`/g, function(match){
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
			if(!res[k]) res[k] = '';
			else res[k] += ',';
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
	for(var k in dynamic)
		(function(k){
			res[k] = { i18n: function(str){
				return dynamic[k][str] || str;
			} };
		})(k);
	var tmpls = str.match(/<(tmpl|json)\s+id\=\"\w+\"\s*>[\s\S]*?<\/(tmpl|json)>/gi);
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<(tmpl|json)\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/(tmpl|json)>$/i);
		var translated = i18n(tmpl[3]);
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
	return function(conn){
		return res[conn.language] || res[''];
	};
};

exports.generateLocaleFiles = function(app, str, file, locale, cb){
	if(!locale || typeof(locale) === 'function') {
		cb = locale;
		locale = app.config.app.locale;
	} else if(typeof(locale) !== 'object') {
		locale = [locale];
	}
	if(!locale.length) {
		cb(0);
		return;
	}
	// parse string
	var tmpls = str.match(/<(tmpl|json)\s+id\=\"\w+\"\s*>[\s\S]*?<\/(tmpl|json)>/gi);
	var oriStrings = [];
	while(tmpls && tmpls.length) {
		var tmpl = tmpls.shift().match(/^<(tmpl|json)\s+id\=\"(\w+)\"\s*>([\s\S]*?)<\/(tmpl|json)>$/i);
		var matches = tmpl[3].match(/`[^`]*`/g);
		if(!matches) matches = [];
		for(var i=0; i<matches.length; i++)
			oriStrings.push(matches[i].slice(1, -1));
	}
	// write locale files
	var prefix = file.slice(0, file.lastIndexOf('.')) + '.locale/';
	var processTrans = function(err){
		if(err) {
			console.error(err);
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
					console.trace(e);
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
						console.trace(err);
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
