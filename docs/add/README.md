# add 命令

**源码目录：**  packages/@vue/cli/lib/add.js 。

**作用：**  在 vue-cli 项目中安装插件并调用其 generator 。


`vue add` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('add <plugin> [pluginOptions]')
  .description('install a plugin and invoke its generator in an already created project')
  .option('--registry <url>', 'Use specified npm registry when installing dependencies (only for npm)')
  .allowUnknownOption()
  .action((plugin) => {
    require('../lib/add')(plugin, minimist(process.argv.slice(3)))
  })
```

从代码中可以看出，`vue add` 命令接受两个参数:
* plugin： 插件名称，必填。
* registry： 安装插件指定的安装源，只针对于 npm 包管理器，选填。

当执行了 `vue add` 命令后会加载 `@vue/cli/lib/add.js`，下面就逐步开始分析。
