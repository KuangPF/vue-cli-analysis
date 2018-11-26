---
sidebarDepth: 0
---

# 常见 npm 包

在进去 `vue-cli` 源码学习之前，这里先介绍下在 `vue-cli` 项目中用到的一些必备的 `npm` 包，这样在后面分析源码的时候会比较快的理解。
* [commander](https://github.com/tj/commander.js)：node.js command-line interfaces made easy
* [Inquirer](https://github.com/SBoudrias/Inquirer.js)
* [handlebars](https://github.com/wycats/handlebars.js)
* [metalsmith](https://github.com/segmentio/metalsmith)
* [chalk](https://github.com/chalk/chalk)
* [download-git-repo](https://github.com/flipxfx/download-git-repo)
* [consolidate](https://github.com/tj/consolidate.js)

下面逐个介绍：

## commander

`commander` 是一款重量轻，表现力和强大的命令行框架，提供了用户命令行输入和参数解析强大功能。以 `vue create` 为例：

``` javascript
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
    // --no-git makes commander to default git to true
    if (process.argv.includes('-g') || process.argv.includes('--git')) {
      options.forceGit = true
    }
    require('../lib/create')(name, options)
  })
```

