const { log, error, openBrowser } = require('@vue/cli-shared-utils')
const { portfinder, server } = require('@vue/cli-ui/server')
/* const { portfinder, server } = require('../cli-ui/server') // 调试*/
const shortid = require('shortid')

async function ui (options = {}, context = process.cwd()) {
  const host = options.host || 'localhost'

  let port = options.port
  if (!port) {
    port = await portfinder.getPortPromise() // port
  }

  // Config
  process.env.VUE_APP_CLI_UI_URL = ''

  // Optimize express
  const nodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'

  // Dev mode
  if (options.dev) {
    process.env.VUE_APP_CLI_UI_DEV = true
  }

  if (!process.env.VUE_CLI_IPC) {
    // Prevent IPC id conflicts
    process.env.VUE_CLI_IPC = `vue-cli-${shortid()}`
  }

  if (!options.quiet) log(`🚀  Starting GUI...`)

  const opts = {
    host,
    port,
    graphqlPath: '/graphql',
    subscriptionsPath: '/graphql', // 订阅
    enableMocks: false,
    enableEngine: false,
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
    // Reset for yarn/npm to work correctly
    if (typeof nodeEnv === 'undefined') {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = nodeEnv
    }

    // Open browser
    const url = `http://${host}:${port}`
    if (!options.quiet) log(`🌠  Ready on ${url}`)
    if (options.headless) {
      console.log(port)
    } else {
      openBrowser(url)
    }
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
