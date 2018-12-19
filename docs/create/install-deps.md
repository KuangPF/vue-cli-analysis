# 依赖安装

在上节中我们分析了获取 `preset` ，通过 `preset` 我们可以知道每个 `feature` 的配置以及整个项目所需的一些插件，接下来我们继续看源码。
```js
const packageManager = (
  cliOptions.packageManager ||
  loadOptions().packageManager ||
  (hasYarn() ? 'yarn' : 'npm')
)

await clearConsole() // 清空控制台
logWithSpinner(`✨`, `Creating project in ${chalk.yellow(context)}.`)
this.emit('creation', { event: 'creating' })

// get latest CLI version
const { latest } = await getVersions()
// generate package.json with plugin dependencies
const pkg = {
  name,
  version: '0.1.0',
  private: true,
  devDependencies: {}
}
const deps = Object.keys(preset.plugins)
deps.forEach(dep => {
  if (preset.plugins[dep]._isPreset) {
    return
  }
  pkg.devDependencies[dep] = (
    preset.plugins[dep].version ||
    ((/^@vue/.test(dep) && latest[dep]) ? `^${latest[dep]}` : `latest`)
  )
})
// write package.json
await writeFileTree(context, {
  'package.json': JSON.stringify(pkg, null, 2)
})
```
这段代码主要有两个作用：**获取最新 CLI （包含插件）的版本** 和 **生成 package.json**，接下来一个一个地看。

## getVersions
