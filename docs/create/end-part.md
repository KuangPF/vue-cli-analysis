# 结尾分析

在分析了 Generator 之后可能会有点晕晕的，毕竟 Generator 是 `vue create` 最核心的部分，而 `vue create` 又是 `@vue/cli` 中最核心的部分之一。
没关系，结尾分析这部分比较容易理解，看一下代码就知道结尾做了写什么事了，那就直接看下代码清醒下：

```js
// install additional deps (injected by generators)
log(`📦  Installing additional dependencies...`)
this.emit('creation', { event: 'deps-install' })
log()
if (!isTestOrDebug) {
  await installDeps(context, packageManager, cliOptions.registry)
}

// run complete cbs if any (injected by generators)
logWithSpinner('⚓', `Running completion hooks...`)
this.emit('creation', { event: 'completion-hooks' })
for (const cb of createCompleteCbs) {
  await cb()
}

// generate README.md
stopSpinner()
log()
logWithSpinner('📄', 'Generating README.md...')
await writeFileTree(context, {
  'README.md': generateReadme(generator.pkg, packageManager)
})

// commit initial state
let gitCommitFailed = false
if (shouldInitGit) {
  await run('git add -A')
  if (isTestOrDebug) {
    await run('git', ['config', 'user.name', 'test'])
    await run('git', ['config', 'user.email', 'test@test.com'])
  }
  const msg = typeof cliOptions.git === 'string' ? cliOptions.git : 'init'
  try {
    await run('git', ['commit', '-m', msg])
  } catch (e) {
    gitCommitFailed = true
  }
}

// log instructions
stopSpinner()
log()
log(`🎉  Successfully created project ${chalk.yellow(name)}.`)
log(
  `👉  Get started with the following commands:\n\n` +
  (this.context === process.cwd() ? `` : chalk.cyan(` ${chalk.gray('$')} cd ${name}\n`)) +
  chalk.cyan(` ${chalk.gray('$')} ${packageManager === 'yarn' ? 'yarn serve' : 'npm run serve'}`)
)
log()
this.emit('creation', { event: 'done' })

if (gitCommitFailed) {
  warn(
    `Skipped git commit due to missing username and email in git config.\n` +
    `You will need to perform the initial commit yourself.\n`
  )
}

generator.printExitLogs()
```
可以分为以下4个部分来进行介绍：
* **安装额外依赖**
* **执行 createCompleteCbs**
* **生成 README.md**
* **git 初始化提交**
* **日志输出**


## 安装额外依赖

这里的依赖来源于 preset 的 option，比如选择了 `scss` css 预处理器，那么就需要额外安装 `node-sass` 和 `sass-loader` 两个依赖。

## createCompleteCbs

所有文件都写在磁盘后执行地遍历回调。`@vue/cli-plugin-eslint` 的 generator 就注入了 `createCompleteCbs`，源码如下：

```js
// lint & fix after create to ensure files adhere to chosen config
if (config && config !== 'base') {
  api.onCreateComplete(() => {
    require('../lint')({ silent: true }, api)
  })
}
```
他的作用就是对生成后的文件进行 `lint & fix`，保证符合 elsit 所选的配置。

## 生成 README.md

生成 README.md，这里需要注意的一点就是，调用的 `generateReadme` 函数会根据 `package.json` 的 script 的字段生成生成对应的 `README.md。`


## git 初始化提交

git 初始化提交主要就是调用 `shouldInitGit` 来判断是否需要 git 初始化提交，如果需要初始化提交就会执行 `git add` 和 `git commmit` 命令，
只有在以下这种情况会 git 初始化提交：

* --git: vue create 含有 -g 或者 --git 选项


## 日志输出

插件的 generator 可以利用 `GeneratorAPI` 暴露的 `exitLog` 方法在项目输出其他所有的 message 之后输出一些日志。











