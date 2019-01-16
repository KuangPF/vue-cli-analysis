# vue-cli-service build

 `vue-cli-service build` 会在 `dist/` 目录产生一个可用于生产环境的包，带有 JS/CSS/HTML 的压缩，和为更好的缓存而做的自动的 vendor chunk splitting。
它的 chunk manifest 会内联在 HTML 里。

相比 vue-cli 2.x 版本而言，vue-cli 3.0 在构建生产环境包的时候拥有更多的选择，执行 `vue-cli-service build --help` 可查看参数：

```
--mode              指定环境模式 (默认值：production)
--dest              指定输出目录 (默认值：dist)
--modern            面向现代浏览器带自动回退地构建应用
--no-unsafe-inline  不以 inline 方式引入 script （针对 Safari 10 中 <script nomodule> 的修复）
--target            app | lib | wc | wc-async (默认值：app)
--formats           构建目标为库的时候指定输出格式默认为 commonjs,umd,umd-min
--name              库或 Web Components 模式下的名字 (默认值：package.json 中的 "name" 字段或入口文件名)
--no-clean          在构建项目之前不清除目标目录
--report            生成 report.html 以帮助分析包内容
--report-json       生成 report.json 以帮助分析包内容
--watch             监听文件变化
```
其中[构建目标](https://cli.vuejs.org/zh/guide/build-targets.html)和[现代模式](https://cli.vuejs.org/zh/guide/browser-compatibility.html#%E7%8E%B0%E4%BB%A3%E6%A8%A1%E5%BC%8F)
很有意思，官方文档对这两个参数做了详细的介绍，这里就先不重复描述了。`build` 命令的运行流程和 `serve` 命令类似，都会先获取 webpack 的配置，然后进行 webpack 构建，下面就简单看下源码。


执行 build 命令最终执行的是 build 对应的服务，源码如下：

```js
async (args) => {
  for (const key in defaults) {
    if (args[key] == null) {
      args[key] = defaults[key]
    }
  }
  args.entry = args.entry || args._[0] // 构建一个库的入口文件，默认为 src/App.vue
  if (args.target !== 'app') {
    args.entry = args.entry || 'src/App.vue'
  }
  process.env.VUE_CLI_BUILD_TARGET = args.target
  if (args.modern && args.target === 'app') { // 现代模式
    process.env.VUE_CLI_MODERN_MODE = true
    delete process.env.VUE_CLI_MODERN_BUILD
    await build(Object.assign({}, args, { // 支持旧浏览器
      modernBuild: false,
      keepAlive: true
    }), api, options)

    process.env.VUE_CLI_MODERN_BUILD = true
    await build(Object.assign({}, args, { // 支持现代浏览器
      modernBuild: true,
      clean: false
    }), api, options)

    delete process.env.VUE_CLI_MODERN_MODE
    delete process.env.VUE_CLI_MODERN_BUILD
  } else {
    if (args.modern) {
      const { warn } = require('@vue/cli-shared-utils')
      warn(
        `Modern mode only works with default target (app). ` +
        `For libraries or web components, use the browserslist ` +
        `config to specify target browsers.`
      )
    }
    await build(args, api, options)
  }
  delete process.env.VUE_CLI_BUILD_TARGET
}
```
这段代码应该比较好理解，主要是对构建目标为 `app` 并且使用了`modern` 参数的情形做了一些处理，然后调用了 `build` 函数。另外还需注意的一点就是在这里对一些环境变量进行了赋值，比如：
`VUE_CLI_BUILD_TARGET`,`VUE_CLI_MODERN_MODE`,`VUE_CLI_MODERN_BUILD`，这些在使用内置配置插件进行解析 webpack 配置时很有用。接着看 build 函数，
主要代码如下：

```js
if (args.target === 'app') { // 构建目标 app
  const bundleTag = args.modern // 现代版本还是旧浏览器版本
    ? args.modernBuild
      ? `modern bundle `
      : `legacy bundle `
    : ``
  logWithSpinner(`Building ${bundleTag}for ${mode}...`)
} else { // 获取构建目标 lib || wc || wc-async
  const buildMode = buildModes[args.target]
  if (buildMode) {
    // 不同的构建版本 myLib.common.js，myLib.umd.js，myLib.umd.min.js
    const additionalParams = buildMode === 'library' ? ` (${args.formats})` : ``
    logWithSpinner(`Building for ${mode} as ${buildMode}${additionalParams}...`)
  } else {
    throw new Error(`Unknown build target: ${args.target}`)
  }
}

// some code ...
// resolve raw webpack config
let webpackConfig
if (args.target === 'lib') { // 加载构建目标为 lib 的 webpack 配置
  webpackConfig = require('./resolveLibConfig')(api, args, options)
} else if ( // 加载构建目标为 wc || wc-async 的 webpack 配置
  args.target === 'wc' ||
  args.target === 'wc-async'
) {
  webpackConfig = require('./resolveWcConfig')(api, args, options)
} else { // 默认的应用构建目标
  webpackConfig = require('./resolveAppConfig')(api, args, options)
}
// check for common config errors
validateWebpackConfig(webpackConfig, api, options, args.target)

// some code ...
if (args.dest) { // 指定输出目录 (默认值：dist)，args.dest 有更高的优先级
  modifyConfig(webpackConfig, config => {
    config.output.path = targetDir
  })
}

// some code ...

return new Promise((resolve, reject) => {
  webpack(webpackConfig, (err, stats) => {
    // some code ...
  })
}
```
归纳一下，大致可以分为以下4个部分来分析：

* build 信息处理
* 解析 webpack 配置
* 打包参数处理
* webpack 打包


## build 信息处理
这一部分其实没什么说的，主要就是将一些 build 的信息通过 [ora](https://github.com/sindresorhus/ora) 配置 [chalk](https://github.com/chalk/chalk)
文字显示，如下图：

<img :src="$withBase('/assets/vue-cli-service-build-img01.gif')">
<img :src="$withBase('/assets/vue-cli-service-build-img02.gif')">


## 解析 webpack 配置

解析 webpack 配置是 build 命令比较核心的部分了，相比 serve 命令来说，build 除了调用实例 `resolveWebpackConfig` 获取 webpack 配置外，还会
根据构建目标 target 的不同修改 webpack 配置，其中内置的 `config/prod.js` 和 `config/app.js` 根据不同的环境变量进行 webpack 配置的注入，前者
通过 `process.env.NODE_ENV === 'production'` 判断，后者通过 `process.env.VUE_CLI_BUILD_TARGET` 判断。
下面以构建目标为 lib 为例，简单分析下是如何解析 webpack 配置的，解析 webpack 配置的代码如下：

```js
if (args.target === 'lib') { // 加载构建目标为 lib 的 webpack 配置
  webpackConfig = require('./resolveLibConfig')(api, args, options)
} 
```
然后继续看下 `resolveLibConfig` 文件:

```js
module.exports = (api, { entry, name, formats }, options) => {
  const { log, error } = require('@vue/cli-shared-utils')
  const abort = msg => {
    log()
    error(msg)
    process.exit(1)
  }
  
  const fullEntryPath = api.resolve(entry)
  
  if (!fs.existsSync(fullEntryPath)) {
    abort(
      `Failed to resolve lib entry: ${entry}${entry === `src/App.vue` ? ' (default)' : ''}. ` +
      `Make sure to specify the correct entry file.`
    )
  }
  
  const isVueEntry = /\.vue$/.test(entry)
  const libName = (
    name ||
    api.service.pkg.name ||
    path.basename(entry).replace(/\.(jsx?|vue)$/, '')
  )
  
  function genConfig (format, postfix = format, genHTML) {
    // some code ...
  }
  
  const configMap = {
    commonjs: genConfig('commonjs2', 'common'),
    umd: genConfig('umd', undefined, true),
    'umd-min': genConfig('umd', 'umd.min')
  }
  
  const formatArray = (formats + '').split(',')
  const configs = formatArray.map(format => configMap[format])
  if (configs.indexOf(undefined) !== -1) {
    const unknownFormats = formatArray.filter(f => configMap[f] === undefined).join(', ')
    abort(
      `Unknown library build formats: ${unknownFormats}`
    )
  }
  
  return configs
}
```
从代码中可以看出，会先获取入口文件地址，并判断是否存在，然后获取 lib 的名称，然后接下来就是调用核心方法 `genConfig` 返回 webpack 配置。

```js
function genConfig (format, postfix = format, genHTML) {
  const config = api.resolveChainableWebpackConfig()

  // adjust css output name so they write to the same file
  if (config.plugins.has('extract-css')) {
    config
      .plugin('extract-css')
        .tap(args => {
          args[0].filename = `${libName}.css`
          return args
        })
  }

  // only minify min entry
  if (!/\.min/.test(postfix)) {
    config.optimization.minimize(false)
  }

  // externalize Vue in case user imports it
  config
    .externals({
      ...config.get('externals'),
      vue: {
        commonjs: 'vue',
        commonjs2: 'vue',
        root: 'Vue'
      }
    })

  // inject demo page for umd
  if (genHTML) {
    const template = isVueEntry ? 'demo-lib.html' : 'demo-lib-js.html'
    config
      .plugin('demo-html')
        .use(require('html-webpack-plugin'), [{
          template: path.resolve(__dirname, template),
          inject: false,
          filename: 'demo.html',
          libName
        }])
  }

  // resolve entry/output
  const entryName = `${libName}.${postfix}`
  config.resolve
    .alias
      .set('~entry', fullEntryPath)

  // set output target before user configureWebpack hooks are applied
  config.output.libraryTarget(format)

  // set entry/output after user configureWebpack hooks are applied
  const rawConfig = api.resolveWebpackConfig(config)

  let realEntry = require.resolve('./entry-lib.js')

  // avoid importing default if user entry file does not have default export
  if (!isVueEntry) {
    const entryContent = fs.readFileSync(fullEntryPath, 'utf-8')
    if (!/\b(export\s+default|export\s{[^}]+as\s+default)\b/.test(entryContent)) {
      realEntry = require.resolve('./entry-lib-no-default.js')
    }
  }

  rawConfig.entry = {
    [entryName]: realEntry
  }

  rawConfig.output = Object.assign(
    // some code ...
  )

  return rawConfig
}
```
`genConfig` 函数先是通过 `api.resolveChainableWebpackConfig` 获取了 `webpack-chain` 形式的 webpack 配置，然后进行以下修改：

* 修改输出 css 的名称
* 针对于 umd-min 形式进行压缩
* 对 Vue 进行外部扩展，[webpack 外部扩展](https://webpack.docschina.org/configuration/externals/)

在此之后就调用 `api.resolveWebpackConfig` 将 `webpack-chain` 形式的配置与 `raw` 式的配置进行合并，并对 output 选项进行一些修改，返回最终的 
webpack 配置。

有点需要注意的就是这里返回的 configs 为一个数组，因为当构建目标为 lib 时默认会输出 common.js，umd.js，umd.min.js 三种形式的包，因此
传入一个数组的 webpack 配置就会分别执行三次不同的构建，当然也可以通过 `--formats` 参数来指定输出哪些格式的包，比如执行下面命令：

```bash
vue-cli-service build --target lib --formats commonjs,umd
```
此时就只会输出 common.js 和 umd.js 。


## 打包参数处理

打包参数处理比较容易，根据 args 来进行对应的配置，比如根据参数 `dest` 来配置输出目录，参数 `watch` 判断是否需要监听文件变化，参数 `report` 
判断是否需要生成包的分析内容等等。

## webpack 打包

这部分就是传入 webpack 配置进行构建，并输出一些打包信息。

```js
return new Promise((resolve, reject) => {
  webpack(webpackConfig, (err, stats) => {
    stopSpinner(false)
    if (err) {
      return reject(err)
    }

    if (stats.hasErrors()) {
      return reject(`Build failed with errors.`)
    }

    if (!args.silent) {
      const targetDirShort = path.relative(
        api.service.context,
        targetDir
      )
      log(formatStats(stats, targetDirShort, api))
      if (args.target === 'app' && !isLegacyBuild) {
        if (!args.watch) {
          done(`Build complete. The ${chalk.cyan(targetDirShort)} directory is ready to be deployed.`)
          info(`Check out deployment instructions at ${chalk.cyan(`https://cli.vuejs.org/guide/deployment.html`)}\n`)
        } else {
          done(`Build complete. Watching for changes...`)
        }
      }
    }

    // test-only signal
    if (process.env.VUE_CLI_TEST) {
      console.log('Build complete.')
    }

    resolve()
  })
})
```

`vue-cli-service build` 命令的分析就到这里了，通过对 `serve` 和 `build` 命令简单分析，应该整体上对 `vue-cli-service` 有了一定的感受，与
 `vue-cli 2.x` 相比，`vue-cli 3.0` 的 webpack 配置都由` @vue/cli-service` 收敛到了内部完成。


