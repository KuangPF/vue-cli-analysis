# 基础验证

当执行 `vue create` 命令的时候会加载 `cli/lib/create.js` 中的 `create` 函数。在 `create` 函数里会先定义以下几个变量：

``` js
const cwd = options.cwd || process.cwd() // 当前目录
const inCurrent = projectName === '.' // 是否在当前目录
const name = inCurrent ? path.relative('../', cwd) : projectName // 项目名称
const targetDir = path.resolve(cwd, projectName || '.') // 生成项目的目录
```
比较重要的就是 `name` 和 `targetDir` 这两个，在下面函数运行过程中会使用到。接下来执行函数 `validateProjectName` 利用 npm 包 
[validate-npm-package-name](https://github.com/npm/validate-npm-package-name) 判断项目名称是否符合 npm 包名规范，并输出相应的 errors 或者 
warnings。

在验证包名之后，会判断项目目录是否与当前已有目录重复。

```js
if (fs.existsSync(targetDir)) {
  if (options.force) {
    await fs.remove(targetDir)
  } else {
    await clearConsole()
    if (inCurrent) {
      const { ok } = await inquirer.prompt([
        {
          name: 'ok',
          type: 'confirm',
          message: `Generate project in current directory?`
        }
      ])
      if (!ok) {
        return
      }
    } else {
      const { action } = await inquirer.prompt([
        {
          name: 'action',
          type: 'list',
          message: `Target directory ${chalk.cyan(targetDir)} already exists. Pick an action:`,
          choices: [
            { name: 'Overwrite', value: 'overwrite' },
            { name: 'Merge', value: 'merge' },
            { name: 'Cancel', value: false }
          ]
        }
      ])
      if (!action) {
        return
      } else if (action === 'overwrite') {
        console.log(`\nRemoving ${chalk.cyan(targetDir)}...`)
        await fs.remove(targetDir)
      }
    }
  }
}
```
这段代码比较容易读懂，主要就是当存在相同项目目录的时候调用 `inquirer.prompt` 来询问是否要 Overwrite || Merge || Cancel。

::: tip
当带有 `-f || --force` 的时候会跳过这些交互，即 `options.force = true`。
:::
基础验证这快大致就这些，下一个开始分析获取预设选项(preset)。
