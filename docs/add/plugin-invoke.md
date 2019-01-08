# 调用插件

对于第三方插件安装完成之后，先调用 `invoke` 方法，该方法实现如下：

```js
async function invoke (pluginName, options = {}, context = process.cwd()) {
  delete options._
  const pkg = getPkg(context) // 解析 package.json

  // attempt to locate the plugin in package.json
  const findPlugin = deps => {
    if (!deps) return
    let name
    // official
    if (deps[(name = `@vue/cli-plugin-${pluginName}`)]) {
      return name
    }
    // full id, scoped short, or default short
    if (deps[(name = resolvePluginId(pluginName))]) {
      return name
    }
  }

  const id = findPlugin(pkg.devDependencies) || findPlugin(pkg.dependencies)
  if (!id) {
    throw new Error(
      `Cannot resolve plugin ${chalk.yellow(pluginName)} from package.json. ` +
        `Did you forget to install it?`
    )
  }

  const pluginGenerator = loadModule(`${id}/generator`, context)
  if (!pluginGenerator) {
    throw new Error(`Plugin ${id} does not have a generator.`)
  }

  // resolve options if no command line options (other than --registry) are passed,
  // and the plugin contains a prompt module.
  // eslint-disable-next-line prefer-const
  let { registry, ...pluginOptions } = options
  if (!Object.keys(pluginOptions).length) {
    let pluginPrompts = loadModule(`${id}/prompts`, context)
    if (pluginPrompts) {
      if (typeof pluginPrompts === 'function') {
        pluginPrompts = pluginPrompts(pkg)
      }
      if (typeof pluginPrompts.getPrompts === 'function') {
        pluginPrompts = pluginPrompts.getPrompts(pkg)
      }
      pluginOptions = await inquirer.prompt(pluginPrompts)
    }
  }

  const plugin = {
    id,
    apply: pluginGenerator,
    options: {
      registry,
      ...pluginOptions
    }
  }

  await runGenerator(context, plugin, pkg)
}

```
该方法先调用 `findPlugin` 判断插件是否安装，接着判断是否有 `generator（pluginGenerator）`，然后就是判断插件是否含有 `prompt`。如果有则调用
`inquirer.prompt` 获取插件的 `option`，并传给其 `generator`，在完成这些以后，就是 `runGenerator`。

而对于 `vue-cli` 内部一些特殊的"插件"，比如 `router，vuex`就直接调用 `runGenerator`。

如果你看了 `vue create` 分析部分的 `Generator` 的话，接下来就比较轻松了。`runGenerator` 的实质就是构造一个 `Generator` 实例，并调用其 `generate` 方法。
如果对 `generate` 方法还不熟悉的话，可查看下 `vue create` 部分。 在实例的 `generator` 方法调用完成之后执行以下命令：

```bash
git ls-files --exclude-standard --modified --others
```
因为插件的 `generator` 可以通过 `GeneratorAPI` 暴露的 `render` 和 `extendPackage` 方法修改项目的文件，因此通过执行该命令将变化的文件显示在
终端上，这对开发者十分地友好。
