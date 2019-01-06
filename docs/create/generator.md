# generator

在安装完依赖以后，就会调用 `resolvePlugins`，作用就是加载每个插件的 `generator` ，并且如果插件需要进行命令行交互的话会执行 `inquirer.prompt` 获取 option。
在此之后会实例化一个 `Generator` ，看代码：
```js
const generator = new Generator(context, {
  pkg,
  plugins,
  completeCbs: createCompleteCbs
})
```
在实例化一个 `Generator` 的时候会初始化一些成员变量，最重要的就是调用插件的 `generators`，不同于 1.x/2.x 基于模板的脚手架，Vue-cli3.0 采用了一套
基于插件的架构，到这里就会交给各个插件去执行了，看一下 `Generator` 实例化的代码：

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
    this.configTransforms = {} // 插件通过 GeneratorAPI 暴露的 addConfigTransform 方法添加如何提取配置文件
    this.defaultConfigTransforms = defaultConfigTransforms // 默认的配置文件
    this.reservedConfigTransforms = reservedConfigTransforms // 保留的配置文件 vue.config.js
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

`GeneratorAPI` 是一个比较重要的部分了，前面说过 vue-cli 3.0 是基于一套插件架构的，那么如果插件需要自定义项目模板、修改模板中的一些文件或者添加一些依赖
的话怎么处理呢。方法是 @vue/cli 插件所提供的 generator 向外暴露一个函数，接收的第一个参数 api，然后通过该 api 提供的方法去完成应用的拓展工作，这里所说
的 api 就是 `GeneratorAPI`，下面看一下 `GeneratorAPI` 提供了哪些方法。

* **hasPlugin**：判断项目中是否有某个插件 
* **extendPackage**：拓展 package.json 配置方
* **render**：利用 ejs 渲染模板文件
* **onCreateComplete**：内存中保存的文件字符串全部被写入文件后的回调函数
* **exitLog**：当 generator 退出的时候输出的信息
* **genJSConfig**：将 json 文件生成为 js 配置文件
* **injectImports**：向文件当中注入import语法的方法
* **injectRootOptions**：向 Vue 根实例中添加选项
* ...

下面就以 `@vue/cli-service` 为例，来简单熟悉下 `GeneratorAPI`。首先看一下 `@vue/cli-service/generator/index.js`

```js
module.exports = (api, options) => {
  /* 渲染 ejs 模板 */
  api.render('./template', {
    doesCompile: api.hasPlugin('babel') || api.hasPlugin('typescript')
  })
  
  // 扩展 package.json
  api.extendPackage({
    scripts: {
      'serve': 'vue-cli-service serve',
      'build': 'vue-cli-service build'
    },
    dependencies: {
      'vue': '^2.5.17'
    },
    devDependencies: {
      'vue-template-compiler': '^2.5.17'
    },
    'postcss': {
      'plugins': {
        'autoprefixer': {}
      }
    },
    browserslist: [
      '> 1%',
      'last 2 versions',
      'not ie <= 8'
    ]
  })
  // 如果 preset 中包含 vue-router
  if (options.router) {
    require('./router')(api, options)
  }
  
  // 如果 preset 中包含 vuex
  if (options.vuex) {
    require('./vuex')(api, options)
  }
  
  // 如果 preset 中包含 cssPreprocessor，即选择了 css 预处理器
  if (options.cssPreprocessor) {
    const deps = {
      sass: {
        'node-sass': '^4.9.0',
        'sass-loader': '^7.0.1'
      },
      less: {
        'less': '^3.0.4',
        'less-loader': '^4.1.0'
      },
      stylus: {
        'stylus': '^0.54.5',
        'stylus-loader': '^3.0.2'
      }
    }

    api.extendPackage({
      devDependencies: deps[options.cssPreprocessor]
    })
  }

  // additional tooling configurations
  if (options.configs) {
    api.extendPackage(options.configs)
  }
}

```
看一下 `@vue/cli-service` generator 代码，然后结合 `GeneratorAPI` 所暴露的方法，自己再感悟下，大概就可以明白插件利用 GeneratorAPI 暴露的方法
做了一些什么事情，也可以初步感受到 vue-cli 3.0 的插件机制，将所有功能都交给插件去完成。对于 vue-cli 3.0 内置的插件，比如：`@vue/cli-plugin-eslint`
、`@vue/cli-plugin-pwa` 等等，以及其他第三方插件，他们的 `generator` 作用都是一样都可以向项目的 `package.json` 中注入额外的依赖或字段，并向项目中添加文件。


## extractConfigFiles










































