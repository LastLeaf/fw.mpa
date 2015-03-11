# fw.mpa Quick Start #

## Running Apps ##

We combined some code together, and made [a simple example](../../examples/quick_start).

You can run this example simply by `node index.js` or `node .`.
The app is served at [127.0.0.1:1180](http://127.0.0.1:1180/).

### Running Modes ###

For the convinience, fw.mpa can be run in one of several modes.

By default, "debug" mode is used.
In this mode, lots of debug information will be displayed in node console and browser console.
Caches are prevented to make coding and debugging easier.
Most of the time, server-side files are auto-reloaded when they are changed, so you do not need to restart node process when debugging.
However, sometimes (not always) when you add/remove/rename server-side files, you need to restart node process.

"cache" mode is good for building and running on productional servers.
In this mode, most debug information from framework are depressed.
Client-side files are automatically processed, minified, and cached for the speed of visiting.
The cached code are stored in "cache" directory by default.
Framework will create another guard process to auto-restart when your server code crashes.
When you updated code, you should restart app or framework to apply.

"run" mode works the same as "cache" mode, except the framework will not create or modify client code caches.
You should provide the cache directory (generated in "cache" mode) manually.
This mode helps you when you do not want to waste time in scanning client code changes.
It will be much faster when restart apps.
However, take care when using this mode! You should ALWAYS provide the latest cache directory!

"limited" mode works the same as "run" mode, except the framework will works in only one process (no guard process created).
In this mode, the framework cannot auto-restart when crashed. You need external facilities to restart framework from crashes.
Also, the `fw.restart(...)` API will not works.
You need to provide cache directory as in "run" mode.

To run in a specified mode, write the mode name into the "FW" environment variable.
e.g. `FW=CACHE node index.js` will run framework in "cache" mode.
