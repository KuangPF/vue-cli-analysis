# upgrade 命令

**源码目录：**  packages/@vue/cli-upgrade 。

**作用：**  升级 @vue/cli-service 和 vue-cli 插件。

`vue upgrade` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('upgrade [semverLevel]')
  .description('upgrade vue cli service / plugins (default semverLevel: minor)')
  .action((semverLevel, cmd) => {
    loadCommand('upgrade', '@vue/cli-upgrade')(semverLevel, cleanArgs(cmd))
  })
```
代码比较少，需要注意的就是 `semverLevel`，它用于指定安装 `@vue/cli-service || @vue/cli-plugin-*` 的版本号形式,可选择值有三个，默认值为 minor：

* **patch**： 升级到最新补丁版号
* **minor**： 升级到最新次版本号
* **major**： 升级到最新主版本号

先看下 `@vue/cli-upgrade/index.js` 代码，即 `upgrade` 命令执行的函数：

```js
module.exports = async function vueCliUpgrade (semverLevel = 'minor'){
  // get current deps
  // filter @vue/cli-service & @vue/cli-plugin-*
  const pkg = getPackageJson(projectPath)
  const upgradableDepMaps = new Map([
    ['dependencies', new Map()],
    ['devDependencies', new Map()],
    ['optionalDependencies', new Map()]
  ])

  logWithSpinner('Gathering update information...')
  for (const depType of upgradableDepMaps.keys()) {
    for (const [packageName, currRange] of Object.entries(pkg[depType] || {})) {
      if (!isCorePackage(packageName)) {
        continue
      }

      const upgradable = getUpgradableVersion(
        packageName,
        currRange,
        semverLevel
      )
      if (upgradable !== currRange) {
        upgradableDepMaps.get(depType).set(packageName, upgradable)
      }
    }
  }
  // some code ...
}
```
首先获取了项目的 `package.json`，然后获取其中的 dependencies，devDependencies，optionalDependencies。获取了这些依赖后利用 `isCorePackage`
过滤掉不是 `@vue/cli-service` 和 `@vue/cli-plugin-*` 的依赖，再分别获取过滤后的依赖需要更新到的版本号，获取版本号使用了 `getUpgradableVersion`
方法:

```js
module.exports = function getUpgradableVersion (
  packageName,
  currRange,
  semverLevel
) {
  let newRange
  if (semverLevel === 'patch') { // 安装最近的小版本依赖包， 补丁号
    const currMaxVersion = getMaxSatisfying(packageName, currRange)
    newRange = `~${currMaxVersion}`
    const newMaxVersion = getMaxSatisfying(packageName, newRange)
    newRange = `~${newMaxVersion}`
  } else if (semverLevel === 'minor') { // 安装最近大版本依赖包，次版本号
    const currMaxVersion = getMaxSatisfying(packageName, currRange)
    newRange = `^${currMaxVersion}` 
    const newMaxVersion = getMaxSatisfying(packageName, newRange)
    newRange = `^${newMaxVersion}`
  } else if (semverLevel === 'major') { // 主版本号
    newRange = `^${getMaxSatisfying(packageName, 'latest')}`
  } else {
    throw new Error('Release type must be one of patch | minor | major!')
  }

  return newRange
}
```
通过 `getMaxSatisfying` 方法执行 `npm view` 命令获取依赖的版本号，然后根据 semverLevel 确定版本号的形式并返回。如果返回的版本号与当前 `package.json`
里面依赖的不一致，则将需要升级的信息存在 table 中，以便后续利用 [cli-table](https://github.com/Automattic/cli-table) 
输出到控制台上，除此之外还将该依赖名称和需要升级的版本号存在 Map 结构中。

在此之后会遍历 `upgradableDepMaps`，判断依赖是否有更新信息，如果有则输出信息并询问是否需要安装依赖，否则直接退出。

