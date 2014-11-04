// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

// init fw.mpa
var fw = require('../../index.js');
var fwconfig = require('./fwconfig.js');

// start with two apps
process.chdir(__dirname);
fw(fwconfig);
