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
很有意思，官方文档对这两个参数做了详细的介绍，这里就先不重复描述了。`build` 命令的运行流程和 `serve` 命令类似，都会先获取 webpack 的配置，然后进行打包，
下面就简单看下源码。


执行 build 命令最后会执行 build 对应的服务，源码如下：

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
归纳以下，大致可以分为以下4个部分来分析：

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























