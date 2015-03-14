# fw.mpa Basic Topics #

## Client Moduling Suggestions ##

Client code can contain scripts, stylesheets, and templates. You can also put related resources (e.g. images) into client directories.

### Designing Sub-Page Hierarchy ###

Before writing clients, you should first design the sub-page hierarchy. Here are some tips.

* Think carefully but do not over-design.
* A "global" sub-page is usually needed as the common ancestor of most sub-pages. It can hold RPC without the interrupt of sub-page switching.
* Do not make the hierarchy too deep. The length of sub-page stack is limited to 16.

If you have no idea of how to arrange hierarchy, consider this model: global-header-content.
Most of the time, an extension of the this model would be suitable for your project.

* Put basic scripts and stylesheets into "global", such as jQuery and CSS reset.
* Put common headers and footers into "header" sub-pages. You may have several different headers.
* Put main page content into "content" sub-pages. You may have lots of these sub-pages to show different contents.

Routing in fw-mpa is feature-rich. Read [Advanced Routing](../advanced_topics/advanced_routing.md) if you need some special features.

### Modulizing Client Code ###

When coding, always put your code into the right hierarchy.
For small projects, this will natually decouple your client code.
Ideally, each sub-page is an independent module.
However, you should read the tips below.

* Stylesheets are always global (set in html head). Give you CSS selectors a prefix to prevent conflicting with stylesheets from other sub-pages. You can also choose to put styles in ancestors for a better performance.
* Scripts in different hierarchy should control different part of DOM. Split the DOM when designing sub-page hierarchy.
* Scripts themselves are loaded only once (act as node.js require cache). In "main" scripts, put all your code into `fw.main(function(pg){ ... })`.
* Scripts are run in the global context. Protect your "lib" script code in a closure `(function(){ ... })()`.
* Scripts may be executed after the sub-page is destroyed. Check `pg.destroyed` property to make sure in callback functions.

fw.mpa supports a more aggressive moduling strategy called [Client Submodules](../advanced_topics/client_submodules.md).
It would be quite useful in a complicated system.

### Require-Style Loading ###

fw.mpa support require/exports strategy to modulize scripts.
In "lib" scripts, you can export interfaces through `fw.exports`, just like you do in node.js.

```js
(function(){
	fw.exports.plus = function(a, b){
		return a+b;
	};
	fw.exports.minus = function(a, b){
		return a-b;
	};
})();
```

In "main" scripts, `pg.lib` is an array of exports from all "lib" scripts in this sub-page.
Another way to get exports is using `pg.require(path, cb)`.
`cb` will receive the exports as the first argument.

If you require a script that is not listed in the route, it will be loaded in this sub-page.
In this way, you can avoid big scripts block the sub-page loading.

You can also require stylesheets and templates into sub-pages, but it is not recommended in most cases.
