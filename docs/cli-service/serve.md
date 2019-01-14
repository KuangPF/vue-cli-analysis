# vue-cli-service serve

`vue-cli-service serve` 命令主要用于在开发阶段构建项目，包括热加载这一套，下面开始简单分析下整个代码。通过前面对 `@vue/cli-service` 的整体分析，
可以发现，`vue-cli-service` 所有的 CLI 命令服务都是动态注册的，包括环境变量文件加载，获取项目配置信息，合并项目配置，加载插件等等，最后执行对应 CLI
命令服务，即 `Service` 实例 `run` 方法的最后行代码：
```js
async run (name, args = {}, rawArgv = []) {
  // some code ...
  const { fn } = command
  return fn(args, rawArgv)
}
```
处理 `serve` 命令的函数是在插件调用 `api.registerCommand (name, opts, fn)` 时注入的，主要代码如下：

```js
async function serve (args) {
  info('Starting development server...')
  // some code ...
  // resolve webpack config
  const webpackConfig = api.resolveWebpackConfig()
  // check for common config errors
  validateWebpackConfig(webpackConfig, api, options)
  // load user devServer options with higher priority than devServer
  // in webpck config
  const projectDevServerOptions = Object.assign(
    webpackConfig.devServer || {},
    options.devServer
  )

  // resolve server options
  // 解析 server 选项
  const useHttps = args.https || projectDevServerOptions.https || defaults.https
  const protocol = useHttps ? 'https' : 'http'
  const host = args.host || process.env.HOST || projectDevServerOptions.host || defaults.host
  // some code ...
  
  // inject dev & hot-reload middleware entries
  // webpack-dev-server 以 Node.js Api 方式配置
  if (!isProduction) {
    const sockjsUrl = publicUrl
      // explicitly configured via devServer.public
      ? `?${publicUrl}/sockjs-node`
      : isInContainer
        // can't infer public netowrk url if inside a container...
        // use client-side inference (note this would break with non-root baseUrl)
        ? ``
        // otherwise infer the url
        : `?` + url.format({
          protocol,
          port,
          hostname: urls.lanUrlForConfig || 'localhost',
          pathname: '/sockjs-node'
        })
    const devClients = [
      // dev server client
      require.resolve(`webpack-dev-server/client`) + sockjsUrl,
      // hmr client
      require.resolve(projectDevServerOptions.hotOnly
        ? 'webpack/hot/only-dev-server'
        : 'webpack/hot/dev-server')
      // TODO custom overlay client
      // `@vue/cli-overlay/dist/client`
    ]
    if (process.env.APPVEYOR) {
      devClients.push(`webpack/hot/poll?500`)
    }
    // inject dev/hot client
    // webpack-dev-server inline 模式，以 Node.js Api方式配置，则需要将 webpack-dev-server 客户端配置到 webpack 打包的入口文件中
    // 热替换(HMR)，也是以 Node.js Api方式 配置，也需要将 webpack/hot/dev-server 配置到所有webpack入口文件中
    // 相当于执行 webpack-dev-server --inline --hot --config webpack.config.dev.js
    addDevClientToEntry(webpackConfig, devClients)
  }

  // create compiler
  const compiler = webpack(webpackConfig)

  // create server
  // 以 nodeAPI 启动 webpack-dev-server
  const server = new WebpackDevServer(compiler, Object.assign({
    clientLogLevel: 'none',
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
        { from: /./, to: path.posix.join(options.baseUrl, 'index.html') }
      ]
    },
    contentBase: api.resolve('public'),
    watchContentBase: !isProduction,
    hot: !isProduction,
    quiet: true,
    compress: isProduction,
    publicPath: options.baseUrl,
    overlay: isProduction // TODO disable this
      ? false
      : { warnings: false, errors: true }
  }, projectDevServerOptions, {
    https: useHttps,
    proxy: proxySettings,
    before (app, server) {
      // some code ...
    }
  }))

  // some code ...

  return new Promise((resolve, reject) => {
    // log instructions & open browser on first compilation complete
    let isFirstCompile = true
    compiler.hooks.done.tap('vue-cli-service serve', stats => {
      console.log()
      console.log(`  App running at:`)
      console.log(`  - Local:   ${chalk.cyan(urls.localUrlForTerminal)} ${copied}`)
      // some code ...
    })

    server.listen(port, host, err => {
      if (err) {
        reject(err)
      }
    })
  })
}
```

执行 `serve` 命令的函数大致可以分为以下几个部分：

* **获取 webpack 配置：api.resolveWebpackConfig()**
* **获取 devServer 配置**
* **注入 webpack-dev-server 和 hot-reload（HRM）中间件入口**
* **创建 webpack-dev-server 实例**

下面逐个简单说下： 

## 获取 webpack 配置

获取 webpack 配置最终调用的是实例 `resolveWebpackConfig` 方法，看下代码：
```js
resolveWebpackConfig (chainableConfig = this.resolveChainableWebpackConfig()) {
  if (!this.initialized) {
    throw new Error('Service must call init() before calling resolveWebpackConfig().')
  }
  // get raw config
  // './config/base', './config/css', './config/dev', './config/prod', './config/app' 这 5 个内置插件的主要作用
  // 就是完成 webpack 本地编译构建时的各种相关的配置，注意下这几个插件的顺序，因为他们都是利用 api.chainWebpack 进行 webpack 配置的，
  // 而配置又是可以覆盖的，因此如果拥有相同的配置，后面加载的插件的配置会覆盖前面的，但优先级最高的还是项目配置中的 webpack 配置，因为
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
  // some code ...

  return config
}
```

`resolveWebpackConfig` 函数传入了一个 `chainableConfig` 参数，这个参数是以 `webpack-chain` 形式注入的 webpack 配置，看下如何获取 `webpack-chain`
 形式的 webpack 配置：

::: tip webpack 配置方式
`Vue CLI` 内部的 `webpack` 配置是通过 `webpack-chain` 维护的，有两种方式可以进行 `webpack` 的配置，一种就是代码里面的 raw 式的配置，一种就是  `webpack-chain`
的方式进行配置，具体的配置方式查看官网[webpack 相关 -- 简单的配置方式](https://cli.vuejs.org/zh/guide/webpack.html#%E7%AE%80%E5%8D%95%E7%9A%84%E9%85%8D%E7%BD%AE%E6%96%B9%E5%BC%8F)
::: 


```js
resolveChainableWebpackConfig () {
  const chainableConfig = new Config()
  // apply chains
  this.webpackChainFns.forEach(fn => fn(chainableConfig))
  return chainableConfig
}
```
这就是获取 `webpack-chain` 的配置，代码很简洁，遍历执行 `Service` 实例中的 `webpackChainFns` 方法，合并所有插件以及项目配置中的 `webpack-chain` 
配置，并最终生成项目的 `webpack-chain`配置。

::: warning 插件 webpack-chain 配置加载顺序
执行 `vue-cli-service CLI` 命令时，会先加载内置插件，包含内置命令插件和内置配置插件（serve，build，inspect，help，base，css，dev，prod，app），
然后加载项目中依赖的 `vue-cli` 插件。由于所有插件都是通过 `api.chainWebpack` 进行 `webpack` 配置的，而配置又是可以覆盖的，因此如果拥有相同的配置，
后面加载的插件配置会覆盖前面的，但优先级最高的还是项目配置中的 `webpack` 配置，因为 `vue.config.js` 或者 `package.vue` 中的 `webpack` 配置是最后解析的。
:::

获取了 `webpack-chain` 形式的配置后，接下来就获取 raw 式的 webpack 配置（普通的 webpack 配置形式，或者说原生的 webpack 配置）。获取方法就是
遍历执行 `Service` 实例中的 `configureWebpack` 方法，并与 `webpack-chain` 形式的配置合并，生成项目最终的 webpack 配置。


## 获取 devServer 配置

获取 devServer 配置指的是获取 [webpack-dev-server 配置](https://webpack.js.org/configuration/dev-server/)，主要有两个地方可以配置，
第一种就是直接在 webpack 中配置，另外一种就是在 `vue.config.js` 或者 `package.vue` 中配置，后者配置方式拥有更高地优先级。在获取用户配置的 `devServer` 
以后，还会对这些配置进行解析，比如用户没有配置，会使用默认的 `devServer` 配置，另外 CLI 参数或者 `process.env` 中 `devServer` 拥有更高的优先级，以
`devServer.port` 为例， `vue.config.js` 如下：

```js
module.exports = {
  devServer: {
    port: 8081
  },
  configureWebpack: {
    devServer: {
      port: 8082
    }
  }
}
```
这种情况会优先采用 `devServer.port` 即 port 为 8081，因为它的优先级比较高，源码如下：
```js
const projectDevServerOptions = Object.assign(
  webpackConfig.devServer || {},
  options.devServer
)
```
如果直接输入以下命令，则 `devServer.port` 为 8083
```bash
vue-cli-service serve --port 8083
```
还有种情况，在项目中存在环境变量文件，比如存在 `.env.development` 文件，内容如下：
```
PORT=8084
```
执行 `vue-cli-service serve` 时，`devServer.port` 则为 8084。如果 `process.env` 和命令行参数中含有一样的配置，则参数中的配置有更高
的优先级，源码实现如下：

```js
portfinder.basePort = args.port || process.env.PORT || projectDevServerOptions.port || defaults.port
const port = await portfinder.getPortPromise()
```

## 注入 webpack-dev-server 和 hot-reload（HRM）中间件入口

先说下为什么要注入 `webpack-dev-server` 和 `hot-reload（HRM）`中间件入口。在开发中我们利用 `webpack-dev-server` 提供一个小型 Express 服务器
，从而可以为 webpack 打包生成的资源文件提供 web 服务，并用 webpack 自带的 HRM 模块实现热更新。在 vue-cli 2.X 中 我们通过以下命令来启动 `webpack-dev-server` 

```bash
webpack-dev-server --inline --progress --config build/webpack.dev.conf.js
```
但在 vue-cli 3.0 中则没有通过 CLI 的方式来启动 `webpack-dev-server`，而是使用 `Node.js Api`方式，即使用 `vue-cli-service serve`
命令创建一个服务器实例：

```js
const compiler = webpack(webpackConfig)
new WebpackDevServer(compiler, {})
```
这种方式就需要将 `webpack-dev-server` 客户端配置到 webpack 打包的入口文件中，如果还要实现热替换（HMR），则还需要将 `webpack/hot/dev-server` 
文件加入到 webpack 入口文件中，因此在源码中就有了以下代码：

```js
// inject dev & hot-reload middleware entries
if (!isProduction) {
  const sockjsUrl = publicUrl
    // explicitly configured via devServer.public
    ? `?${publicUrl}/sockjs-node`
    : isInContainer
      // can't infer public netowrk url if inside a container...
      // use client-side inference (note this would break with non-root baseUrl)
      ? ``
      // otherwise infer the url
      : `?` + url.format({
        protocol,
        port,
        hostname: urls.lanUrlForConfig || 'localhost',
        pathname: '/sockjs-node'
      })
  const devClients = [
    // dev server client
    require.resolve(`webpack-dev-server/client`) + sockjsUrl,
    // hmr client
    require.resolve(projectDevServerOptions.hotOnly
      ? 'webpack/hot/only-dev-server'
      : 'webpack/hot/dev-server')
    // TODO custom overlay client
    // `@vue/cli-overlay/dist/client`
  ]
  if (process.env.APPVEYOR) {
    devClients.push(`webpack/hot/poll?500`)
  }
  // inject dev/hot client
  addDevClientToEntry(webpackConfig, devClients)
}
```
以`Node.js API`方式启动 `webpack-dev-server` 除了添加入口文件外，还需要添加插件 `HotModuleReplacementPlugin`，因此在 `lib/config/dev.js` 
中添加了该插件：

```js

api.chainWebpack(webpackConfig => {
  // some code ...
  webpackConfig
    .plugin('hmr')
      .use(require('webpack/lib/HotModuleReplacementPlugin'))
  // some code ...
})
```

## 创建 webpack-dev-server 实例

完成上述这些操作后，接下来就是创建 `webpack-dev-server` 实例，整个项目就运行起来了。

```js
const compiler = webpack(webpackConfig)
new WebpackDevServer(compiler, {})
return new Promise((resolve, reject) => {
  // log instructions & open browser on first compilation complete
  let isFirstCompile = true
  compiler.hooks.done.tap('vue-cli-service serve', stats => {
    console.log()
    console.log(`  App running at:`)
    console.log(`  - Local:   ${chalk.cyan(urls.localUrlForTerminal)} ${copied}`)
    // some code ...
  })

  server.listen(port, host, err => {
    if (err) {
      reject(err)
    }
  })
})
```
这里使用了 webpack Compiler 模块暴露的生命周期钩子函数 done，在编译(compilation)完成时进行一些信息的输出，更多关于 compiler 钩子的文档请查看
webpack 官方文档 [compiler 钩子](https://webpack.js.org/api/compiler-hooks/)。
