# generator

在安装完依赖以后，就会调用 resolvePlugins，作用就是加载每个插件的 generator ，并且如果插件需要进行命令行交互的话会执行 inquirer.prompt 获取 option。
在此之后会实例化一个 Generator ，看代码：
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

GeneratorAPI 是一个比较重要的部分了，前面说过 vue-cli 3.0 是基于一套插件架构的，那么如果插件需要自定义项目模板、修改模板中的一些文件或者添加一些依赖
的话怎么处理呢。方法是@vue/cli 插件所提供的 generator 向外暴露一个函数，接收的第一个参数 api，然后通过该 api 提供的方法去完成应用的拓展工作，这里所说
的 api 就是 GeneratorAPI，下面看一下 GeneratorAPI 提供了哪些方法。

* hasPlugin：判断项目中是否有某个插件 
* extendPackage：拓展 package.json 配置方
* render：利用 ejs 渲染模板文件
* onCreateComplete：内存中保存的文件字符串全部被写入文件后的回调函数
* exitLog：当 generator 退出的时候输出的信息
* genJSConfig：将 json 文件生成为 js 配置文件
* injectImports：向文件当中注入import语法的方法
* injectRootOptions：向 Vue 根实例中添加选项
* ...

下面就以 @vue/cli-service 为例，来简单熟悉下 GeneratorAPI。
