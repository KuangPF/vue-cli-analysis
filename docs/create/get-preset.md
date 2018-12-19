# 获取预设选项

在开始分析之前简单描述下什么是 `vue-cli-preset`，
**一个 Vue CLI preset 是一个包含创建新项目所需预定义选项和插件的 JSON 对象，让用户无需在命令提示中选择它们:**
```json
{
  "useConfigFiles": true,
  "router": true,
  "vuex": true,
  "cssPreprocessor": "sass",
  "plugins": {
    "@vue/cli-plugin-babel": {},
    "@vue/cli-plugin-eslint": {
      "config": "airbnb",
      "lintOn": ["save", "commit"]
    }
  }
}
```
更多关于 `preset` 可以前往 `vue-cli` 官网 [插件和 Preset#](https://cli.vuejs.org/zh/guide/plugins-and-presets.html#插件)。

在基础验证完成以后会创建一个 `Creator` 实例:
```js
const creator = new Creator(name, targetDir, getPromptModules())
```

## getPromptModules

在分析 `Creator` 之前先看下 `getPromptModules()` 获取到的是什么。`getPromptModules()` 获取了 babel，typescript，pwa，router，vuex，
cssPreprocessors，linter，unit，e2e 的 `Prompt` 的配置信息，以 unit 为例：
```js
module.exports = cli => {
  cli.injectFeature({
    name: 'Unit Testing',
    value: 'unit',
    short: 'Unit',
    description: 'Add a Unit Testing solution like Jest or Mocha',
    link: 'https://cli.vuejs.org/config/#unit-testing',
    plugins: ['unit-jest', 'unit-mocha']
  })

  cli.injectPrompt({
    name: 'unit',
    when: answers => answers.features.includes('unit'),
    type: 'list',
    message: 'Pick a unit testing solution:',
    choices: [
      {
        name: 'Mocha + Chai',
        value: 'mocha',
        short: 'Mocha'
      },
      {
        name: 'Jest',
        value: 'jest',
        short: 'Jest'
      }
    ]
  })

  cli.onPromptComplete((answers, options) => {
    if (answers.unit === 'mocha') {
      options.plugins['@vue/cli-plugin-unit-mocha'] = {}
    } else if (answers.unit === 'jest') {
      options.plugins['@vue/cli-plugin-unit-jest'] = {}
    }
  })
}
```

**cli.injectFeature**

`cli.injectFeature` 是注入 `featurePrompt`，即初始化项目时选择 babel，typescript，pwa 等等，如下图：

<img :src="$withBase('/assets/create-img01.png')">

**cli.injectPrompt**

`cli.injectPrompt` 是根据选择的 `featurePrompt` 然后注入对应的 `prompt`，当选择了 unit，接下来会有以下的 `prompt`，选择 `Mocha + Chai` 还是 `Jest`：

<img :src="$withBase('/assets/create-img02.png')">

**cli.onPromptComplete**

`cli.onPromptComplete` 就是一个回调，会根据选择来添加对应的插件， 当选择了 mocha ，那么就会添加 `@vue/cli-plugin-unit-mocha` 插件。


## new Creator()

搞清楚了 `getPromptModules` 之后，下面开始看一下初始化 `Creator` 实例发生了什么，直接看代码：
```js
constructor (name, context, promptModules) {
    super()
    this.name = name
    this.context = process.env.VUE_CLI_CONTEXT = context
    const { presetPrompt, featurePrompt } = this.resolveIntroPrompts() // 获取了 presetPrompt list，在初始化项目的时候提供选择
    this.presetPrompt = presetPrompt // presetPrompt list
    this.featurePrompt = featurePrompt // babal, pwa, e2e etc.
    this.outroPrompts = this.resolveOutroPrompts() //  存放项目配置的文件（package.json || congfig.js） 以及是否将 presetPrompts 存放起来
    this.injectedPrompts = [] // 对应 feature 的 Prompts
    this.promptCompleteCbs = [] // injectedPrompts 的回调
    this.createCompleteCbs = []

    this.run = this.run.bind(this)

    const promptAPI = new PromptModuleAPI(this)

    /**
     * 1. 将 babel, e2e, pwa 等 push 到 featurePrompt.choices 中，在选择项目需要配置哪些时显示出来 （checkbox）；
     * 2. 将 babel, e2e, pwa 等 push 到 injectedPrompts 中，当设置了 feature 会对应通过 Prompts 来进一步选择哪种模式，比如当选择了 E2E Testing ，然后会再次让你
     *    选择哪种 E2E Testing，即， Cypress (Chrome only) ||  Nightwatch (Selenium-based)；
     * 3. 将每中 feature 的 onPromptComplete push 到 promptCompleteCbs，在后面会根据选择的配置来安装对应的 plugin。
     */
    promptModules.forEach(m => m(promptAPI))
  }
```
这段代码主要看下 `PromptModuleAPI`，源码如下：

```js
module.exports = class PromptModuleAPI {
  constructor (creator) {
    this.creator = creator
  }

  injectFeature (feature) {
    this.creator.featurePrompt.choices.push(feature)
  }

  injectPrompt (prompt) {
    this.creator.injectedPrompts.push(prompt)
  }

  injectOptionForPrompt (name, option) {
    this.creator.injectedPrompts.find(f => {
      return f.name === name
    }).choices.push(option)
  }

  onPromptComplete (cb) {
    this.creator.promptCompleteCbs.push(cb)
  }
}
```

`PromptModuleAPI` 实例会调用它的实例方法，然后将 `injectFeature`， `injectPrompt`， `injectOptionForPrompt`， `onPromptComplete`保存到 
`Creator`实例对应的变量中。

最后遍历 `getPromptModules` 获取的 `promptModules`，传入实例 `promptAPI`，初始化 `Creator` 实例中 `featurePrompt`, `injectedPrompts`, 
`promptCompleteCbs` 变量。

## getPreset

在创建一个 Creator 实例后，然后调用了 create 方法

```js
await creator.create(options)
```
create 开始是获取 preset ，源码如下：

```js
const isTestOrDebug = process.env.VUE_CLI_TEST || process.env.VUE_CLI_DEBUG
console.log('before creating......')
// name: demo
// context: targetDir
const { run, name, context, createCompleteCbs } = this

if (!preset) {
  if (cliOptions.preset) {
    // vue create foo --preset bar
    preset = await this.resolvePreset(cliOptions.preset, cliOptions.clone)
  } else if (cliOptions.default) {
    // vue create foo --default
    preset = defaults.presets.default // 使用默认预设选项
  } else if (cliOptions.inlinePreset) { // 使用内联的 JSON 字符串预设选项
    // vue create foo --inlinePreset {...}
    try {
      preset = JSON.parse(cliOptions.inlinePreset)
    } catch (e) {
      error(`CLI inline preset is not valid JSON: ${cliOptions.inlinePreset}`)
      exit(1)
    }
  } else {
    // eg: vue create demo
    preset = await this.promptAndResolvePreset()
  }
}

// clone before mutating
preset = cloneDeep(preset)
// inject core service
preset.plugins['@vue/cli-service'] = Object.assign({ // 注入核心 @vue/cli-service
  projectName: name
}, preset, {
  bare: cliOptions.bare
})
```
先判断 `vue create` 命令是否带有 -p 选项，如果有的话会调用 `resolvePreset` 去解析 preset。`resolvePreset` 函数会先获取 ～/.vuerc 中保存的 preset，
然后进行遍历，如果里面包含了 -p 中的 `<presetName>`，则返回～/.vuerc 中的 preset。如果没有则判断是否是采用内联的 JSON 字符串预设选项，如果是就会解析
.json 文件，并返回 preset，还有一种情况就是从远程获取 preset（利用 `download-git-repo` 下载远程的 preset.json）并返回。

上面的情况是当 `vue create` 命令带有 -p 选项的时候才会执行，如果没有就会调用 promptAndResolvePreset 函数利用 inquirer.prompt 以命令后交互的形式来获取
preset，下面看下 promptAndResolvePreset 函数的源码：

```js
async promptAndResolvePreset (answers = null) {
  // prompt
  if (!answers) {
    await clearConsole(true)
    answers = await inquirer.prompt(this.resolveFinalPrompts())
  }
  debug('vue-cli:answers')(answers)
  
  if (answers.packageManager) {
    saveOptions({
      packageManager: answers.packageManager
    })
  }
  
  let preset
  if (answers.preset && answers.preset !== '__manual__') { // 如果是选择使用本地保存的 preset (~/.vuerc)
    preset = await this.resolvePreset(answers.preset)
  } else {
    // manual
    preset = {
      useConfigFiles: answers.useConfigFiles === 'files',
      plugins: {}
    }
    answers.features = answers.features || []
    // run cb registered by prompt modules to finalize the preset
    this.promptCompleteCbs.forEach(cb => cb(answers, preset))
  }
  
  // validate
  validatePreset(preset)
  
  // save preset
  if (answers.save && answers.saveName) {
    savePreset(answers.saveName, preset)
  }
  
  debug('vue-cli:preset')(preset)
  return preset
}
```
在调用 `inquirer.prompt` 之前利用 `this.resolveFinalPrompts()` 获取了最后的 prompts，到这里有些同学可能就有点晕了，到底有多少个 prompt，别急，下面将
简单介绍下，查看 `this.resolveFinalPrompts()` 源码：

```js
resolveFinalPrompts () {
  // patch generator-injected prompts to only show in manual mode
  // 将所有的 Prompt 合并，包含 preset，feature，injected，outro，只有当选择了手动模式的时候才会显示 injectedPrompts
  this.injectedPrompts.forEach(prompt => {
    const originalWhen = prompt.when || (() => true)
    prompt.when = answers => {
      return isManualMode(answers) && originalWhen(answers)
    }
  })
  const prompts = [
    this.presetPrompt,
    this.featurePrompt,
    ...this.injectedPrompts,
    ...this.outroPrompts
  ]
  debug('vue-cli:prompts')(prompts)
  return prompts
}
```
比较容易的就可以看出作用就是将 presetPrompt， featurePrompt， injectedPrompts， outroPrompts 合并成一个数组进行返回，这几个 Prompt 的含义如下：

* **presetPrompt**： 预设选项 prompt，当上次以 Manually 模式进行了预设选项，并且保存到了 ~/.vuerc 中，那么在初始化项目时就会列出已经保存的 preset，并提供选择。
* **featurePrompt**：项目的一些 feature，就是选择 babel，typescript，pwa，router，vuex，cssPreprocessors，linter，unit，e2e。
* **injectedPrompts**：当选择了 feature 后，就会为对应的 feature 注入 prompts，比如你选择了 unit，那么就会让你选择模式： `Mocha + Chai` 还是 `Jest`
* **outroPrompts**： 其他的 prompt，包含：
  * 将 Babel, PostCSS, ESLint 等等的配置文件存放在 package.json 中还是存放在 config 文件中；
  * 是否需要将这次设置的 preset 保存到本地，如果需要则会进一步让你输入名称进行保存；
  * 安装依赖是选择 npm 还是 yarn。
  
`inquirer.prompt` 执行完成后会返回 answers，如果选择了本地保存的 preset 或者 default，则调用 `resolvePreset` 进行解析 preset，否则遍历 
`promptCompleteCbs` 执行 injectFeature 和 injectPrompt 的回调，将对应的插件赋值到 `options.plugins` 中，以 unit 为例：

```js
cli.onPromptComplete((answers, options) => {
  if (answers.unit === 'mocha') {
    options.plugins['@vue/cli-plugin-unit-mocha'] = {}
  } else if (answers.unit === 'jest') {
    options.plugins['@vue/cli-plugin-unit-jest'] = {}
  }
})
```
如果 feature 选择了 unit，并且 unit 模式选择的是 Mocha + Chai，则添加 `@vue/cli-plugin-unit-mocha` 插件，如果选择的是 Jest 则添加 
`@vue/cli-plugin-unit-jest` 插件。

在获取到 preset 之后，还会向 preset 的插件里面注入核心插件 `@vue/cli-service`， 它是调用 `vue-cli-service <command> [...args]` 时创建的类。
负责管理内部的 webpack 配置、暴露服务和构建项目的命令等。

到这里获取预设选项（preset）大致分析完了，在下节将会分析依赖的安装。
