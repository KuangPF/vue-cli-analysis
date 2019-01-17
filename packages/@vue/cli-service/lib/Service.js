const fs = require('fs')
const path = require('path')
const debug = require('debug')
const chalk = require('chalk')
const readPkg = require('read-pkg')
const merge = require('webpack-merge')
const Config = require('webpack-chain')
const PluginAPI = require('./PluginAPI')
const loadEnv = require('./util/loadEnv')
const defaultsDeep = require('lodash.defaultsdeep')
const { warn, error, isPlugin, loadModule } = require('@vue/cli-shared-utils')

const { defaults, validate } = require('./options')

module.exports = class Service {
  constructor (context, { plugins, pkg, inlineOptions, useBuiltIn } = {}) {
    process.VUE_CLI_SERVICE = this
    this.initialized = false
    this.context = context
    this.inlineOptions = inlineOptions
    this.webpackChainFns = []
    this.webpackRawConfigFns = []
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

  resolvePkg (inlinePkg, context = this.context) {
    if (inlinePkg) {
      return inlinePkg
    } else if (fs.existsSync(path.join(context, 'package.json'))) {
      const pkg = readPkg.sync({ cwd: context })
      if (pkg.vuePlugins && pkg.vuePlugins.resolveFrom) {
        this.pkgContext = path.resolve(context, pkg.vuePlugins.resolveFrom)
        return this.resolvePkg(null, this.pkgContext)
      }
      return pkg
    } else {
      return {}
    }
  }

  init (mode = process.env.VUE_CLI_MODE) {
    if (this.initialized) {
      return
    }
    this.initialized = true
    this.mode = mode

    // load mode .env
    // 加载指定的模式环境文件
    if (mode) {
      this.loadEnv(mode)
    }
    // load base .env
    // 加载普通环境文件
    this.loadEnv()

    // load user config
    // 加载 vue.config.js || package.vue
    const userOptions = this.loadUserOptions()

    // lodash.defaultsdeep
    // 分配来源对象的可枚举属性到目标对象所有解析为 undefined 的属性上。 来源对象从左到右应用。 一旦设置了相同属性的值，后续的将被忽略掉，该方法会改变原对象。
    this.projectOptions = defaultsDeep(userOptions, defaults())
    debug('vue:project-config')(this.projectOptions)

    // apply plugins.
    this.plugins.forEach(({ id, apply }) => {
      // service 插件接受两个参数，一个 PluginAPI 实例，一个包含 vue.config.js 内指定的项目本地选项的对象，或者在 package.json 内的 vue 字段。
      apply(new PluginAPI(id, this), this.projectOptions)
    })
    // apply webpack configs from project config file
    if (this.projectOptions.chainWebpack) {
      this.webpackChainFns.push(this.projectOptions.chainWebpack)
    }
    if (this.projectOptions.configureWebpack) {
      this.webpackRawConfigFns.push(this.projectOptions.configureWebpack)
    }
  }

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
    if (!command || args.help) { // vue-cli-service || vue-cli-service --help
      command = this.commands.help
    } else {
      args._.shift() // remove command itself
      rawArgv.shift()
    }
    const { fn } = command
    return fn(args, rawArgv)
  }

  resolveChainableWebpackConfig () {
    const chainableConfig = new Config()
    // apply chains
    this.webpackChainFns.forEach(fn => fn(chainableConfig))
    return chainableConfig
  }

  // 解析 webpack 配置
  resolveWebpackConfig (chainableConfig = this.resolveChainableWebpackConfig()) {
    if (!this.initialized) {
      throw new Error('Service must call init() before calling resolveWebpackConfig().')
    }
    // get raw config
    // './config/base', './config/css', './config/dev', './config/prod', './config/app' 这 5 个内置插件的主要作用
    // 就是完成 webpack 本地编译构建时的各种相关的配置，注意下这几个插件的顺序，因为他们都是利用 api.chainWebpack 进行 webpack 配置的，
    // 而配置又是可以覆盖的，因此如果拥有相同的配置，后面加载的插件的配置会覆盖前面的，但优先级最高的还是项目配置中的 webpack 配置，即
    // vue.config.js 或者 package.vue 中的 webpack 配置是最后解析的。
    let config = chainableConfig.toConfig() // 导出 webpack 配置对象

    const original = config
    // apply raw config fns
    // raw 式配置，传入 webpackChain 的配置
    this.webpackRawConfigFns.forEach(fn => {
      if (typeof fn === 'function') {
        // function with optional return value
        const res = fn(config)
        if (res) config = merge(config, res)
      } else if (fn) {
        // merge literal values
        config = merge(config, fn)
      }
    })

    // #2206 If config is merged by merge-webpack, it discards the __ruleNames
    // information injected by webpack-chain. Restore the info so that
    // vue inspect works properly.
    if (config !== original) {
      cloneRuleNames(
        config.module && config.module.rules,
        original.module && original.module.rules
      )
    }

    // check if the user has manually mutated output.publicPath
    const target = process.env.VUE_CLI_BUILD_TARGET
    if (
      !process.env.VUE_CLI_TEST &&
      (target && target !== 'app') &&
      config.output.publicPath !== this.projectOptions.baseUrl
    ) {
      throw new Error(
        `Do not modify webpack output.publicPath directly. ` +
        `Use the "baseUrl" option in vue.config.js instead.`
      )
    }

    return config
  }

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
}

function ensureSlash (config, key) {
  let val = config[key]
  if (typeof val === 'string') {
    if (!/^https?:/.test(val)) {
      val = val.replace(/^([^/.])/, '/$1')
    }
    config[key] = val.replace(/([^/])$/, '$1/')
  }
}

function removeSlash (config, key) {
  if (typeof config[key] === 'string') {
    config[key] = config[key].replace(/\/$/g, '')
  }
}

function cloneRuleNames (to, from) {
  if (!to || !from) {
    return
  }
  from.forEach((r, i) => {
    if (to[i]) {
      Object.defineProperty(to[i], '__ruleNames', {
        value: r.__ruleNames
      })
      cloneRuleNames(to[i].oneOf, r.oneOf)
    }
  })
}
