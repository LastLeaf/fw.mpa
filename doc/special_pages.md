# fw.mpa Documentation #

## Guide - Special Pages ##

fw.mpa allows some special pages (e.g. RSS feeds) generated indepently. The following example is a special page in address '/special/page'.

```js
// /page/special/page.js
module.exports = function(req, res){
	res.send('Hello world! (from special page)');
};
```

Notes: fw.mpa is based on [express](http://expressjs.com/). See [express document](http://expressjs.com/api.html) for the detailed usage of the `req` and `res` argument. In addition, a `conn` object is provided as `req.conn`.
