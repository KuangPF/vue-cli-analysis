# 安装插件

`vue add` 和 `vue invoke` 两个命令其实有很多相同的地方，即 `vue add` 包含了 `vue invoke` 的功能，另外还多了一个插件安装的功能，下面就直接看下代码。

```js
module.exports = (...args) => {
  return add(...args).catch(err => {
    error(err)
    if (!process.env.VUE_CLI_TEST) {
      process.exit(1)
    }
  })
}
```
加载 `add.js` 脚本就会调用 `add` 函数，接着看 `add` 函数的代码：

```js
async function add (pluginName, options = {}, context = process.cwd()) {
  // special internal "plugins"
  // 内部 plugin
  if (/^(@vue\/)?router$/.test(pluginName)) { // 匹配 @vue/router，router。 ? 表示匹配前面的子表达式零次或一次
    return addRouter(context)
  }
  if (/^(@vue\/)?vuex$/.test(pluginName)) { // 匹配 @vue/vuex，vuex
    return addVuex(context)
  }

  // 解析插件名称
  // full id, scoped short, or default short
  // @bar/foo => @bar/vue-cli-plugin-foo
  // @vue/foo => @vue/cli-plugin-foo
  // foo => vue-cli-plugin-foo
  const packageName = resolvePluginId(pluginName)

  log()
  log(`📦  Installing ${chalk.cyan(packageName)}...`)
  log()

  const packageManager = loadOptions().packageManager || (hasProjectYarn(context) ? 'yarn' : 'npm')
  await installPackage(context, packageManager, options.registry, packageName)

  log(`${chalk.green('✔')}  Successfully installed plugin: ${chalk.cyan(packageName)}`)
  log()

  const generatorPath = resolveModule(`${packageName}/generator`, context)
  if (generatorPath) {
    invoke(pluginName, options, context)
  } else {
    log(`Plugin ${packageName} does not have a generator to invoke`)
  }
}

```

`add` 函数并不复杂，主要就是安装插件包，对于 `vue-cli` 内部一些特殊的"插件"，比如 `router，vuex`，就不会通过包管理器安装，而是直接加载
`@vue/cli-service/generator/router` 和 `@vue/cli-service/generator/vuex`，这两个文件也是两个 `generator`，可以向 `package.json` 
注入额外的依赖或字段，并向项目中添加文件，对于普通的第三方插件，就需要通过包管理器安装了。

安装第三方插件这部分比较重要的就是解析插件的名称，即 `resolvePluginId`，还是看下 `resolvePluginId` 的实现：

```js
exports.resolvePluginId = id => {
  // already full id
  // e.g. vue-cli-plugin-foo, @vue/cli-plugin-foo, @bar/vue-cli-plugin-foo
  if (pluginRE.test(id)) { // const pluginRE = /^(@vue\/|vue-|@[\w-]+\/vue-)cli-plugin-/
    return id
  }
  // scoped short
  // e.g. @vue/foo, @bar/foo
  // @vue/foo => @vue/cli-plugin-foo
  // @bar/foo => @bar/vue-cli-plugin-foo
  if (id.charAt(0) === '@') {
    const scopeMatch = id.match(scopeRE)
    if (scopeMatch) {
      const scope = scopeMatch[0]
      const shortId = id.replace(scopeRE, '')
      return `${scope}${scope === '@vue/' ? `` : `vue-`}cli-plugin-${shortId}`
    }
  }
  // default short
  // e.g. foo
  return `vue-cli-plugin-${id}`
}
```
看一下代码应该就比较清楚它的作用了，就是将 `full id ，scoped short 以及 default short` 解析成完整的插件名称。在 `vue-cli` 官方文档中对插件
的命名有着明确的要求，即命名方式为：`vue-cli-plugin-<name>`，插件遵循命名约定之后就可以：

* 被 `@vue/cli-service` 发现；
* 被其它开发者搜索到；
* 通过 `vue add <name>` 或 `vue invoke <name>` 安装下来。

在获取第三方插件名称后，就会调用 `installPackage` 安装插件包，接下来就是调用插件的 `generator` 了，调用插件将在下一节分析。
