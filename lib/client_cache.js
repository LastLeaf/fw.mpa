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
	var cachePos = app.config.client.cache;
	var cacheJsonFile = app.config.client.cache + '/cache.json';
	// load cache info
	fs.readFile(cacheJsonFile, function(err, buf){
		if(err) {
			var info = {
				fw: {},
				client: {}
			};
		} else {
			var info = JSON.parse(buf.toString('utf8'));
		}
		// gen cache
		var waiting = waitingJobs(function(){
			// write cache.json and callback
			fs.writeFile(cacheJsonFile, function(err){
				if(err) console.trace(err);
				callCbs(cbs);
			});
		});
		// cache fw
		var walkedFw = [];
		var walkedClient = [];
		cacheFwDir(app, cachePos + '/~fw', info.fw, walkedFw, function(){
			removeNonWalked(cachePos + '/~fw', walkedFw, waiting.add());
			// cache clients
			var nextDir = function(){
				if(!dirs.length) {
					removeNonWalked(cachePos + '/~client', walkedClient, waiting.end);
					return;
				}
				var dirInfo = dirs.pop();
				cacheFwDir(app, cachePos + '/~client', dirInfo.prefix, dirInfo.dir, info.client, walkedClient, nextDir);
			};
			nextDir();
		});
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
var regenerator = function(dest, overwrite, destInfo, oldInfo, src, regenFunc, cb){
	var checkSig = function(){
		var gen = function(){
			regenFunc(dest, src, function(){
				cb(destInfo);
			});
		};
		if(oldInfo && destInfo.sig === oldInfo.sig) {
			fs.exists(dest, function(exists){
				if(!exists) return gen();
				fs.rename(old, dest, function(err){
					if(err) console.trace(err);
					cb(oldInfo);
				});
			});
		} else {
			gen();
		}
	};
	if(overwrite) {
		mkdirp(path.dirname(dest), checkSig);
	} else {
		fs.exists(dest, function(exists){
			if(exists) return cb(null);
			mkdirp(path.dirname(dest), checkSig);
		});
	}
};

// copy file helper
var copyFile = function(dest, src, cb){
	var w = fs.createWriteStream(dest);
	var r = fs.createReadStream(src);
	r.on('error', function(err){
		console.trace(err);
		cb();
	});
	r.on('end', function(){
		cb();
	});
};

// async waiting helper
var waitingJobs = function(cb){
	var c = 1;
	var end = function(){
		if(--c) {
			cb();
			cb = function(){};
		}
	};
	var add = function(){
		c++;
		return end;
	};
	return {
		add: add,
		end: end
	};
};

// generate ~fw
var cacheFwDir = function(app, dest, oldInfo, walked, cb){
	var waiting = waitingJobs(function(){
		info.sig = destInfo.sig;
		cb();
	});
	// write cache/fw
	if(app.config.client.loadingLogo) {
		var basename = path.basename(app.config.client.loadingLogo);
		copyFile(dest+'/'+basename, app.config.client.loadingLogo, waiting.add());
		walked[basename] = true;
	}
	if(app.config.client.favicon) {
		var basename = path.basename(app.config.client.favicon);
		copyFile(dest+'/'+basename, app.config.client.favicon, waiting.add());
		walked[basename] = true;
	}
	// helper funcs
	var parseCopyright = function(str){
		var copyright = '';
		var m = str.match(/^\s*(\/\*.+?\*\/)/);
		if(m) copyright = m[1] + '\n';
		m = str.match(/^\s*(\/\/.+?)[\r\n]/);
		if(m) copyright = m[1] + '\n';
		return copyright;
	};
	var destInfo = {
		sig: fw.version
	};
	// init.js
	regenerator(dest+'/init.js', true, destInfo, oldInfo, __dirname+'/client/init.js', function(dest, src, cb){
		fs.readFile(src, function(err, buf){
			var str = buf.toString('utf8');
			fs.writeFile(parseCopyright(str) + uglifyjs.minify(str, {fromString: true}).code, function(err){
				if(err) console.trace(err);
				cb();
			});
		});
	}, waiting.add());
	walked['init.js'] = true;
	// libs.js
	regenerator(dest+'/libs.js', true, destInfo, oldInfo, __dirname+'/client/libs.js', copyFile, waiting.add());
	walked['libs.js'] = true;
	// fw.js
	regenerator(dest+'/fw.js', true, destInfo, oldInfo, __dirname+'/client/fw.js', function(dest, src, cb){
		fs.readFile(src, function(err, buf){
			var str = buf.toString('utf8');
			fs.writeFile(parseCopyright(str) + uglifyjs.minify(str, {fromString: true}).code, function(err){
				if(err) console.trace(err);
				cb();
			});
		});
	}, waiting.add());
	walked['fw.js'] = true;
	waiting.end();
};

// generate ~client
var cacheClientDir = function(app, dest, prefix, src, oldInfo, walked, cb){
	// file processor
	var processFile = function(dest, src, cb){
		if(dest.match(/\.locale[\/\\]/)) {
			return cb();
		}
		if(!dest.match(/\.(js|tmpl|css|stylus)$/)) {
			return copyFile(dest, src, cb);
		}
		// compress script
		var compress = function(){
			preprocessor(app, src, function(res){
				if(!res) return;
				var waiting = waitingJobs(cb);
				for(var k in res) {
					fs.writeFile(dest+k, res[k], waiting.add());
				}
				waiting.end();
			});
		};
		// find .min
		var ext = path.extname(dest);
		if(ext === '.js') {
			if(dest.slice(-7) === '.min.js') copyFile(dest, src, cb);
			else fs.exists(src.slice(-3) + '.min.js', function(exists){
				if(exists) copyFile(dest, src.slice(-3) + '.min.js', cb);
				else compress();
			});
		} else if(ext === '.css') {
			if(dest.slice(-8) === '.min.css') copyFile(dest, src, cb);
			else fs.exists(src.slice(-4) + '.min.css', function(exists){
				if(exists) copyFile(dest, src.slice(-4) + '.min.css', cb);
				else compress();
			});
		} else {
			compress();
		}
	};
	var clientStaticHandler = function(file, type, match){
		if(type) return;
		var cache = app.config.path.cache + '/client/' + file.split(path.sep).slice(1).join('/');
		mkdirp.sync(path.dirname(cache));
		fs.writeFileSync(cache, fs.readFileSync(file));
	};
	// walk src tree
	var waiting = waitingJobs(cb);
	walkFileTree(src, function(file, stat){
		// TODO handle tmpl files
		var destInfo = {
			ver: app.config.app.version,
			sig: stat.size + '|' + stat.mtime.getTime()
		};
		waiting.add();
		regenerator(dest + prefix + '/' + file, !walked[prefix + '/' + file], destInfo, oldInfo[prefix + '/' + file], src + '/' + file, processFile, function(info){
			walked[prefix + '/' + file] = true;
			oldInfo[prefix + '/' + file] = info;
			waiting.end();
		});
	}, waiting.add());
	waiting.end();
};
