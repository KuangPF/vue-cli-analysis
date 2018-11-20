# generate 函数分析

首先直接看代码：

``` javascript
module.exports = function generate (name, src, dest, done) {
  const opts = getOptions(name, src)
  const metalsmith = Metalsmith(path.join(src, 'template'))
  const data = Object.assign(metalsmith.metadata(), {
    destDirName: name,
    inPlace: dest === process.cwd(),
    noEscape: true
  })
  opts.helpers && Object.keys(opts.helpers).map(key => {
    Handlebars.registerHelper(key, opts.helpers[key])
  })

  const helpers = { chalk, logger }

  if (opts.metalsmith && typeof opts.metalsmith.before === 'function') {
    opts.metalsmith.before(metalsmith, opts, helpers)
  }

  metalsmith.use(askQuestions(opts.prompts))
    .use(filterFiles(opts.filters))
    .use(renderTemplateFiles(opts.skipInterpolation))

  if (typeof opts.metalsmith === 'function') {
    opts.metalsmith(metalsmith, opts, helpers)
  } else if (opts.metalsmith && typeof opts.metalsmith.after === 'function') {
    opts.metalsmith.after(metalsmith, opts, helpers)
  }

  metalsmith.clean(false)
    .source('.') // start from template root instead of `./src` which is Metalsmith's default for `source`
    .destination(dest)
    .build((err, files) => {
      done(err)
      if (typeof opts.complete === 'function') {
        const helpers = { chalk, logger, files }
        opts.complete(data, helpers)
      } else {
        logMessage(opts.completeMessage, data)
      }
    })

  return data
}

```
我们将这段代码分为以下部分来讲：

## getOptions
根据这语以化就知道这是获取配置的，然后详细看下 getOptions 函数的代码：

``` javascript
module.exports = function options (name, dir) {
  const opts = getMetadata(dir) // 获取 meta.js 里面的信息，比如：prompts，helpers，filters 等等

  setDefault(opts, 'name', name) // 将 meta.js 里面 prompts 字段添加到 inquirer 中，完成命令行的交互
  setValidateName(opts) // 检查包的名称是否符合规范

  // 获取 name 和 email，用于生成 package.json 里面的 author 字段
  const author = getGitUser() // git config --get user.name , git config --get user.email
  if (author) {
    setDefault(opts, 'author', author)
  }

  return opts
}
```

setValidateName 的作用就是利用 [validate-npm-package-name](https://github.com/atlassian/validate-npm-package) 检查你输入的 app-name 是否符合 npm 包名规范，而且也可以在 meta.js 中的 prompts 字段中的name 下面增加 validate 字段来进行校验，但和 validate-npm-package-name 的规则是 && 的关系。比如，当你输入的 app-name 包含了大写字段，就会有以下的提示：

<img :src="$withBase('/assets/init-img02.png')">

