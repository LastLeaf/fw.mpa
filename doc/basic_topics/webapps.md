# fw.mpa Basic Topics #

## Packaging WebApps ##

fw.mpa allows you to package WebApps directly from processed client code.
If you follow a little restriction, you can make online website and WebApps simultaneously, without any code changes!

You can create WebApps for targets below (but not limit to these targets).

* Mobile devices with the support of [PhoneGap](http://phonegap.com/), [Cordova](http://cordova.apache.org/), [Crosswalk](https://crosswalk-project.org/), etc.
* Desktop apps with the support of [nw.js](http://nwjs.io/), [XULRunner](https://developer.mozilla.org/en-US/docs/Mozilla/Projects/XULRunner), etc.
* [W3C Packaged Web Apps](http://www.w3.org/TR/widgets/).

### Things to Know before Packaging ###

There are some limitation for WebApps. Avoid using some features when coding.

* Use server-side rendering as less as you can. It has no meaning for the WebApps. What's worse, it blocks the app's rendering when the device is offline.
* A link to a special page will lead to an online web page on the working server, and could not go back unless using history.go() in the special pages.

Extra works to do:

* The working server configuration ("server.workingServer" in app configuration) should not be left default. WebApps need the server's address for RPC requests.
* Implement the `fw.onserverchanged` event handler. In default, you are not allowed to connect to the RPC server when the server is updated. To ignore the updates, set `fw.version` to the latest version (provided to the handler as the first argument).
* When visiting dynamically generated files (e.g. user uploaded files) in "static" directories, make sure you are not using relative paths. The paths should be URL of online servers.
* Make sure your UI is suitable for the screen/window size of target devices. You need to change "client.meta.viewport" in app configuration properly.
* Make sure your WebApps have suitable offline behaviors.

### Serving Static Files ###

Files in "cache" directory and "static" directory can be served directly by static HTTP servers, such as [nginx](http://nginx.org/).
Serving them directly can help promote the preformance of your websites.
Read the docs of HTTP servers to find how.

The "cache" directory should contain 2 files and 2 sub-directories.

* "webapp.html" is the standard WebApp start file.
* "cache.json" contains some information used for updating cache. Do not delete it.
* "~client" directory contains all processed and minified client code.
* "~fw" directory contains other files needed in the WebApp.

When packaging WebApps, "webapp.html", "~client", and "~fw" are required.
Copy them out to an empty directory.
If your code requires some static resource under "static" directory, copy them to the directory as well.

If all goes well, the WebApp should be runnable now.
Open the "webapp.html" in your browser and test it.

### Packaging with Tools ###

After passed tests, you have got all files needed to package.
However, different packaging tools have different usage. You should read their docs.
Usually, a little more code or configurations are required by the packaging tools.

Most packaging tools requires a directory (usually named "www") to store the web code.
Putting all tested files ("webapp.html", "~client", "~fw", etc) into it should works.
If the tools require start file to be named "index.html", just rename "webapp.html" to "index.html".
