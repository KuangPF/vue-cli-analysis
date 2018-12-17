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
