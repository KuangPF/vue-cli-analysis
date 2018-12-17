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


