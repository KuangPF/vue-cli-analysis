# 总结

vue-cli 3.0 中 UI 系统应该是一个亮点，通过完整的 GUI 形式来管理整个 vue 项目，ui 命令涉及的知识应该算是比较多的，在刚开始分析的时候由于对 graphql 了解的比较少，对代码的整个运行不是很清楚，在了解 graphql 以及 vue-apollo 之后，对于 ui 命令的代码就有了思路。ui 系统其实也是基于插件机制的，比较核心的就是 PluginAPI，通过分析打开项目 `importProject` 可以比较清楚的了解 UI 插件是如何利用 PluginAPI 来增强项目的配置和任务，如果对 PluginAPI 不是很清楚的话可以看下 `packages/@vue/cli-ui-addon-webpack` 代码，`cli-ui-addon-webpack` 创建了项目任务模块中 webpack 客户端 addon（serve，build）。

vue-cli 3.0 中核心部分是 [Creator](https://github.com/vuejs/vue-cli/blob/dev/packages/%40vue/cli/lib/Creator.js) 和 [Service](https://github.com/vuejs/vue-cli/blob/dev/packages/%40vue/cli-service/lib/Service.js), 可在 create 部分可 vue-cli-service 部分查看具体分析 ，ui 命令是一个 GUI 的形式，在后台运行的还是 nodejs 代码，比如点击创建项目的时候还是会引入`@vue/cli/lib/Creator` 并执行，点击任务看板中的 “运行” 实质执行的是 `vue-cli-service serve` 命令。