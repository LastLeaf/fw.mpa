// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

module.exports = {
	global: {
		main: "/global",
		lib: "http://code.jquery.com/jquery-1.10.1.min.js"
	},
	"/": {
		parent: "global",
		main: "index",
		tmpl: "index",
		style: ["index"]
	},
	"*": {
		parent: "global",
		main: "404.js"
	}
};