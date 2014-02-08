// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// safe mapping
var SafeMap = function(defaultValue){
	var map = {};
	var hop = map.hasOwnProperty;
	var has = function(key){
		return hop.call(map, key);
	};
	var get = function(key){
		if(hop.call(map, key))
			return map[key];
		return defaultValue;
	};
	var set = function(key, value){
		map[key] = value;
		return value;
	};
	var del = function(key){
		if(hop.call(map, key))
			delete map[key];
	};
	var each = function(func){
		for(var k in map)
			func(k, map[k]);
	};
	return {
		has: has,
		get: get,
		set: set,
		del: del,
		each: each
	};
};

module.exports = SafeMap;