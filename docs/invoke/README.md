# invoke 命令

**源码目录：**  packages/@vue/cli/lib/invoke.js 。

**作用：**  在 vue-cli 项目中调用插件的 generator 。


`vue invoke` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('invoke <plugin> [pluginOptions]')
  .description('invoke the generator of a plugin in an already created project')
  .option('--registry <url>', 'Use specified npm registry when installing dependencies (only for npm)')
  .allowUnknownOption()
  .action((plugin) => {
    require('../lib/invoke')(plugin, minimist(process.argv.slice(3)))
  })
```

从代码中可以看出，`vue invoke` 命令接受两个参数:
* plugin： 插件名称，必填。
* registry： 安装插件指定的安装源，只针对于 npm 包管理器，选填。

当执行了 `vue add` 命令时会加载 `@vue/cli/lib/invoke.js`，对于插件的调用在 `vue add` 命令中已经分析了，这里就不做介绍。`vue add`
本身就包含了 `vue invoke` 的功能，而`vue invoke` 只是将插件调用的功能分离出了。在某些场景下该功能十分方便，比如当你执行 `vue add` 安装并调用了
一个插件的 `generator` 之后，你想要更改这个插件配置，那么此时只需要执行 `vue invoke` 调用插件的 `generator` 修改配置即可。
