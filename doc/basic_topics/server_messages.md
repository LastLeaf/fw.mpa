# fw.mpa Basic Topics #

## Real-Time Server Messages ##

In fw.mpa, the basic ways to communicate with servers are RPC requests and server messages.
RPC requests should be respond within a limit of time, otherwise client will get a timeout error with no error messages.
If you want to push messages to a client any time you like, you should use server messages.

In RPC function, one `conn` object corresponds to one sub-page.
It has a method `conn.msg(event [, args...])` to push a message to the client sub-page.

```js
// PRC: myMsg.js
exports.waitingMsg = function(conn, res){
	res();
	setInterval(function(){
		conn.msg('newMsg', Date.now());
	}, 60000);
};
```

The RPC function above send current timestamp to client every minutes.
The client should listen to "newMsg" event using `pg.msg(event [, args...])`.
Because the `conn` object will be rebuilt every time the client dropped and reconnected, you should call the "waitingMsg" function every time the client is just connected.
This can be achieved through "socketConnect" event of the `pg` object.
An example:

```js
fw.main(function(pg){
	// listen to event
	pg.msg('newMsg', function(timestamp){
		console.log(timestamp);
	});
	// register this client to server
	pg.on('socketConnect', function(){
		pg.rpc('/myMsg:waitingMsg', function(){
			// on success
		}, function(){
			// on error
		});
	});
});
```
