# fw.mpa Advanced Topics #

## Client Submodules ##

When designing and coding complicated apps, you may feel awful to mix a lot of scripts and templates in a big sub-page.
You would love to split a sub-page into more small slices.
fw.mpa allows you to do that through client submodules.

A submodule is a small group of client code files.
Stylesheets, templates, "lib" scripts, "main" scripts, and even other submodules can all be included.
You just need to write a JSON file with .subm extname (named like "mySubmodule.subm") to declare a submodule.

```json
{
	"style": "mySubmStyles.css",
	"tmpl": "mySubmTmpls.tmpl",
	"lib": ["mySubmLib1.js", "mySubmLib2.js"],
	"main": "mySubmInit.js",
	"subm": []
}
```

Every submodule declaration can contain 5 fields like above.
The "subm" field lists all submodules that required to be loaded before this submodule.

Submodules can be included in routes. Just write the path of submodule declaration file in the "subm" field.

```js
app.route.set('global', {
	subm: "/mySubmodule.subm"
});
```

Then the submodule will be loaded before sub-page load.
You can also load a submodule dynamically with `pg.require(path, cb)`.

In the submodule, "main" scripts can declare main functions with `fw.main(func)`.
`func` accepts two arguments, `pg` and `subm`.
`subm.lib` contains an array of all exports from "lib" scripts.
`subm.tmpl` contains templates loaded in this submodule.
`subm.subm` contains an array of all `subm` object from required submodules.
