# generator

在安装完依赖以后，就会调用 generators ，首先后实例化一个 Generator ，看代码：
```js
const generator = new Generator(context, {
  pkg,
  plugins,
  completeCbs: createCompleteCbs
})
```
在实例化一个 Generator 的时候会初始化一些成员变量，最重要的就是调用插件的 generators，不同于 1.x/2.x 基于模板的脚手架，Vue-cli3.0 采用了一套
基于插件的架构，到这里就会交给各个插件去执行了，看一下 Generator 实例化的代码：
```js
module.exports = class Generator {
  constructor (context, {
    pkg = {},
    plugins = [],
    completeCbs = [],
    files = {},
    invoking = false
  } = {}) {
    this.context = context
    this.plugins = plugins
    this.originalPkg = pkg
    this.pkg = Object.assign({}, pkg)
    this.imports = {}
    this.rootOptions = {}
    this.completeCbs = completeCbs
    this.configTransforms = {}
    this.defaultConfigTransforms = defaultConfigTransforms
    this.reservedConfigTransforms = reservedConfigTransforms
    this.invoking = invoking
    // for conflict resolution
    this.depSources = {}
    // virtual file tree
    this.files = files
    this.fileMiddlewares = [] // receives the virtual files tree object, and an ejs render function
    this.postProcessFilesCbs = []
    // exit messages
    this.exitLogs = []

    const cliService = plugins.find(p => p.id === '@vue/cli-service')

    const rootOptions = cliService
      ? cliService.options
      : inferRootOptions(pkg)
    // apply generators from plugins
    // 调用插件的 generators
    plugins.forEach(({ id, apply, options }) => {
      // 每个插件对应生成一个 GeneratorAPI 实例，并将实例 api 传入插件暴露出来的 generator 函数
      const api = new GeneratorAPI(id, this, options, rootOptions)
      apply(api, options, rootOptions, invoking)
    })
  }
}
```
接下来看一下 GeneratorAPI。

## GeneratorAPI
