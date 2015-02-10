# fw.mpa Quick Start #

## Client Coding ##

Usually, directory "client" is binded as client side code position.
You can put JavaScript (.js), CSS (.css), and templates (.tmpl) files in this directory.
Currently, fw.mpa has integrated [handlebars](http://handlebarsjs.com/) as template engine.
[stylus](http://learnboost.github.io/stylus/) is also supported as CSS preprocessor (.stylus files are processed by stylus).
Read their docs for the usage of them.

Other files, such as images referenced in CSS, should also be put in this directory.
However, files that not about the code should not be put here (consider "static" instead).

### Client Side JavaScript ###

Generally, there are two types of JavaScript files - "lib" and "main".
"lib" means library files. Common js code and libs can be directly used as "lib".
"main" files are special js files. They can define a function that will be excuted while sub-page loading.
"lib" files are ensured loaded before "main" files, so that you can use libraries when handling sub-pages.

Each "main" file should contain a `fw.main(...)` call. An example:

```js
fw.main(function(pg){
	document.body.innerHTML = '<p>Hello world!</p>';
});
```

The function will be excuted everytime when a related sub-page is loaded.

### Templates ###

Templates are HTML segments. You should always use templates when you need to generate HTML content.
A .tmpl file contains one or more templates. An example:

```html
<tmpl id="hello">
	<span class="hello">Hello</span>
</tmpl>

<tmpl id="world" minify>
	<span>world!</span>
</tmpl>
```

The "id" is an unique ID to identify the template.
"minify" is optional. When minify is used, framework will try to minify this template to reduce its code size.
However, a minified template MAY be different from the original template, and minify process MAY throw error on some templates.
If you cannot solve problems in minify process, just do not minify it.
