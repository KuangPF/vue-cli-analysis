# new Service

`Service` 的 `constructor` 方法如下：

```js
constructor (context, { plugins, pkg, inlineOptions, useBuiltIn } = {}) {
  ...
  this.webpackChainFns = [] // 每一项为 chainable webpack 配置函数
  this.webpackRawConfigFns = [] // 每一项为 raw webpack 配置函数
  this.devServerConfigFns = []
  this.commands = {}
  // Folder containing the target package.json for plugins
  // 项目中 package.json 目录
  this.pkgContext = context
  // package.json containing the plugins
  this.pkg = this.resolvePkg(pkg)
  // If there are inline plugins, they will be used instead of those
  // found in package.json.
  // When useBuiltIn === false, built-in plugins are disabled. This is mostly
  // for testing.
  // 如果有 inline plugins 的话，就不会去加载 package.json 里 devDependencies 和 dependencies 的插件
  this.plugins = this.resolvePlugins(plugins, useBuiltIn)
  // resolve the default mode to use for each command
  // this is provided by plugins as module.exports.defaultModes
  // so we can get the information without actually applying the plugin.
  // 为命令指定模式
  // 注册的插件可以通过 module.exports.defaultModes 指定特定的模式
  /*{
    serve: 'development',
    build: 'production',
    inspect: 'development',
    'test:unit': 'test'
  }*/
  this.modes = this.plugins.reduce((modes, { apply: { defaultModes }}) => {
    return Object.assign(modes, defaultModes)
  }, {})
}
```
实例化的过程主要进行了插件的解析和为每一种 CLI 命令指定模式，先看一下插件的解析。

### resolvePlugins
```js
resolvePlugins (inlinePlugins, useBuiltIn) {
  const idToPlugin = id => ({
    id: id.replace(/^.\//, 'built-in:'),
    apply: require(id)
  })

  let plugins

  // 内置插件
  const builtInPlugins = [
    './commands/serve',
    './commands/build',
    './commands/inspect',
    './commands/help',
    // config plugins are order sensitive
    './config/base',
    './config/css',
    './config/dev',
    './config/prod',
    './config/app'
  ].map(idToPlugin)

  // builtInPlugins
  //  [{ id: 'built-in:commands/serve', apply:{ [Function] defaultModes: [Object] } },...]
  if (inlinePlugins) {
    plugins = useBuiltIn !== false
      ? builtInPlugins.concat(inlinePlugins)
      : inlinePlugins
  } else {
    //const pluginRE = /^(@vue\/|vue-|@[\w-]+\/vue-)cli-plugin-/
    // exports.isPlugin = id => pluginRE.test(id)
    const projectPlugins = Object.keys(this.pkg.devDependencies || {})
      .concat(Object.keys(this.pkg.dependencies || {}))
      .filter(isPlugin)
      .map(id => {
        if (
          this.pkg.optionalDependencies &&
          id in this.pkg.optionalDependencies
        ) {
          let apply = () => {}
          try {
            apply = require(id)
          } catch (e) {
            warn(`Optional dependency ${id} is not installed.`)
          }

          return { id, apply }
        } else {
          return idToPlugin(id)
        }
      })

    plugins = builtInPlugins.concat(projectPlugins) // 内置插件和项目中的插件
  }

  // Local plugins
  // 项目本地的插件，针对于只需要在项目里直接访问插件 API 而不需要创建一个完整的插件
  if (this.pkg.vuePlugins && this.pkg.vuePlugins.service) {
    const files = this.pkg.vuePlugins.service
    if (!Array.isArray(files)) {
      throw new Error(`Invalid type for option 'vuePlugins.service', expected 'array' but got ${typeof files}.`)
    }
    plugins = plugins.concat(files.map(file => ({
      id: `local:${file}`,
      apply: loadModule(file, this.pkgContext)
    })))
  }
  return plugins
}
```
可以将解析的插件分为4类：
* 内置插件
* inlinePlugins
* package.json 插件
* package.vuePlugins 插件

**内置插件**指的是 `@vue/cli-service` 内部提供的插件，又可以大致分为两类，`serve,build,inspect,help`这一类插件在内部动态注册新的 CLI 命令，
开发者即可通过 npm script 的形式去启动对应的 CLI 命令服务，`base ,css, dev, prod, app` 这一类插件主要是完成 `webpack` 本地编译构建时的各种相关的配置。
`@vue/cli-service` 将 `webpack` 的开发构建功能收敛到内部来完成。

**inlinePlugins** 指的是直接在实例化 `Service` 时传入，执行 `vue serve` 和 `vue build` 命令时会创建一个` Service` 实例，并传入 `inlinePlugins`。

**package.json 插件** 指的是 `devDependencies` 和 `dependencies` 中的 vue 插件，比如 `@vue/cli-plugin-eslint`。

**package.vuePlugins** 也是在 `package.json` 中的插件，不过是在 `vuePlugins` 字段中，该类插件是针对于只需要在项目里直接访问插件 API 而不需要创建一个完整的插件。


### CLI 模式

CLI 模式是 vue cli 中一个重要的概念，[详细介绍](https://cli.vuejs.org/zh/guide/mode-and-env.html#%E6%A8%A1%E5%BC%8F)可点击查看官方
文档，在解析完插件之后就为每种插件命令指定模式，插件命令的模式可以 通过 `module.exports.defaultModes 以 { [commandName]: mode }` 的形式来暴露：

```js
module.exports = api => {
  api.registerCommand('build', () => {
    // ...
  })
}

module.exports.defaultModes = {
  build: 'production'
}
```

解析命令模式利用 js 内建函数 `reduce` 实现:

```js
this.modes = this.plugins.reduce((modes, { apply: { defaultModes }}) => {
  return Object.assign(modes, defaultModes)
}, {})
```

这一节大致介绍了 `new Service` 的过程，在下一节将介绍 `Service` 实例的 `run` 方法。
