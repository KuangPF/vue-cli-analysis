# ui 命令

**源码目录：**  packages/@vue/cli/lib/ui.js 。

**作用：**  以图形化界面创建和管理项目。

`vue ui` 命令的入口在 `packages/@vue/cli/bin/ui.js` 中:

```js
program
  .command('ui')
  .description('start and open the vue-cli ui')
  .option('-H, --host <host>', 'Host used for the UI server (default: localhost)')
  .option('-p, --port <port>', 'Port used for the UI server (by default search for available port)')
  .option('-D, --dev', 'Run in dev mode')
  .option('--quiet', `Don't output starting messages`)
  .option('--headless', `Don't open browser on start and output port`)
  .action((cmd) => {
    checkNodeVersion('>=8.6', 'vue ui')
    require('../lib/ui')(cleanArgs(cmd))
  })
```
和其它 `vue` 命令一样，从这里可以简单查看 `ui` 命令的一些参数，其中包括 host 配置，端口配置以及在什么模式下运行等等，`ui` 命令的回调 action 会加载 `ui.js`，但在分析 `ui.js` 之前先整体上分析 `vue ui` 命令，以及其中涉及到的一些知识。