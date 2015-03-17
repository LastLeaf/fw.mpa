// Copyright 2015 LastLeaf, LICENSE: github.lastleaf.me/MIT
'use strict';

fw.main(function(pg){
	document.getElementById('wrapper').innerHTML = pg.tmpl.helloworld();

	var input = document.createElement('input');
	input.setAttribute('type', 'button');
	input.setAttribute('value', 'Make an RPC...');
	input.onclick = function(){
		// sample RPC
		var a = 6;
		var b = 3;
		pg.rpc('/helloworld:divide', a, b, function(res){
			// called when done
			document.getElementById('wrapper').innerHTML = pg.tmpl.divideResult({ result: res });
		}, function(errMessage){
			// called when error
		});
	};
	document.getElementById('wrapper').appendChild(input);
});
