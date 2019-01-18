# inspect 命令

**源码目录：**  packages/@vue/cli/lib/inspect.js 。

**作用：**  审查一个 Vue CLI 项目的 webpack config 。

`vue inspect` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('inspect [paths...]')
  .description('inspect the webpack config in a project with vue-cli-service')
  .option('--mode <mode>')
  .option('--rule <ruleName>', 'inspect a specific module rule')
  .option('--plugin <pluginName>', 'inspect a specific plugin')
  .option('--rules', 'list all module rule names')
  .option('--plugins', 'list all plugin names')
  .option('-v --verbose', 'Show full function definitions in output')
  .action((paths, cmd) => {
    require('../lib/inspect')(paths, cleanArgs(cmd))
  })
```
当执行了 `vue inspect` 命令时会加载 `@vue/cli/lib/inspect.js`，那么接下来分析 `inspect.js` 代码。

```js
module.exports = function inspect (paths, args) {
  const cwd = process.cwd()
  let servicePath
  try {
    servicePath = resolve.sync('@vue/cli-service', { basedir: cwd })  // cwd/node_modules/@vue/cli-service/lib/Service.js
  } catch (e) {
    const { error } = require('@vue/cli-shared-utils')
    error(
      `Failed to locate @vue/cli-service.\n` +
      `Note that \`vue inspect\` is an alias of \`vue-cli-service inspect\`\n` +
      `and can only be used in a project where @vue/cli-service is locally installed.`
    )
    process.exit(1)
  }
  const binPath = path.resolve(servicePath, '../../bin/vue-cli-service.js') // cwd/node_modules/@vue/cli-service/bin/vue-cli-service.js
  if (fs.existsSync(binPath)) {
    execa('node', [
      binPath,
      'inspect',
      ...(args.mode ? ['--mode', args.mode] : []),
      ...(args.rule ? ['--rule', args.rule] : []),
      ...(args.plugin ? ['--plugin', args.plugin] : []),
      ...(args.rules ? ['--rules'] : []),
      ...(args.plugins ? ['--plugins'] : []),
      ...(args.verbose ? ['--verbose'] : []),
      ...paths
    ], { cwd, stdio: 'inherit' })
  }
}
```
这段代码比较好理解，作用就是获取 `@vue/cli-service` 的执行文件路径，然后执行其 `inspect` 命令。也就是说 `vue inspect` 命令实际执行的是
 `vue-cli-service inspect` 命令，相关分析可查看 [cli-service 内置插件 inspect](/cli-service/inspect.html)。
