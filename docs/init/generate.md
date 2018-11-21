# generate 函数分析

首先直接看代码：

``` javascript
module.exports = function generate (name, src, dest, done) {
  const opts = getOptions(name, src) // 获取配置信息
  const metalsmith = Metalsmith(path.join(src, 'template'))  // 定义 Metalsmith 工作目录  ~/.vue-templates`
  const data = Object.assign(metalsmith.metadata(), { // 定义一些全局变量，这样可以在 layout-files 中使用
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

### getOptions
根据这语以化的函数名就知道这是获取配置的，然后详细看下 `getOptions` 函数的代码：

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

`setValidateName` 的作用就是利用 [validate-npm-package-name](https://github.com/atlassian/validate-npm-package) 检查你输入的 app-name 是否符合 npm 包名命名规范，当然你也可以在 `meta.js` 中的 `prompts` 字段中的 `name` 下面增加 `validate` 字段来进行校验，但和 `validate-npm-package-name` 的规则是 && 的关系。比如，当你输入的 app-name 包含了大写字母，就会有以下的提示：

<img :src="$withBase('/assets/init-img02.png')">


### Handlebars.registerHelper

`Handlebars.registerHelper` 用于注册一些 `helper`（或者说成是一些逻辑方法），在模版中来处理一些数据，比如像源码中注册的 `if_eq`  `helper`，他的作用就是判断两个字符串是否相等。然后在 `webpack` 的模板中就有以下的用法：

<img :src="$withBase('/assets/init-img03.png')">

就是根据你在构建项目时选择的 `test runner （Jest，Karma and Mocha，none configure it yourself）` 来生成对应的 `npm script`。你也可以在 `meta.js` 中添加自定义的 `helper`，`vue-cli` 会帮你注册到 `Handlebars` 中。

### opts.metalsmith
先看一段源码：

``` javascript
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
```
`opts.metalsmith` 的作用就是合并一些全局变量，怎么理解呢，我们从 `webpack` 模板入手。在 `webpack` 模板的 `meta.js` 中含有`metalsmith.after`:

``` javascript
module.exports = {
  metalsmith: {
    // When running tests for the template, this adds answers for the selected scenario
    before: addTestAnswers
  }
  ...
}
```
然后一步一步找到 `addTestAnswers`：

``` javascript
const scenarios = [
  'full', 
  'full-karma-airbnb', 
  'minimal'
]

const index = scenarios.indexOf(process.env.VUE_TEMPL_TEST)

const isTest = exports.isTest = index !== -1

const scenario = isTest && require(`./${scenarios[index]}.json`)

exports.addTestAnswers = (metalsmith, options, helpers) => {
  Object.assign(
    metalsmith.metadata(),
    { isNotTest: !isTest },
    isTest ? scenario : {}
  )
}
```
`metalsmith.before` 结果就是将 `metalsmith metadata` 数据和 `isNotTest` 合并，如果 `isTest` 为 `ture`，还会自动设置 `name`，`description`等字段。那么它的作用是什么呢，作用就是为模版添加自动测试脚本，它会将 `isNotTest` 设置为 `false`，而通过 `inquirer` 来提问又会是在 `isNotTest` 为 `true` 的情况下才会发生，因此设置了`VUE_TEMPL_TEST`的值会省略 `inquirer` 提问过程，并且会根据你设置的值来生成对应的模板，有以下三种值可以设置：

* **minimal**：这种不会设置 router，eslint 和 tests
* **full**： 会带有 router，eslint (standard) 和 tests (jest & e2e)
* **full-airbnb-karma**：带有 router eslint（airbnb） 和 tests（karma）

那么如何使用某一种呢，命令如下：

``` bash
VUE_TEMPL_TEST=full vue init webpack demo
```
在这种情况下，会自动跳过 `inquirer` 的问题，并生成你设置的 `VUE_TEMPL_TEST`。

<img :src="$withBase('/assets/init-img04.png')">