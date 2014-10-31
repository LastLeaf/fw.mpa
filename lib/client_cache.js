// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var uglifyjs = require('uglify-js');
var handlebars = require('handlebars');

var preprocessor = require('./preprocessor.js');
var utils = require('./utils.js');

// call multi cbs
var callCbs = function(cbs){
	while(cbs.length) {
		cbs.shift().call(fw);
	}
};

// cache generator
var genCache = function(app, dirs, cbs){
	// load cache info
	fs.readFile(app.config.client.cache + '/cache.json', function(err, buf){
		if(err) {
			var info = {};
		} else {
			var info = JSON.parse(buf.toString('utf8'));
		}
		// gen cache
		var finishCount = dirs.length + 2;
		var finish = function(){
			finishCount--;
			if(!finishCount) callCbs(cbs);
		};
		// cache fw
		var walkedFw = [];
		var walkedClient = [];
		cacheFwDir(app, app.config.client.cache + '/~fw', info.fw, walkedFw, function(){
			// cache clients
			var nextDir = function(){
				if(!dirs.length) return cleanUp();
				cacheFwDir(app, app.config.client.cache + '/~client', dirs.pop(), info.client, walkedClient, finish);
			};
			nextDir();
		});
		// clean up
		var cleanUp = function(){
			removeNonWalked(app.config.client.cache + '/~fw', walkedFw);
			removeNonWalked(app.config.client.cache + '/~client', walkedClient);
		};
	});
};

// prevent running multi cache process for one app
module.exports = function(app){
	var processing = false;
	var redoCbs = [];
	var redoDirs = null;
	return function(dirs, cb){
		if(fw.debug) {
			cb();
			return;
		}
		if(processing) {
			redoDirs = dirs;
			redoCbs.push(cb);
			return;
		}
		processing = true;
		var cachedCb = function(){
			if(redoDirs) {
				redoCbs.push(cachedCb);
				genCache(app, redoDirs, redoCbs);
				redoCbs = [];
				redoDirs = null;
			} else {
				processing = false;
			}
		};
		genCache(app, dirs, [cb, cachedCb]);
	};
};

// check whether regeneration is needed
var regenChecker = function(dest, destInfo, old, oldInfo, regenFunc, cb){
	fs.exists(dest, function(exists){
		if(exists) return cb(null);
		mkdirp(path.dirname(dest), function(err){
			var gen = function(){
				regenFunc(function(){
					cb(destInfo);
				});
			};
			if(destInfo.sig === oldInfo.sig) {
				fs.exists(old, function(exists){
					if(!exists) return gen();
					fs.rename(old, dest, function(err){
						if(err) console.trace(err);
						cb(oldInfo);
					});
				});
			} else {
				gen();
			}
		});
	});
};

// TODO

// generate ~fw
var cacheFwDir = function(app, dest, oldInfo, walked, cb){
	// write cache/fw
	if(app.config.client.loadingLogo)
		fs.writeFileSync(app.config.client.cache+'/~fw/'+app.config.client.loadingLogo, fs.readFileSync(app.config.path.rc+'/'+app.config.client.loadingLogo));
	if(app.config.client.favicon)
		fs.writeFileSync(app.config.client.cache+'/~fw/'+app.config.client.favicon, fs.readFileSync(app.config.path.rc+'/'+app.config.client.favicon));
	// compress fw code
	var parseCopyright = function(str){
		var copyright = '';
		var m = str.match(/^\s*(\/\*.+?\*\/)/);
		if(m) copyright = m[1] + '\n';
		m = str.match(/^\s*(\/\/.+?)[\r\n]/);
		if(m) copyright = m[1] + '\n';
		return copyright;
	};
	var str = fs.readFileSync(__dirname+'/client/init.js').toString('utf8');
	fs.writeFileSync(app.config.client.cache+'/~fw/init.js', parseCopyright(str) + uglifyjs.minify(str, {fromString: true}).code);
	fs.writeFileSync(app.config.client.cache+'/~fw/libs.js', fs.readFileSync(__dirname+'/client/libs.js'));
	var str = fs.readFileSync(__dirname+'/client/fw.js').toString('utf8');
	fs.writeFileSync(app.config.client.cache+'/fw/fw.js', parseCopyright(str) + uglifyjs.minify(str, {fromString: true}).code);
};

// generate ~client
var cacheClientDir = function(app, dest, src, oldInfo, walked, cb){
		// run with cache
		rmdirp(app.config.path.cache + '/client/');
		var clientFileHandler = function(file, type, match){
			if(type) return;
			if(app.config.app.script === app.config.app.routes && path.basename(file) === 'routes.js') return;
			if(match === '.locale/') return;
			// find .min
			var cache = app.config.path.cache + '/client/' + file.split(path.sep).slice(1).join('/');
			mkdirp.sync(path.dirname(cache));
			if(file.slice(-7) === '.min.js') {
				if(fs.existsSync(file.slice(-7) + '.js')) return;
				fs.writeFileSync(cache, fs.readFileSync(file));
				return;
			}
			if(file.slice(-8) === '.min.css') {
				if(fs.existsSync(file.slice(-8) + '.css')) return;
				fs.writeFileSync(cache, fs.readFileSync(file));
				return;
			}
			var minFile = '';
			if(path.extname(file) === '.js')
				minFile = file.slice(0, -3) + '.min.js';
			else if(path.extname(file) === '.css')
				minFile = file.slice(0, -4) + '.min.css';
			// write
			if(minFile && fs.existsSync(minFile)) {
				// use .min instead of compressing
				fs.writeFileSync(cache, fs.readFileSync(minFile));
			} else {
				// compress
				preprocessor(app, file, function(res){
					if(!res) return;
					for(var k in res)
						fs.writeFileSync(cache+k, res[k]);
				});
			}
		};
		var clientStaticHandler = function(file, type, match){
			if(type) return;
			if(file.match(/\.(js|tmpl|css|stylus|locale[\/\\].+)$/)) return;
			var cache = app.config.path.cache + '/client/' + file.split(path.sep).slice(1).join('/');
			mkdirp.sync(path.dirname(cache));
			fs.writeFileSync(cache, fs.readFileSync(file));
		};
	}
};
