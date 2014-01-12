// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// safe mapping
module.exports = function(defaultValue){
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
	return {
		has: has,
		get: get,
		set: set,
		del: del
	};
};
