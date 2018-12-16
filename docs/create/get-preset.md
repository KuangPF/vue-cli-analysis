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
