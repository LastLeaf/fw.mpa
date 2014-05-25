# fw.mpa #
_a multi-page web-app and website framework_

## Introduction ##

fw.mpa is designed to be a real-time web framework suitable for both apps and websites. It minifies the differences of the structure of web-apps (including Cordova apps) and websites.

The key idea of this framework is preventing page reloading when page switches. It's slightly similar to _PJAX_, but the framework manages the browser history and providing an page model that is easy to understand.

Currently, fw.mpa requires node.js on server side, and works on major browsers. It also provides simple database binding, and i18n support.

### Page Model ###

Apps and websites based on fw.mpa should follow a _Parent/Child_ page model. This model splits a page into several sub-pages with parent and child relationships. A legal page address is pointed to a child-most sub-page, and every sub-page may have a "parent" sub-page. Parent sub-pages always init before child sub-pages. When a child sub-page need to be switched to another child sub-page, the parent sub-page is not rebuilt.

Here is a clear example to show how this page model works.

* The framework keeps a stack which contains the current sub-pages. When framework inits, the stack is inited empty. `stack: []`
* The page address is pointed to sub-page C. C's parent is B, and B's parent is A. Then A is inited first and pushed into the stack. `stack: [A]`
* When A is fully loaded and inited, B follows. `stack: [A, B]`
* When B is fully loaded and inited, C follows and the whole page is loaded. `stack: [A, B, C]`
* Later, a page switching is required (e.g. user clicked an button). The new page address is pointed to D. D's parent is A. Then C in the stack is poped and unloaded. `stack: [A, B]`
* B is also unloaded. `stack: [A]`
* A is D's parent, so A is not changed. D is loaded and inited, and the whole page is loaded. `stack: [A, D]`

### Real-Time Model ###

fw.mpa is a real-time framework. It means that live connections are kept between servers and browsers. There are two ways of communication between servers and browsers: RPC and server events.

* RPC: the client can make calls to functions on servers, and can get result when needed.
* Server events: the server can push messages to clients.

A live connection is built automatically when a sub-page is inited. If disconnected unexpectedly, a new connection will be built for the sub-page.

fw.mpa uses [sockjs](https://github.com/sockjs) as low level connector. It means that Websockets is used when available, and almost all browsers are supported including IE6.

## Guide ##

1. [Creating New Project](doc/create_project.md)
1. [Running as a Packaged Web-App](doc/packaged_webapp.md)
1. [Database Binding](doc/database_binding.md)
1. [Client Side Code](doc/client.md)
1. [Routing](doc/routing.md)
1. [RPC Functions, Server Messages and Server Modules](doc/rpc.md)
1. [Server-Side Rendering](doc/server_side_rendering.md)
1. [Special Pages](doc/special_pages.md)
1. [I18n Support](doc/i18n.md)

## Additional Resource ##

* [Full Configuration and Default Values](lib/default/fwconfig.js)
* [API List](doc/api.md)

# Development Status #
fw.mpa is still not stable. See issues if you are interested.

# LICENSE #
Copyright 2014 LastLeaf, MIT License.
