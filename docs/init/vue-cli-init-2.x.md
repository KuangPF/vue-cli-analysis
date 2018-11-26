# vue-cli 2.x init 分析

当开始执行 `vue-cli-init/bin/vue-init` 的代码时，会进入这个判断：

``` javascript
if (inPlace || exists(to)) {
  inquirer.prompt([{
    type: 'confirm',
    message: inPlace
      ? 'Generate project in current directory?'
      : 'Target directory exists. Continue?',
    name: 'ok'
  }]).then(answers => {
    if (answers.ok) {
      run()
    }
  }).catch(logger.fatal)
} else {
  run()
}
```
这段代码的作用是：
* 如果没有填写 app-name ,则默认在当前目录生成模版。 在 vue-cli 3.0 中 app-name 为必填，不过在 vue-cli 2.x 中为非必填。
* 如果当前目录有与 app-name 重名的，是否要继续。

然后根据用户的回答来判断是否执行 `run` 函数，对应的代码如下：

``` javascript
function run () {
  // check if template is local
  if (isLocalPath(template)) {
    const templatePath = getTemplatePath(template)
    if (exists(templatePath)) {
      generate(name, templatePath, to, err => {
        if (err) logger.fatal(err)
        console.log()
        logger.success('Generated "%s".', name)
      })
    } else {
      logger.fatal('Local template "%s" not found.', template)
    }
  } else {
    checkVersion(() => {
      if (!hasSlash) {
        // use official templates
        const officialTemplate = 'vuejs-templates/' + template
        if (template.indexOf('#') !== -1) {
          downloadAndGenerate(officialTemplate)
        } else {
          if (template.indexOf('-2.0') !== -1) {
            warnings.v2SuffixTemplatesDeprecated(template, inPlace ? '' : name)
            return
          }

          // warnings.v2BranchIsNowDefault(template, inPlace ? '' : name)
          downloadAndGenerate(officialTemplate)
        }
      } else {
        downloadAndGenerate(template)
      }
    })
  }
}
```

`run` 函数作用如下：
* 是否需要从缓存中读取模版并生成
* 下载官方模板还是自定义模板

如果按照正常流程来的话（方便下一步描述，不然 `return` 了就没得什么分析的了）会执行 `downloadAndGenerate` 函数，总算到了核心部分了，来看一下 `downloadAndGenerate` 函数的代码：

``` javascript
function downloadAndGenerate (template) {
  const spinner = ora('downloading template')
  spinner.start()
  // Remove if local template exists
  if (exists(tmp)) rm(tmp)
  download(template, tmp, { clone }, err => {
    spinner.stop()
    if (err) logger.fatal('Failed to download repo ' + template + ': ' + err.message.trim())
    generate(name, tmp, to, err => {
      if (err) logger.fatal(err)
      console.log()
      logger.success('Generated "%s".', name)
    })
  })
}
```

`downloadAndGenerate` 函数其实很简洁，就是利用 [download-git-repo](https://github.com/flipxfx/download-git-repo) 从 Github 拉取模板，然后生成在 `~/.vue-templates`目录下面，之后会又会调用 `generate` 函数将`~/.vue-templates` 目录下面的模板来生成文件。

到这里也许有些朋友会问：直接把模板下载下来放在 /app-name 目录下面不就可以了？如果是静态的模板的的确可以这么做，但是在 vue-cli 初始化一个项目的过程中会询问你 `Project name`， `Project description` 以及是否需要安装 `vue-router`等等，最后会根据你的回答来生成对应的文件，所以直接将静态的模板放在 /app-name 目录显然不行，因此调用`generate` 函数动态地生成模板。

其实分析到这里就会发现 vue-cli 会将一个功能拆分为多个模块来写，这中模块化的思想是非常值得学习的，好了，下一节开始分析 `generate` 函数的实现，这也是 init 命令中最核心的部分。