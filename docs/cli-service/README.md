# @vue/cli-service

在分析 `@vue/cli-service` 之前，首先要明白它是干什么的，简单来说 `@vue/cli-service` 提供了本地开发构建服务。比如执行 `npm run serve`，对应执行的
命令是 `vue-cli-service serve`，该命令的用于构建一个开发服务，类似与在 `vue-cli 2.X` 中执行 `npm run dev` 加载 `build/webpack.dev.conf.js`。
在 `vue-cli 3.0` 中将 `webpack` 及相关插件提供的功能都收敛到 `@vue/cli-service` 内部来实现，下面就开始分析 `@vue/cli-service` 是如何实现插件系统的。


## 入口

`vue-cli-service` m命令的入口在 `@vue/cli-service/bin/vue-service-service.js` 中，代码如下：

```js
#!/usr/bin/env node

const semver = require('semver')
const { error } = require('@vue/cli-shared-utils')
const requiredVersion = require('../package.json').engines.node

/* 检查 node 版本*/
if (!semver.satisfies(process.version, requiredVersion)) {
  error(
    `You are using Node ${process.version}, but vue-cli-service ` +
    `requires Node ${requiredVersion}.\nPlease upgrade your Node version.`
  )
  process.exit(1)
}

// @vue/cli-service 并没有直接提供 serve， build 以及 inspect 等命令相关的服务， 而是动态注册内置服务和插件服务
const Service = require('../lib/Service') // 核心的 Service.js
// 初始化一个 Service 实例
const service = new Service(process.env.VUE_CLI_CONTEXT || process.cwd())

const rawArgv = process.argv.slice(2)
console.log(process.argv)
// vue-cli-service serve --https
// 在 boolean 选项当中的参数会被解析成 true 或者 false
const args = require('minimist')(rawArgv, {
  boolean: [
    // build
    'modern',
    'report',
    'report-json',
    'watch',
    // serve
    'open',
    'copy',
    'https',
    // inspect
    'verbose'
  ]
})

const command = args._[0] // vue-cli-service build

service.run(command, args, rawArgv).catch(err => {
  error(err)
  process.exit(1)
})

```
代码看着非常简洁，与一般 `node` 命令文件有点不同，第一就是并没有依赖 `commander.js`，第二就是并没有直接提供相关 CLI 命令的服务。
在 `@vue/vue-cli-service` 中，对于第一点是通过 Service 这个类来处理 `node` 命令，而对于第二点，所有的 CLI 服务都是动态注册的。从上面这段代码可以
看出，执行 CLI 命令后，主要有有两个操作：实例化 `Service` 和调用实例的 `run` 方法。

## new Service

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

**inlinePlugins** 指的是直接在实例化 `Service` 时传入，具体使用的作用还不是很清楚，有大佬知道的话不如来个 PR。

**package.json 插件** 指的是 `devDependencies` 和 `dependencies` 中的 vue 插件，比如 `@vue/cli-plugin-eslint`

**package.vuePlugins** 也是在 `package.json` 中的插件，不过是在 `vuePlugins` 字段中，该类插件是针对于只需要在项目里直接访问插件 API 而不需要创建一个完整的插件。


### CLI 模式

CLI 模式是 vue cli 中一个重要的概念，[详细介绍](https://cli.vuejs.org/zh/guide/mode-and-env.html#%E6%A8%A1%E5%BC%8F)可点击查看官方
文档。在解析完插件之后就为每种插件命令



