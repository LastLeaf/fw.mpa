// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var fs = require('fs');
var path = require('path');
var uglifyjs = require('uglify-js');
var handlebars = require('handlebars');
var mkdirp = require('mkdirp');

var preprocessor = require('./preprocessor.js');
var utils = require('./utils.js');

// call multi cbs
var callCbs = function(cbs){
	while(cbs.length) {
		cbs.shift().call(fw);
	}
};

// remove non walked files
var removeNonWalked = function(root, walked, info, cb, curPath){
	curPath = curPath || '';
	fs.stat(root, function(err, stat){
		if(err) return cb();
		if(stat.isDirectory()) {
			fs.readdir(root, function(err, files){
				if(err) return cb();
				var finishCount = files.length + 1;
				var removeCount = files.length;
				var finish = function(isRemoved){
					if(isRemoved) removeCount--;
					finishCount--;
					if(!finishCount) {
						if(!removeCount) {
							fs.rmdir(root, function(err){
								cb(true);
							});
						} else {
							cb(false);
						}
					}
				};
				files.forEach(function(file){
					removeNonWalked(root + '/' + file, walked, info, finish, curPath ? curPath + '/' + file : file);
				});
				finish(false);
			});
		} else {
			if(walked[curPath]) {
				cb(false);
			} else {
				delete info[curPath];
				fs.unlink(root, function(err){
					cb(true);
				});
			}
		}
	});
};

// cache generator
var genCache = function(app, dirs, cbs){
	var cachePos = app.config.client.cache;
	var cacheJsonFile = app.config.client.cache + '/cache.json';
	// load cache info
	mkdirp(app.config.client.cache, function(){
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
				var defVer = app.config.app.version;
				// generate versions obj
				var versFw = {};
				for(var k in info.fw) {
					if(info.fw[k].ver && info.fw[k].ver !== defVer) versFw[k] = info.fw[k].ver;
				}
				var versClient = {};
				for(var k in info.client) {
					if(info.client[k].ver !== defVer) versClient[k] = info.client[k].ver;
				}
				app.clientCacheVersions = {
					fw: versFw,
					client: versClient
				};
				// write cache.json and callback
				fs.writeFile(cacheJsonFile, JSON.stringify(info), function(err){
					if(err) {
						console.error(err.stack || 'Error: ' + err.message);
					}
					callCbs(cbs);
				});
			});
			// cache fw
			var walkedFw = [];
			var walkedClient = [];
			cacheFwDir(app, cachePos + '/~fw', info.fw, walkedFw, function(){
				removeNonWalked(cachePos + '/~fw', walkedFw, info.fw, waiting.add());
				// cache clients
				var nextDir = function(){
					if(!dirs.length) {
						removeNonWalked(cachePos + '/~client', walkedClient, info.client, waiting.end);
						return;
					}
					var dirInfo = dirs.pop();
					cacheClientDir(app, cachePos + '/~client', dirInfo.prefix, dirInfo.dir, info.client, walkedClient, nextDir);
				};
				nextDir();
			});
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
			app.clientCacheVersions = {
				fw: {},
				client: {}
			};
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
				cb(oldInfo);
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
	mkdirp(path.dirname(dest), function(){
		var w = fs.createWriteStream(dest);
		var r = fs.createReadStream(src);
		r.pipe(w);
		r.on('error', function(err){
			console.error('Failed copying file.');
			console.error(err.stack || 'Error: ' + err.message);
			cb();
		});
		w.on('error', function(err){
			console.error('Failed copying file.');
			console.error(err.stack || 'Error: ' + err.message);
			cb();
		});
		r.on('end', function(){
			cb();
		});
	});
};

// async waiting helper
var waitingJobs = function(cb){
	var c = 1;
	var end = function(){
		if(--c) return;
		cb();
		cb = function(){};
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
		oldInfo.sig = fw.fwVersion;
		cb();
	});
	// write cache/fw
	[app.config.client.loadingLogo, app.config.client.favicon].forEach(function(file){
		waiting.add();
		fs.stat(file, function(err, stat){
			if(err || !stat) {
				waiting.end();
				return;
			}
			var destInfo = {
				ver: app.config.app.version,
				sig: stat.size + '|' + stat.mtime.getTime()
			};
			var basename = path.basename(file);
			regenerator(dest + '/' + basename, true, destInfo, oldInfo[basename], file, copyFile, function(info){
				walked[basename] = true;
				if(info) oldInfo[basename] = info;
				waiting.end();
			});
		});
	});
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
		sig: fw.fwVersion
	};
	// init.js
	regenerator(dest+'/init.js', true, destInfo, oldInfo, __dirname+'/client/init.js', function(dest, src, cb){
		fs.readFile(src, function(err, buf){
			var str = buf.toString('utf8');
			fs.writeFile(dest, parseCopyright(str) + uglifyjs.minify(str, {fromString: true}).code, function(err){
				if(err) {
					console.error(err.stack || 'Error: ' + err.message);
				}
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
			fs.writeFile(dest, parseCopyright(str) + uglifyjs.minify(str, {fromString: true}).code, function(err){
				if(err) {
					console.error(err.stack || 'Error: ' + err.message);
				}
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
		// compress script
		var compress = function(){
			preprocessor(app, src, function(res){
				if(!res) return cb();
				for(var k in res) {
					mkdirp(path.dirname(dest), function(){
						fs.writeFile(dest, res[k], cb);
					});
					return;
				}
			});
		};
		// check src file type
		if(!src.match(/\.(js|tmpl|css|stylus|locale[\/\\].+)$/)) {
			return copyFile(dest, src, cb);
		}
		// find .min
		var ext = path.extname(dest);
		if(ext === '.js') {
			if(dest.slice(-7) === '.min.js') copyFile(dest, src, cb);
			else fs.exists(src.slice(0, -3) + '.min.js', function(exists){
				if(exists) copyFile(dest, src.slice(0, -3) + '.min.js', cb);
				else compress();
			});
		} else if(ext === '.css') {
			if(dest.slice(-8) === '.min.css') copyFile(dest, src, cb);
			else fs.exists(src.slice(0, -4) + '.min.css', function(exists){
				if(exists) copyFile(dest, src.slice(0, -4) + '.min.css', cb);
				else compress();
			});
		} else {
			compress();
		}
	};
	// walk src tree
	prefix = prefix.slice(1);
	var requireLocale = [];
	var foundLocale = {};
	var waiting = waitingJobs(function(){
		// fill missing locale files
		var waiting = waitingJobs(cb);
		var locale = app.config.app.locale;
		for(var i=0; i<requireLocale.length; i++) {
			var tmplFile = requireLocale[i];
			for(var j=0; j<locale.length; j++) {
				if(foundLocale[tmplFile + '.' + locale[j]]) continue;
				if(prefix) tmplFile = prefix + '/' + tmplFile;
				var srcFile = tmplFile + '.js';
				var destFile = tmplFile + '.' + locale[j] + '.js';
				waiting.add();
				copyFile(dest + '/' + destFile, dest + '/' + srcFile, function(){
					walked[destFile] = true;
					oldInfo[destFile] = utils.deepExtend({}, oldInfo[srcFile]);
					waiting.end();
				});
			}
		}
		waiting.end();
	});
	utils.walkFileTree(src, function(file, stat){
		var destInfo = {
			ver: app.config.app.version,
			sig: stat.size + '|' + stat.mtime.getTime()
		};
		var locale = file.match(/\.locale[\/\\](.+)$/);
		if(locale) {
			// locale file
			locale = locale[1];
			var tmplFile = src + '/' + file.replace(/\.locale[\/\\].+$/, '.tmpl');
			fs.stat(tmplFile, function(err, stat){
				if(err || !stat) return;
				destInfo.sig += ',' + stat.size + '|' + stat.mtime.getTime();
				var destFile = file.replace(/\.locale[\/\\].+$/, '.tmpl.'+locale+'.js');
				if(prefix) destFile = prefix + '/' + destFile;
				waiting.add();
				regenerator(dest + '/' + destFile, !walked[destFile], destInfo, oldInfo[destFile], src + '/' + file, processFile, function(info){
					walked[destFile] = true;
					if(info) oldInfo[destFile] = info;
					foundLocale[file.replace(/\.locale[\/\\].+$/, '.tmpl.' + locale)] = true;
					waiting.end();
				});
			});
			return;
		}
		var destFile = prefix ? prefix + '/' + file : file;
		if(path.extname(file) === '.tmpl') {
			requireLocale.push(file);
			destFile += '.js';
		}
		if(path.extname(file) === '.stylus') destFile += '.css';
		waiting.add();
		regenerator(dest + '/' + destFile, !walked[destFile], destInfo, oldInfo[destFile], src + '/' + file, processFile, function(info){
			walked[destFile] = true;
			if(info) oldInfo[destFile] = info;
			waiting.end();
		});
	}, waiting.end);
};
