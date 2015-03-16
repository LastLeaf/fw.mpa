# fw.mpa Advanced Topics #

## Advanced Directory Binding ##

Advanced directory bindings allows you to create complicated apps, such as apps with plugin systems.

### Multi-Bindings and Binding Prefix ###

There are altogether 6 types of directory bindings, "client", "module", "page", "render", "rpc", and "static".
Each type allows multiple directories to be binded using `app.bindDir(type, [prefix,] codeDir)`.

`prefix` is the binding position (default to '/'). It is a virtual path for visiting from other code.
`codeDir` is the real path that the virtual path should be mapped to.
For example, multiple directories can be binded "static" as follow.

```js
app.bindDir('static', 'static');
app.bindDir('static', '/logos', 'logos');
```

Two directories are binded above.
When clients visit files under "/logos", files are searched under "logos" directory of your code at first.
Then searched in "static" if not found.
(e.g. visiting "http://127.0.0.1/logos/64.png" will lead to searches of "logos/64.png" and "static/logos/64.png".)
When clients visit files out of "/logos", it will only be searched in "static".

### Binding Priorities ###

You can also bind two directories to one prefix.

```js
app.bindDir('static', 'static');
app.bindDir('static', '/logos', 'logos');
app.bindDir('static', 'static_high_prior');
```

The example above binded "static" and "static_high_prior" to "/" prefix.
The files will be searched under "static_high_prior" just before searching in "static".
This strategy allow you to virtually overwrite files in a plugin system.
Altogether, the searching priorities are:

* Directories binded to longer prefixes always have higher priorities.
* For directories binded to one prefix, latter binded directories have higher priorities.

All types of directories follow this strategy.
RPC function priorities are a little more complicated. Read [Advanced RPC](advanced_rpc.md) for more details.

### Relative Paths in Server Code ###

Relative paths are allowed in `fw.module(path)` and `fw.tmpl(path)`.
Both of them can only be used in the start of code files.

* In `fw.module(path)`, the `path` is relative to the binding prefix of current code.
* In `fw.tmpl(path)`, the `path` is relative to current file.

Currently, server side RPC do not allow relative paths.
For relative paths in client code, please read [Advanced Routing](advanced_routing.md).

### Server Module Dependencies ###

Using multi-binding, we can require a server module from other server modules.
Server modules in higher priority bindings are always loaded before lower priority bindings.
You can require a loaded module in lower priority bindings with `fw.module(path)`.
