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
