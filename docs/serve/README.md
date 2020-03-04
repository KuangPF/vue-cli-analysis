# serve 命令

**源码目录：**  packages/@vue/cli-service-global 。

**作用：**  在开发环境模式下零配置为 .js 或 .vue 文件启动一个服务器 。

`vue serve` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('serve [entry]')
  .description('serve a .js or .vue file in development mode with zero config')
  .option('-o, --open', 'Open browser')
  .option('-c, --copy', 'Copy local url to clipboard')
  .action((entry, cmd) => {
    loadCommand('serve', '@vue/cli-service-global').serve(entry, cleanArgs(cmd))
  })
```

代码写的很清楚了，当执行 `vue serve` 命令时会执行 `@vue/cli-service-global` 的 `serve` 方法，那就直接看 `serve` 方法源码：

```js
exports.serve = (_entry, args) => {
  const { context, entry } = resolveEntry(_entry)
  createService(context, entry).run('serve', args)
}
```
首先调用 `resolveEntry` 获取入口文件 `entry`，和当前工作目录 `context`，看 `resolveEntry` 函数代码：

```js
function resolveEntry (entry) {
  const context = process.cwd()

  entry = entry || findExisting(context, [
    'main.js',
    'index.js',
    'App.vue',
    'app.vue'
  ])

  if (!entry) {
    console.log(chalk.red(`Failed to locate entry file in ${chalk.yellow(context)}.`))
    console.log(chalk.red(`Valid entry file should be one of: main.js, index.js, App.vue or app.vue.`))
    process.exit(1)
  }

  if (!fs.existsSync(path.join(context, entry))) {
    console.log(chalk.red(`Entry file ${chalk.yellow(entry)} does not exist.`))
    process.exit(1)
  }

  return {
    context,
    entry
  }
}
```
如果 `vue serve` 命令中含有 `--entry` 参数，那么入口文件就取参数中的文件，否则会依次判断在当前工作目录是否存在 main.js，index.js，App.vue，app.vue，
文件，只要存在就会返回，针对于参数中含有 `entry` 的情形还会判断 `entry` 文件是否存在，如果存在则将当前工作目录和入口文件一起返回。

接下来就创建了一个 `Service` 实例，并执行其 `run` 方法，如果之前看了 [cli-service](/cli-service/entrance.html) 部分的话，我相信到这里就应该就非常熟悉了，相当于就执行了 `vue-cli-service` 
serve
命令。还是看下在 `createService` 中发生了什么：

```js
function createService (context, entry, asLib) {
  return new Service(context, {
    projectOptions: {
      compiler: true,
      lintOnSave: true
    },
    plugins: [
      babelPlugin,
      eslintPlugin,
      globalConfigPlugin(context, entry, asLib)
    ]
  })
}
```

`createService` 主要工作就是实例化一个 `Service`，并且初始化了 `projectOptions` 和 `plugins`，看一下 `globalConfigPlugin` 的代码：
```js
module.exports = function createConfigPlugin (context, entry, asLib) {
  return {
    id: '@vue/cli-service-global-config',
    apply: (api, options) => {
      api.chainWebpack(config => {
        // some code ...
      })
    }
  }
}
```
这就是一个 service 插件，主要进行了 webpack 的一些配置。在此之后就调用了实例的 `run` 方法，执行了 `vue-cli-service serve` 命令，相关分析可查看
 [cli-service 内置插件 serve](/cli-service/serve.html)。

