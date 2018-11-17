# init 命令

**源码目录：**  vue-cli-init/bin/vue-init 。
**作用：** 下载远程模板并生成项目 。
**相关说明：** `vue init` 命令主要是 2.X 版本使用，但在 3.0中还是将其保留，3.0 推荐使用 `vue create` 。

`vue init` 命令的入口在 packages/@vue/cli/bin/vue.js 中，

``` javascript
program
  .command('init <template> <app-name>')
  .description('generate a project from a remote template (legacy API, requires @vue/cli-init)')
  .option('-c, --clone', 'Use git clone when fetching remote template')
  .option('--offline', 'Use cached template')
  .action(() => {
    loadCommand('init', '@vue/cli-init')
  })
```