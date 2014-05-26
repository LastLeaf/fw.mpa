# fw.mpa Documentation #

## Guide - Running as a Packaged Web-App ##

fw.mpa is able to generate packaged web-app. Currently, the app manifest is not generated, because it requires more information. You can manually create and edit it.

You can also put the generated code in [Cordova](http://cordova.apache.org/). It should work perfect as a cordova mobile app.

### The Package ###

In cache mode, a `webapp.html` is generated with the code cache. It's the web-app start file. If everything goes well, you can directly open it in the browser (in file:// protocol).

The whole `cache/` is the web-app (you may rename the `webapp.html` to `index.html`). If you need to load some files from `static/`, copy them to the `cache/` when you package your app. It may be difficult to debug, for the code is minified. You can just debug in common website mode.

Notes: the path in routes will never conflict with the static resource URLs. Don't worry about that.

### Extra Work Needed for Web-App ###

There is some extra work to make the web-app running. Make sure you know the following things.

* The working server configuration (server.workingServer) should not be left default. The web-app need the server's address for RPC requests.
* Use server-side rendering as less as you can. It has no meaning for the web-app. What's worse, it blocks the app's rendering when the device is offline.
* A link to a special page will lead to an online web page on the working server, and could not go back unless using history.go() in the special pages.
