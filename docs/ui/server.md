# server 分析

先看下 `ui` 命令加载的 `lib/ui.js` 内容：

```js
async function ui (options = {}, context = process.cwd()) {
  const host = options.host || 'localhost'

  // some code ...

  if (!options.quiet) log(`🚀  Starting GUI...`)

  const opts = {
    host, // 域名
    port, // 端口
    graphqlPath: '/graphql', 
    subscriptionsPath: '/graphql', // 订阅
    enableMocks: false, // 是否模拟数据
    enableEngine: false, // Apollo Engine
    cors: '*',
    timeout: 1000000,
    quiet: true,
    paths: {
      typeDefs: require.resolve('@vue/cli-ui/apollo-server/type-defs.js'), // schema
      resolvers: require.resolve('@vue/cli-ui/apollo-server/resolvers.js'), // resolvers
      context: require.resolve('@vue/cli-ui/apollo-server/context.js'), // 可以向 resolvers 注入上下文对象
      pubsub: require.resolve('@vue/cli-ui/apollo-server/pubsub.js'), // 订阅
      server: require.resolve('@vue/cli-ui/apollo-server/server.js'), // express 服务 e.g. express.static
      directives: require.resolve('@vue/cli-ui/apollo-server/directives.js') // schema 指令
    }
  }


  server(opts, () => {
    // server cb()
    // some code ...
  })
}

module.exports = (...args) => {
  return ui(...args).catch(err => {
    error(err)
    if (!process.env.VUE_CLI_TEST) {
      process.exit(1)
    }
  })
}
```

上面是 `lib/ui.js` 的部分代码，主要就是获取 `opts`，然后执行 `@vue/cli-ui` 的 `server` 方法。在 `opts` 中需要注意的就是 `opts.path`  ,
它定义一些变量的路径，具体作用如下：

* **typeDefs**: GraphQL Schema，用来定义 GraphQL 数据模型
* **resolvers**： 用于解析 GraphQL Query 获取的数据
* **context**：可以向 resolvers 注入上下文对象
* **pubsub**：GraphQL 订阅
* **server**：express 服务，利用 app.use 注册中间件
* **directives**： GraphQL 指令， @include，@skip
