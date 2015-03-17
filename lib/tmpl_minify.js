// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var htmlMinifier = require('html-minifier').minify;

module.exports = function(str){
	return htmlMinifier(str, {
		removeComments: true,
		removeCommentsFromCDATA: true,
		collapseWhitespace: true,
		conservativeCollapse: false,
		removeAttributeQuotes: false,
		caseSensitive: true,
		customAttrAssign: [
			/\{\{.+?\}\}/, /\`.+?\`/
		],
		customAttrSurround: [
			[/\{\{\#.+?\}\}/, /\{\{\/.+?\}\}/]
		]
	});
};
