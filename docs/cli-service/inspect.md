# vue-cli-service inspect

`vue-cli-service inspect` 用于审查一个 Vue CLI 项目的 webpack config，比如执行 `vue-cli-service inspect entry` 命令，会输出 webpack 
配置中入口文件配置信息：
```js
{
  app: [
    './src/main.js'
  ]
}
```
接下来还是一步一步看 `inspect` 命令的实现过程，首先执行 `vue-cli-service inspect --help` 查看 `inspect` 的参数选项：

```
--mode                specify env mode (default: development) || 指定环境模式
--rule <ruleName>     inspect a specific module rule || 检查某个特定的 module rule
--plugin <pluginName> inspect a specific plugin || 检查某个特定的插件
--rules               list all module rule names || 列出所有 module rule 名称
--plugins             list all plugin names || 列出所有插件名称
--verbose             show full function definitions in output || 是否在输出信息中显示所有函数的定义
```
这些参数应该比较好理解，接下来就看下 `inspect` 的代码：

```js
args => {
  const { get } = require('@vue/cli-shared-utils')
  const { toString } = require('webpack-chain')
  const config = api.resolveWebpackConfig()
  const { _: paths, verbose } = args

  let res
  if (args.rule) {
    res = config.module.rules.find(r => r.__ruleNames[0] === args.rule)
  } else if (args.plugin) {
    res = config.plugins.find(p => p.__pluginName === args.plugin)
  } else if (args.rules) {
    res = config.module.rules.map(r => r.__ruleNames[0])
  } else if (args.plugins) {
    res = config.plugins.map(p => p.__pluginName || p.constructor.name)
  } else if (paths.length > 1) {
    res = {}
    paths.forEach(path => {
      res[path] = get(config, path)
    })
  } else if (paths.length === 1) {
    res = get(config, paths[0])
  } else {
    res = config
  }
  // 根据参数 verbose 判断是否需要显示函数定义的内容，如果为 true，则用 function () { /* omitted long function */ } 代替函数的内容
  const output = toString(res, { verbose })
  console.log(output)
}
```

代码应该是相当地简洁了，首先通过 `resolveWebpackConfig` 获取整个项目的 webpack 配置，然后根据 args 的值获取对应的 webpack 配置并通过 
`webpack-chain` 的 `toString` 函数来生成配置信息，最终打印在控制台上。除了 plugin, rule 等参数，在源码中还有 paths 变量，它里面包含着除了
命令本身以外的参数，比如执行 `vue-cli-service inspect entry` 命令 , paths 则为 `[entry]`，paths 是一个数组，如果包含多个参数，则会
返回所有参数对应的 webpack 配置，例如想要一次性返回 entry 和 devServer 的配置，可以执行以下命令：

```bash
vue-cli-service inspect entry devServer
```
然后会输出以下信息：

```
{
  entry: {
    app: [
      './src/main.js'
    ]
  },
  devServer: {
    port: 8007
  }
}
```

`vue-cli-service inspect` 命令大致就分析这些，该命令在开发是查看 webpack 配置非常有用。
::: tip 感受
在分析 inspect 命令是有一个感受就是：**看代码是获取结果最快的方式**。比如关于 `verbose` 参数，开始看的时候有点不太理解，然后查看使用地方是
作为参数传入到 `webpack-chain` 的 `toString` 方法中，接下来查看 `toString` 方法代码，部分代码如下：

```js
// shorten long functions
if (typeof value === 'function') {
  if (value.__expression) {
    return value.__expression;
  }
  if (!verbose && value.toString().length > 100) {
    return `function () { /* omitted long function */ }`;
  }
}
```
看到这里就比较好理解了，如果 webpack 配置中某个配置选项是函数，而且函数内容的字符长度大于100，此时就用 `function () { /* omitted long function */ }` 
代替函数内容来显示。
:::
