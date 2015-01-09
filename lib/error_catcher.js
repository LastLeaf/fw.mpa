// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

var domain = require('domain');

module.exports = function(runFunc, errFunc){
	var d = domain.create();
	d.on('error', errFunc);
	d.run(runFunc);
};
