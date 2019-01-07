# Generator

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
* **extendPackage**：拓展 package.json 配置
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


在实例化 Generator 之后，就会调用实例的 generate 放在，此时就差不多进入到了生成项目文件的阶段了。大致可以分为三部分，extractConfigFiles（提取配置文件），
resolveFiles（模板渲染）和 writeFileTree（在磁盘上生成文件）。

## extractConfigFiles

提取配置文件指的是将一些插件（比如 eslint，babel）的配置从 `package.json` 的字段中提取到专属的配置文件中。下面以 eslint 为例进行分析：
在初始化项目的时候，如果选择了 eslint 插件，在调用 `@vue/cli-plugin-eslint` 的 generator 的时候，就会向 `package.json` 注入 eslintConfig 字段：

```js
module.exports = (api, { config, lintOn = [] }, _, invoking) => {
  if (typeof lintOn === 'string') {
    lintOn = lintOn.split(',')
  }

  const eslintConfig = require('../eslintOptions').config(api)

  const pkg = {
    scripts: {
      lint: 'vue-cli-service lint'
    },
    eslintConfig,
    // TODO:
    // Move these dependencies to package.json in v4.
    // Now in v3 we have to add redundant eslint related dependencies
    // in order to keep compatibility with v3.0.x users who defaults to ESlint v4.
    devDependencies: {
      'babel-eslint': '^10.0.1',
      'eslint': '^5.8.0',
      'esliint-plugin-vue': '^5.0.0-0'
    }
  }

  const injectEditorConfig = (config) => {
    const filePath = api.resolve('.editorconfig')
    if (fs.existsSync(filePath)) {
      // Append to existing .editorconfig
      api.render(files => {
        const configPath = path.resolve(__dirname, `./template/${config}/_editorconfig`)
        const editorconfig = fs.readFileSync(configPath, 'utf-8')

        files['.editorconfig'] += `\n${editorconfig}`
      })
    } else {
      api.render(`./template/${config}`)
    }
  }

  if (config === 'airbnb') {
    eslintConfig.extends.push('@vue/airbnb')
    Object.assign(pkg.devDependencies, {
      '@vue/eslint-config-airbnb': '^4.0.0'
    })
    injectEditorConfig('airbnb')
  } else if (config === 'standard') {
    eslintConfig.extends.push('@vue/standard')
    Object.assign(pkg.devDependencies, {
      '@vue/eslint-config-standard': '^4.0.0'
    })
    injectEditorConfig('standard')
  } else if (config === 'prettier') {
    eslintConfig.extends.push('@vue/prettier')
    Object.assign(pkg.devDependencies, {
      '@vue/eslint-config-prettier': '^4.0.0'
    })
    // prettier & default config do not have any style rules
    // so no need to generate an editorconfig file
  } else {
    // default
    eslintConfig.extends.push('eslint:recommended')
  }

  api.extendPackage(pkg)

}
```
这是 `@vue/cli-plugin-eslint/generator/index.js` 中的一部分代码，从代码中可以看出，利用  `GeneratorAPI` 的 `extendPackage` 方法向 `package.josn`
里面注入了 scripts，eslintConfig 以及 devDependencies 字段，另外也会根据选择的 eslint 模式添加对应的依赖和修改对应的配置文件，例如选择了 airbnb 
模式，就会向 `eslintConfig.extends` 添加 `@vue/airbnb` 配置，并且添加 `@vue/eslint-config-airbnb` 依赖和修改 `.editorconfig` 配置文件。此时 
项目 `package.json` 中 `eslintConfig` 字段内容如下：

```json
{
"eslintConfig": {
    "root": true,
    "env": {
      "node": true
    },
    "extends": [
      "plugin:vue/essential",
      "@vue/airbnb"
    ],
    "rules": {},
    "parserOptions": {
      "parser": "babel-eslint"
    }
  }
}
```
如果 preset 的 `useConfigFiles` 为 true ，或者以 Manually 模式初始化 preset 的时候选择 In dedicated config files 存放配置文件:

<img :src="$withBase('/assets/create-img03.png')">

那么 `extractConfigFiles` 方法就会将 `package.json` 中 eslintConfig 字段内容提取到 `.eslintrc.js` 文件中，内存中 `.eslintrc.js` 内容如下：

```js
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'plugin:vue/essential',
    '@vue/airbnb',
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
  },
  parserOptions: {
    parser: 'babel-eslint',
  },
};

```
`extractConfigFiles` 方法的具体实现主要是调用 `ConfigTransform` 实例的 `transform` 方法，代码实现的比较清晰，各位同学可以自己看下。这里就不做详细
分析了，在配置文件提取完了以后接下来就是执行 `resolveFiles` 函数了。

## resolveFiles

resolveFiles 主要分为以下三个部分执行：

* **fileMiddlewares**
* **injectImportsAndOptions**
* **postProcessFilesCbs**

`fileMiddlewares` 里面包含了 `ejs render` 函数，所有插件调用 `api.render` 时候只是把对应的渲染函数 push 到了 `fileMiddlewares` 中，等所有的
插件执行完以后才会遍历执行 `fileMiddlewares` 里面的所有函数，即在内存中生成模板文件字符串。

`injectImportsAndOptions` 就是将 generator 注入的 import 和 rootOption 解析到对应的文件中，比如选择了 vuex, 会在 `src/main.js` 中添加 `import store 
from './store'`，以及在 vue 根实例中添加 router 选项。

`postProcessFilesCbs` 是在所有普通文件在内存中渲染成字符串完成之后要执行的遍历回调。例如将 `@vue/cli-service/generator/index.js` 中的 render 是放在了 `fileMiddlewares` 里面，而将
`@vue/cli-service/generator/router/index.js` 中将替换 `src/App.vue` 文件的方法放在了 `postProcessFiles` 里面，原因是对 `src/App.vue` 
文件的一些替换一定是发生在 render 函数之后，如果在之前，修改后的 src/App.vue 在之后 render 函数执行时又会被覆盖，这样显然不合理。

## writeFileTree

在提取了配置文件和模板渲染之后调用了 `sortPkg` 对 `package.json` 的字段进行了排序并将 `package.json` 转化为 json 字符串添加到项目的 files 中。
此时整个项目的文件已经在内存中生成好了（在源码中就是对应的 this.files），接下来就调用 `writeFileTree` 方法将内存中的字符串模板文件生成在磁盘中。到这里
`vue create` 核心部分 generator 基本上就分析完了，在下一节就分析 `vue create` 命令剩下的部分。



























