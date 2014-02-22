// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = {
	"./": {
		parent: "global",
		main: "index"
	},
	"*": {
		parent: "global",
		main: "404.js"
	}
};