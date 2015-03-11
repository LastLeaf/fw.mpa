# fw.mpa #
fw:mpa: a multi-page WebApp and website framework.

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

The cooperation of sub-pages in a web page is not defined by the framework. A clear way is that parent/child sub-pages control parent/child nodes in DOM tree.

### Real-Time Model ###

fw.mpa is a real-time framework. It means that live connections are kept between servers and browsers. There are two ways of communication between servers and browsers: RPC and server events.

* RPC: the client can make calls to functions on servers, and can get result when needed.
* Server events: the server can push messages to clients.

A live connection is built automatically when a sub-page is inited. If disconnected unexpectedly, a new connection will be built for the sub-page.

fw.mpa uses [sockjs](https://github.com/sockjs) as low level connector. It means that Websockets is used when available, and almost all browsers are supported including IE6.

## Quick Start ##

1. [Configuring Framework](doc/quick_start/config_fw.md)
1. [Configuring App](doc/quick_start/config_app.md)
1. [Basic Directory Binding](doc/quick_start/dir_binding.md)
1. [Client Coding](doc/quick_start/client.md)
1. [Basic Routing](doc/quick_start/routing.md)
1. [RPC Functions](doc/quick_start/rpc.md)
1. [Running Apps](doc/quick_start/running.md)

## Basic Topics ##

* Multi-Apps in One Instance
* Client Moduling Suggestions
* Using Templates
* I18n Support
* Sessions and Database Binding
* Server Modules
* Server Side Rendering
* Special Pages
* Package WebApps

## Advanced Topics ##

* Serving Static Directories
* Advanced Directory Binding
* RPC from Server Side
* Client Submodules
* Advanced Routing
* Async Client Loading

## Additional Resource ##

* [Full Framework Configuration Options and Default Values](lib/default/fwconfig.js)
* [Full App Configuration Options and Default Values](lib/default/appconfig.js)
* API List

# LICENSE #
The MIT License (MIT)

Copyright 2014-2015 Fu Boquan (LastLeaf), MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
