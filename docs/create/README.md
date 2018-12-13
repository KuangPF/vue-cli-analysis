# create 命令

**源码目录：**  packages/@vue/cli/lib/create.js 。

**作用：** create a new project powered by vue-cli-service 。


`vue create` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

``` js
program
  .command('create <app-name>')
  .description('create a new project powered by vue-cli-service')
  .option('-p, --preset <presetName>', 'Skip prompts and use saved or remote preset')
  .option('-d, --default', 'Skip prompts and use default preset')
  .option('-i, --inlinePreset <json>', 'Skip prompts and use inline JSON string as preset')
  .option('-m, --packageManager <command>', 'Use specified npm client when installing dependencies')
  .option('-r, --registry <url>', 'Use specified npm registry when installing dependencies (only for npm)')
  .option('-g, --git [message]', 'Force git initialization with initial commit message')
  .option('-n, --no-git', 'Skip git initialization')
  .option('-f, --force', 'Overwrite target directory if it exists')
  .option('-c, --clone', 'Use git clone when fetching remote preset')
  .option('-x, --proxy', 'Use specified proxy when creating project')
  .option('-b, --bare', 'Scaffold project without beginner instructions')
  .action((name, cmd) => {
    const options = cleanArgs(cmd)
    // --git makes commander to default git to true
    if (process.argv.includes('-g') || process.argv.includes('--git')) {
      options.forceGit = true
    }
    require('../lib/create')(name, options)
  })
```


一看这么多参数，不要方，一个一个地来解释这些参数：
```
-p, --preset <presetName>       忽略提示符并使用已保存的或远程的预设选项
-d, --default                   忽略提示符并使用默认预设选项
-i, --inlinePreset <json>       忽略提示符并使用内联的 JSON 字符串预设选项
-m, --packageManager <command>  在安装依赖时使用指定的 npm 客户端
-r, --registry <url>            在安装依赖时使用指定的 npm registry
-g, --git [message]             强制 / 跳过 git 初始化，并可选的指定初始化提交信息
-n, --no-git                    跳过 git 初始化
-f, --force                     覆写目标目录可能存在的配置
-c, --clone                     使用 git clone 获取远程预设选项
-x, --proxy                     使用指定的代理创建项目
-b, --bare                      创建项目时省略默认组件中的新手指导信息
-h, --help                      输出使用帮助信息
```

以上这些解释只是从 `vue-cli` 官网搬运过来了的，在下一节将整体介绍 `vue create` 命令主要由哪几部分构成的。