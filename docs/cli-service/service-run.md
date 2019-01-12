# service.run()

还是老规矩，把 `run` 的源码贴出来看看：

```js
async run (name, args = {}, rawArgv = []) {
  // 命令指定模式
  // resolve mode
  // prioritize inline --mode
  // fallback to resolved default modes from plugins or development if --watch is defined
  const mode = args.mode || (name === 'build' && args.watch ? 'development' : this.modes[name])

  // load env variables, load user config, apply plugins
  // 加载本地环境变量，vue.config.js || package.vue， 执行所有被加载的插件
  this.init(mode)
  args._ = args._ || []
  let command = this.commands[name] // 加载插件时注册了 command，api.registerCommand
  if (!command && name) { // 非法命令
    error(`command "${name}" does not exist.`)
    process.exit(1)
  }
  console.log(args)
  if (!command || args.help || args.h) { // vue-cli-service || vue-cli-service -h
    console.log('ssssss')
    command = this.commands.help
  } else {
    args._.shift() // remove command itself
    rawArgv.shift()
  }
  const { fn } = command
  return fn(args, rawArgv)
}
```
::: tip
每次贴代码的时候都会发现，代码不会很长，因为在 vue-cli 3.0 中，很多功能都会被模块化，而且会将一个大的功能拆分成多个小的功能进行实现，这样提高了代码
的可读性并且也利于代码的维护，这种编程方式十分值得学习。
:::

`run` 方法开始会获取该命令所对应的模式值，然后调用实例的 `init` 方法，`init` 主要有三个功能：
* **加载对应模式下本地的环境变量文件**
* **解析 vue.config.js 或者 package.vue**
* **执行所有被加载的插件**


## loadEnv
那么继续看下 `init` 方法代码中加载环境变量文件的代码：

```js
// load mode .env
// 加载指定的模式环境文件
if (mode) {
  this.loadEnv(mode)
}
// load base .env
// 加载普通环境文件
this.loadEnv()

```
`init` 执行了两次实例的 `loadEnv` 函数，第一次是加载指定的模式环境文件`（.env.development, .env.development.local）`，第二次执行是加载普通环境文件
`(.env, .env.local)`，看一下实例 `loadEnv` 函数代码：

```js
// 加载本地的环境文件，环境文件的作用就是设置某个模式下特有的环境变量
// 加载环境变量其实要注意的就是优先级的问题，下面的代码已经体现的非常明显了，先加载 .env.mode.local，然后加载 .env.mode 最后再加载 .env
// 由于环境变量不会被覆盖，因此 .env.mode.local 的优先级最高，.env.mode.local 与 .env.mode 的区别就是前者会被 git 忽略掉。另外一点要
// 注意的就是环境文件不会覆盖Vue CLI 启动时已经存在的环境变量。
loadEnv (mode) {
  const logger = debug('vue:env')
  // path/.env.production || path/.env.development || ...
  const basePath = path.resolve(this.context, `.env${mode ? `.${mode}` : ``}`)
  const localPath = `${basePath}.local` // path/.env.local.production
  const load = path => {
    try {
      const res = loadEnv(path)
      logger(path, res)
    } catch (err) {
      // only ignore error if file is not found
      if (err.toString().indexOf('ENOENT') < 0) {
        error(err)
      }
    }
  }

  load(localPath)
  load(basePath)
  // by default, NODE_ENV and BABEL_ENV are set to "development" unless mode
  // is production or test. However the value in .env files will take higher
  // priority.
  if (mode) {
    // always set NODE_ENV during tests
    // as that is necessary for tests to not be affected by each other
    const shouldForceDefaultEnv = (
      process.env.VUE_CLI_TEST &&
      !process.env.VUE_CLI_TEST_TESTING_ENV
    )
    const defaultNodeEnv = (mode === 'production' || mode === 'test')
      ? mode
      : 'development'
    if (shouldForceDefaultEnv || process.env.NODE_ENV == null) {
      process.env.NODE_ENV = defaultNodeEnv
    }
    if (shouldForceDefaultEnv || process.env.BABEL_ENV == null) {
      process.env.BABEL_ENV = defaultNodeEnv
    }
  }
}
```
通过代码可以直观的看出来，先加载 `localPath` ，然后再加载 `basePath`，load 函数主要执行了 `util/loadEnv.js` 它的作用就是向 `node process` 
中添加环境变量，核心代码如下：
```js
// Vue CLI 启动时已经存在的环境变量拥有最高优先级，并不会被 .env 文件覆写
if (typeof process.env[key] === 'undefined') {
  process.env[key] = config[key]
}
```
看着这段源码应该就很容易明白官方文档对环境加载属性的相关提示了：

::: tip 环境加载属性
为一个特定模式准备的环境文件的 (例如 `.env.production`) 将会比一般的环境文件 (例如 `.env`) 拥有更高的优先级。

此外，Vue CLI 启动时已经存在的环境变量拥有最高优先级，并不会被 `.env` 文件覆写。
:::


## loadUserOptions

加载完环境变量文件后，接着就是解析项目的配置文件了，项目的配置文件主要存放在两个地方：`vue.config.js` 和 `package.vue` 中，当然也可以在
 `new Service` 的时候传入 `inlineOptions`。

```js
loadUserOptions () {
  // vue.config.js
  let fileConfig, pkgConfig, resolved, resolvedFrom
  const configPath = (
    process.env.VUE_CLI_SERVICE_CONFIG_PATH ||
    path.resolve(this.context, 'vue.config.js')
  )
  // 加载 vue.config.js
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = require(configPath)
      if (!fileConfig || typeof fileConfig !== 'object') {
        error(
          `Error loading ${chalk.bold('vue.config.js')}: should export an object.`
        )
        fileConfig = null
      }
    } catch (e) {
      error(`Error loading ${chalk.bold('vue.config.js')}:`)
      throw e
    }
  }

  // package.vue
  // package.json 里面的 vue config
  pkgConfig = this.pkg.vue
  if (pkgConfig && typeof pkgConfig !== 'object') {
    error(
      `Error loading vue-cli config in ${chalk.bold(`package.json`)}: ` +
      `the "vue" field should be an object.`
    )
    pkgConfig = null
  }

  if (fileConfig) { // 既有 vue.config.js 而且在 package.json 里面又包含了 vue 的配置，将会取 vue.config.js 的配置
    if (pkgConfig) {
      warn(
        `"vue" field in package.json ignored ` +
        `due to presence of ${chalk.bold('vue.config.js')}.`
      )
      warn(
        `You should migrate it into ${chalk.bold('vue.config.js')} ` +
        `and remove it from package.json.`
      )
    }
    resolved = fileConfig
    resolvedFrom = 'vue.config.js'
  } else if (pkgConfig) {
    resolved = pkgConfig
    resolvedFrom = '"vue" field in package.json'
  } else {
    resolved = this.inlineOptions || {}
    resolvedFrom = 'inline options'
  }

  // normalize some options
  ensureSlash(resolved, 'baseUrl')
  if (typeof resolved.baseUrl === 'string') {
    resolved.baseUrl = resolved.baseUrl.replace(/^\.\//, '')
  }
  removeSlash(resolved, 'outputDir')

  // deprecation warning
  // TODO remove in final release
  if (resolved.css && resolved.css.localIdentName) {
    warn(
      `css.localIdentName has been deprecated. ` +
      `All css-loader options (except "modules") are now supported via css.loaderOptions.css.`
    )
  }

  // validate options
  validate(resolved, msg => {
    error(
      `Invalid options in ${chalk.bold(resolvedFrom)}: ${msg}`
    )
  })

  return resolved
}
```
这段代码写的很清楚了，首先会加载项目中 `vue.config.js`，然后会加载 `package.json` 中的 vue 字段中的配置信息。如果既有 `vue.config.js` 而且在 
`package.json` 里面又包含了 `vue` 的配置，将会取 `vue.config.js` 的配置，如果两者都没有配置信息的话会取 `this.inlineOptions || {}`，
在获取到配置以后还会进行一些处理和验证，最后返回配置 `resolved` 。


## apply plugins

在加载了环境变量文件和项目配置信息后，接下来就开始加载插件了，核心代码如下：

```js
this.plugins.forEach(({ id, apply }) => {
  // service 插件接受两个参数，一个 PluginAPI 实例，一个包含 vue.config.js 内指定的项目本地选项的对象，或者在 package.json 内的 vue 字段。
  apply(new PluginAPI(id, this), this.projectOptions)
})
```
其实就是执行 `service` 函数的导出函数，它接受两个参数，
* 一个 `PluginAPI` 实例
* 一个包含 `vue.config.js` 内指定的项目本地选项的对象，或者在 package.json 内的 vue 字段

我们主要看下 `PluginAPI` 类，`PluginAPI` 核心代码如下：

```js
class PluginAPI {
  /**
   * Current working directory.
   */
  getCwd () {
    return this.service.context
  }
  resolve (_path) {
    return path.resolve(this.service.context, _path)
  }
  hasPlugin (id) {
    if (id === 'router') id = 'vue-router'
    if (['vue-router', 'vuex'].includes(id)) {
      const pkg = this.service.pkg
      return ((pkg.dependencies && pkg.dependencies[id]) || (pkg.devDependencies && pkg.devDependencies[id]))
    }
    return this.service.plugins.some(p => matchesPluginId(id, p.id))
  }
  registerCommand (name, opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = null
    }
    this.service.commands[name] = { fn, opts: opts || {}}
  }
  chainWebpack (fn) {
    this.service.webpackChainFns.push(fn)
  }
  configureWebpack (fn) {
    this.service.webpackRawConfigFns.push(fn)
  }
  configureDevServer (fn) {
    this.service.devServerConfigFns.push(fn)
  }
  resolveWebpackConfig (chainableConfig) {
    return this.service.resolveWebpackConfig(chainableConfig)
  }
  resolveChainableWebpackConfig () {
    return this.service.resolveChainableWebpackConfig()
  }
  genCacheConfig (id, partialIdentifier, configFiles) {
    const fs = require('fs')
    const cacheDirectory = this.resolve(`node_modules/.cache/${id}`)

    const variables = {
      partialIdentifier,
      'cli-service': require('../package.json').version,
      'cache-loader': require('cache-loader/package.json').version,
      env: process.env.NODE_ENV,
      test: !!process.env.VUE_CLI_TEST,
      config: [
        this.service.projectOptions.chainWebpack,
        this.service.projectOptions.configureWebpack
      ]
    }
  }
}
```
简单介绍一些 `PluginAPI` 的方法：

* **registerCommand**: 注册 cli 命令服务
* **chainWebpack**: 通过 webpack-chain 修改 webpack 配置
* **configureWebpack**: 通过 webpack-merge 对 webpack 配置进行合并
* **resolveWebpackConfig**: 调用之前通过 chainWebpack 和 configureWebpack 上完成的对于 webpack 配置的改造，并返回最终的 webpack 配置
* **genCacheConfig**: 返回 `cacheDirectory, cacheIdentifier`
* ...

以 `@vue/cli-service/lib/commands/serve.js` 为例

```js
module.exports = (api, options) => {
  api.registerCommand('serve', {
    description: 'start development server',
    usage: 'vue-cli-service serve [options] [entry]',
    options: {
      '--open': `open browser on server start`,
      '--copy': `copy url to clipboard on server start`,
      '--mode': `specify env mode (default: development)`,
      '--host': `specify host (default: ${defaults.host})`,
      '--port': `specify port (default: ${defaults.port})`,
      '--https': `use https (default: ${defaults.https})`,
      '--public': `specify the public network URL for the HMR client`
    }
  }, async function serve (args) {
   // resolveWebpackConfig
   // create server
   // ....
  })
}
```
利用 `api.registerCommand` 注册了 `serve` 命名，并将 `serve` 命令的处理函数挂载到 `Service` 实例的 `serve` 命令中，当然你还可以通过
`module.exports.defaultModes 以 { [commandName]: mode }` 的形式来指定命令的运行模式。

分析到这里你应该逐渐熟悉 `vue-cli 3.0` 的插件机制了，`vue-cli 3.0` 将所有的工作都交给插件去执行，开发模式执行内置 `serve` 插件，打包执行内置
 `build` 插件，检查代码规范由 `@vue/cli-plugin-eslint` 插件完成。

在加载完所有的插件以后，实例的 `init` 方法在最后会读取项目配置中的 `webpack` 配置信息，即 `chainWebpack` 和 `configureWebpack`，代码如下：

```js
// apply webpack configs from project config file
if (this.projectOptions.chainWebpack) {
  this.webpackChainFns.push(this.projectOptions.chainWebpack)
}
if (this.projectOptions.configureWebpack) {
  this.webpackRawConfigFns.push(this.projectOptions.configureWebpack)
}
```

在实例的 run 函数中执行了实例 init 函数对 Service 实例的属性进行初始化，然后就会解析 CLI 命令，看代码：

```js
...
args._ = args._ || []
let command = this.commands[name] // 加载插件时注册了 command，api.registerCommand
if (!command && name) { // 非法命令
  error(`command "${name}" does not exist.`)
  process.exit(1)
}
if (!command || args.help) { // vue-cli-service || vue-cli-service -h
  command = this.commands.help
} else {
  args._.shift() // remove command itself
  rawArgv.shift()
}
const { fn } = command
return fn(args, rawArgv)
```
会先对 CLI 命令进行一个判断，主要有一下三种情况：

* 输入了命令 `name` ，但是并没有通过 `api.registerCommand` 注册，即非法命令，`process.exit(1)`
* 直接输入了 `vue-cli-service` 或者 `vue-cli-service --help`，加载内置 `help` 插件
* 正常输入，eg: `vue-cli-service test:unit`，这种情况会加载对应地单元测试插件 `@vue/cli-plugin-unit-jest` ||` @vue/cli-plugin-unit-mocha`


## 总结

执行 `Service` 实例的 `run` 方法主要执行了环境变量文件加载，获取项目配置信息，合并项目配置，加载插件，加载项目配置中的 webpack 信息，最后
执行 CLI 服务，整个思路还是很清晰，接下来会对 `vue-cli-service serve` 等命令进行简单地分析介绍。









