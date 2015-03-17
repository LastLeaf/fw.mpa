// Copyright 2015 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

try {
	var fw = require('fw.mpa');
} catch(e) {
	// here you can easily run this example in fw.mpa source code
	// you should NOT do this in common apps
	var fw = require('../../index.js');
}

fw({
	ip: '0.0.0.0',
	port: 1180,
	app: ['app1/app.js', 'app2/app.js']
});
