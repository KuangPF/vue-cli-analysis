# build 命令

**源码目录：**  packages/@vue/cli-service-globa 。

**作用：**  在生产环境模式下零配置构建一个 .js 或 .vue 文件 。

`vue build` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('build [entry]')
  .description('build a .js or .vue file in production mode with zero config')
  .option('-t, --target <target>', 'Build target (app | lib | wc | wc-async, default: app)')
  .option('-n, --name <name>', 'name for lib or web-component mode (default: entry filename)')
  .option('-d, --dest <dir>', 'output directory (default: dist)')
  .action((entry, cmd) => {
    loadCommand('build', '@vue/cli-service-global').build(entry, cleanArgs(cmd))
  })
```

与 `vue serve` 命令类似，当执行 `vue build` 命令时会执行 `@vue/cli-service-global` 的 `build` 方法，那就直接看 `build` 方法源码：

```js
exports.build = (_entry, args) => {
  const { context, entry } = resolveEntry(_entry)
  const asLib = args.target && args.target !== 'app'
  if (asLib) {
    args.entry = entry
  }
  createService(context, entry, asLib).run('build', args)
}
```
基本上和 `vue serve` 命令一样，只是针对于构建目标为 lib ，wc 以及 wc-async 时为 `build` 命令添加了 `entry` 参数，防止找不到构建入口。因为当不指定
构建目标入口时，默认为 `src/App.vue`，那么如果 `vue build` 命令不指定 `entry` 参数，就很容易出现找不到构建入口的情形。
