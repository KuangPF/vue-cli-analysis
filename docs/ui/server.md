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

接下来看服务端启动的代码，代码目录在 `vue-cli-plugin-apollo/graphql-server/index.js` 中，简单看下部分代码：

```js
// 创建基于 express 的 GraphQL server
// apollo-server-express 是由 Apollo 提供在 express 环境下实现 GraphQL 的库
module.exports = (options, cb = null) => {
  // some code ...
  // Express app
  const app = express()

  if (options.typescript) require('ts-node/register/transpile-only')

  // Customize those files
  let typeDefs = load(options.paths.typeDefs) // GraphQL schema
  const resolvers = load(options.paths.resolvers) // GraphQL resolvers
  
  // ...

  let apolloServerOptions = {
    typeDefs,
    resolvers,
    schemaDirectives,
    dataSources,
    tracing: true,
    cacheControl: true,
    engine: !options.integratedEngine,
    // Resolvers context from POST
    context: async ({ req, connection }) => {
      let contextData
      try {
        if (connection) {
          contextData = await autoCall(context, { connection })
        } else {
          contextData = await autoCall(context, { req })
        }
      } catch (e) {
        console.error(e)
        throw e
      }
      contextData = Object.assign({}, contextData, { pubsub })
      return contextData
    },
    // Resolvers context from WebSocket
    subscriptions: {
      path: options.subscriptionsPath,
      onConnect: async (connection, websocket) => {
        let contextData = {}
        try {
          contextData = await autoCall(context, {
            connection,
            websocket,
          })
          contextData = Object.assign({}, contextData, { pubsub })
        } catch (e) {
          console.error(e)
          throw e
        }
        return contextData
      },
    },
  }
  // ...

  // Apollo Server
  const server = new ApolloServer(apolloServerOptions)

  // Express middleware
  // 通过 applyMiddleware() 作为 app 来传递它，来添加 Apollo Server 的中间件
  server.applyMiddleware({
    app,
    path: options.graphqlPath,
    cors: options.cors,
    // gui: {
    //   endpoint: graphqlPath,
    //   subscriptionEndpoint: graphqlSubscriptionsPath,
    // },
  })

  // Start server
  const httpServer = http.createServer(app)
  httpServer.setTimeout(options.timeout)
  server.installSubscriptionHandlers(httpServer)

  httpServer.listen({
    host: options.host || 'localhost',
    port: options.port,
  }, () => {
    if (!options.quiet) {
      console.log(`✔️  GraphQL Server is running on ${chalk.cyan(`http://localhost:${options.port}${options.graphqlPath}`)}`)
      if (process.env.NODE_ENV !== 'production' && !process.env.VUE_CLI_API_MODE) {
        console.log(`✔️  Type ${chalk.cyan('rs')} to restart the server`)
      }
    }

    cb && cb()
  })
}
```
以上是 `server` 的部分代码，主要作用是利用 `apollo-server` 在 nodejs 上构建 `grqphql` 服务端的 web 中间件，由于 `server` 端是 `express` 环境，
因此使用了 npm 包 `apollo-server-express`，到这里，服务端就启动起来了。

::: tip vue-cli-plugin-apollo
启动 server 使用了 [vue-cli-plugin-apollo](https://github.com/Akryum/vue-cli-plugin-apollo)插件，
它是 [vue-apollo](https://vue-apollo.netlify.com/zh-cn/)
的 cli 插件，但与 vue-apollo 相比，它又有更多的新特性，比如集成了 apollo-server 以及包含一些 vue apollo 例子等等。
:::
