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
getVersions 的代码不多，看下比较核心的代码：

```js
module.exports = async function getVersions () {
  if (sessionCached) {
    return sessionCached
  }

  let latest
  const local = require('vue-cli-version-marker').devDependencies
  if (process.env.VUE_CLI_TEST || process.env.VUE_CLI_DEBUG) {
    return (sessionCached = {
      current: local,
      latest: local
    })
  }

  if (!fs.existsSync(fsCachePath)) {
    // if the cache file doesn't exist, this is likely a fresh install
    // then create a cache file with the bundled version map
    await fs.writeFile(fsCachePath, JSON.stringify(local))
  }

  const cached = JSON.parse(await fs.readFile(fsCachePath, 'utf-8'))
  const lastChecked = (await fs.stat(fsCachePath)).mtimeMs
  const daysPassed = (Date.now() - lastChecked) / (60 * 60 * 1000 * 24)
  if (daysPassed > 1) { // 距离上次检查更新超过一天
    // if we haven't check for a new version in a day, wait for the check
    // before proceeding
    latest = await getAndCacheLatestVersions(cached)
  } else {
    // Otherwise, do a check in the background. If the result was updated,
    // it will be used for the next 24 hours.
    getAndCacheLatestVersions(cached) // 后台更新
    latest = cached
  }

  return (sessionCached = {
    current: local,
    latest
  })
}
```
这段代码按顺序读下应该就知道其中的作用了，简单说下就注意两个变量：
* local：本地 CLI 以及插件的版本
* latest：远程 CLI 以及插件的版本

local 和 latest 包含了 CLI 以及相关插件的版本，它们可以用于判断 @vue/cli 是否需要更新以及初始化项目中相关插件的版本。还有点需要注意的是，获取 CLI 的版本并不是直接获取，
而是通过 [vue-cli-version-marker](https://github.com/vuejs/vue-cli/blob/dev/packages/vue-cli-version-marker/package.json) npm 包获取的
 CLI 版本，为什么会这样做，主要原因有两点：

* 1. vue-cli 从 3.0（@vue/cli） 开始就放在了 @vue 下面，即是一个 scoped package, 而 scoped package 又不支持通过 `npm registry` 来获取 
latest 版本信息。比如 [vue-cli-version-marker/latest](https://registry.npmjs.org/vue-cli-version-marker/latest)可以正常访问，而 
[@vue/cli/latest](https://registry.npmjs.org/@vue/cli/latest)
则不可以。
* 2. 获取 scoped packages 的数据比获取 unscoped package 通常要慢 300ms。

正是由于上述两个原因，因此通过 unscoped package `vue-cli-version-marker` 来获取 CLI 版本，`vue-cli-version-marker` 的内容比较简单，就是一个 
package.json，通过获取里面 devDependencies 的版本信息，从而获取 @vue/cli 以及一些插件的版本号。获取了插件版本之后遍历 preset 中所有 plugin 为其初始化版本号，并调用 
`writeFileTree` 生成 package.json 。

## installDeps

在生成 package.json 之后，我们再继续看下面的代码：
```js
// intilaize git repository before installing deps
// so that vue-cli-service can setup git hooks.
const shouldInitGit = await this.shouldInitGit(cliOptions)
if (shouldInitGit) {
  logWithSpinner(`🗃`, `Initializing git repository...`)
  this.emit('creation', { event: 'git-init' })
  await run('git init')
}

// install plugins
stopSpinner()
log(`⚙  Installing CLI plugins. This might take a while...`)
log()
this.emit('creation', { event: 'plugins-install' })
if (isTestOrDebug) {
  // in development, avoid installation process
  await require('./util/setupDevProject')(context) // @vue/cli-service/bin/vue-cli-service
} else {
  await installDeps(context, packageManager, cliOptions.registry)
}
```
这段代码会先调用 shouldInitGit 来判断是否需要 git 初始化，判断的情形有以下几种：
* 没有安装 git (`!hasGit()`)：false；
* vue create 含有 --git 或者 -g 选项：true；
* vue create 含有 --no-git 或者 -n 选项：false；
* 生成项目的目录是否已经含有 git （`!hasProjectGit(this.context)`）：如果有，则返回 false，否则返回 true。

在判断完是否需要 git 初始化项目后，接下来就会调用 installDeps 安装依赖，还是看下 installDeps 的源码：
```js
exports.installDeps = async function installDeps (targetDir, command, cliRegistry) {
  const args = []
  if (command === 'npm') {
    args.push('install', '--loglevel', 'error')
  } else if (command === 'yarn') {
    // do nothing
  } else {
    throw new Error(`Unknown package manager: ${command}`)
  }

  await addRegistryToArgs(command, args, cliRegistry)

  debug(`command: `, command) // DEBUG=vue-cli:install vue create demo
  debug(`args: `, args)

  await executeCommand(command, args, targetDir)
}
```
源码很简洁，里面又先调用了 `addRegistryToArgs` 函数，它的作用就是安装依赖是指定安装源，如果 `vue create` 还有 -r 选项则采用设置的安装源，否则调用 `shouldUseTaobao` 
函数来判断是否需要使用淘宝 NPM 镜像源。实现原理就是发送两个 Promise 使用默认安装源和淘宝镜像源去请求同一个 npm 包，然后利用 `Promise.race` 看在哪种源下返回结果更快就将此
设置为安装源，另外如果 ~/.vuerc 中设置了`useTaobaoRegistry`，则使用设置的安装源。设置了安装源之后则调用 `executeCommand` 函数利用 execa 执行 npm 或者 yarn 安装命令。

到这里安装依赖就大致介绍完了，在下面一节将介绍 `vue create` 核心部分 `Generator`。
