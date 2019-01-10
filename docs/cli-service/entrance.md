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
看出，执行 CLI 命令后，主要有两个操作：实例化 `Service` 和调用实例的 `run` 方法。



