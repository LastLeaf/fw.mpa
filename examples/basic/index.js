// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// init fw.mpa
var fw = require('../../index.js');
var fwconfig = require('./fwconfig.js');

// start with two apps
fw(fwconfig, 'app1/app.js', 'app2/app.js');
