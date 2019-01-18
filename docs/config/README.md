# config 命令

**源码目录：**  packages/@vue/cli/lib/config.js 。

**作用：**  审查或修改全局的 CLI 配置 。

`vue config` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('config [value]')
  .description('inspect and modify the config')
  .option('-g, --get <path>', 'get value from option')
  .option('-s, --set <path> <value>', 'set option value')
  .option('-d, --delete <path>', 'delete option from config')
  .option('-e, --edit', 'open config with default editor')
  .option('--json', 'outputs JSON result only')
  .action((value, cmd) => {
    require('../lib/config')(value, cleanArgs(cmd))
  })
```
`vue config` 参数比较好理解，注意一下的就是 `<path>` 这个值，它用于指定特定配置的路径，比如想要查看 `.vuerc` 中 presets 的值，可使用以下命令：

```bash
vue config -g presets
```
如果想要查看某一个 preset 的详细信息，例如查看名称为 `demo` 的 preset，config 命令如下：

```bash
vue config -g presets.demo
```
`path` 就是一个路径，一级一级地查找，以 `.` 分割，接下来分析下 `config.js` 的内容。

```js
module.exports = (...args) => {
  return config(...args).catch(err => {
    error(err)
    if (!process.env.VUE_CLI_TEST) {
      process.exit(1)
    }
  })
}
```
当执行 vue config 命令时，执行了 config 函数，接着看 config 函数内容：

```js
async function config (value, options) {
  const file = path.resolve(homedir, '.vuerc') // 获取 .vuerc 路径
  const config = await fs.readJson(file) // 获取 .vuerc 中的内容

  if (!options.delete && !options.get && !options.edit && !options.set) { // 输出 .vuerc 内容
    if (options.json) { // --json
      console.log(JSON.stringify({
        resolvedPath: file,
        content: config
      }))
    } else {
      console.log('Resolved path: ' + file + '\n', JSON.stringify(config, null, 2))
    }
  }

  if (options.get) { // 获取 .vuerc 中某个指定的配置，vue config -g presets 可以获取预设的值
    const value = get(config, options.get)
    if (options.json) {
      console.log(JSON.stringify({
        value
      }))
    } else {
      console.log(value)
    }
  }

  if (options.delete) { // 删除 .vuerc 中某个指定的配置
    unset(config, options.delete)
    await fs.writeFile(file, JSON.stringify(config, null, 2), 'utf-8')
    if (options.json) {
      console.log(JSON.stringify({
        deleted: options.delete
      }))
    } else {
      console.log(`You have removed the option: ${options.delete}`)
    }
  }

  if (options.edit) { // 启用编辑器编辑 .vuerc
    launch(file)
  }

  if (options.set && !value) {
    throw new Error(`Make sure you define a value for the option ${options.set}`)
  }

  if (options.set && value) { // 设置 config，做一些类型处理
    set(config, options.set, value)

    if (value.match('[0-9]')) {
      set(config, options.set, parseInt(value))
    }

    if (value === 'true') {
      set(config, options.set, true)
    }

    if (value === 'false') {
      set(config, options.set, false)
    }

    await fs.writeFile(file, JSON.stringify(config, null, 2), 'utf-8')
    if (options.json) {
      console.log(JSON.stringify({
        updated: options.set
      }))
    } else {
      console.log(`You have updated the option: ${options.set} to ${value}`)
    }
  }
}

```
首先读取了 `.vuerc` 内容，然后根据参数处理对应的情形，下面以 `--get <path>` 为例来分析，处理 get 情形的代码如下:

```js
if (options.get) { // 获取 .vuerc 中某个指定的配置，vue config -g presets 可以获取预设的值
  const value = get(config, options.get)
  if (options.json) {
    console.log(JSON.stringify({
      value
    }))
  } else {
    console.log(value)
  }
}
```
获取 value 的任务交给了 `@vue/cli-shared-utils` 中的 `get` 函数，那么继续看：

```js
exports.get = function (target, path) {
  const fields = path.split('.')
  let obj = target
  const l = fields.length
  for (let i = 0; i < l - 1; i++) {
    const key = fields[i]
    if (!obj[key]) {
      return undefined
    }
    obj = obj[key]
  }
  return obj[fields[l - 1]]
}
```

先将 get 参数值以 . 分割，然后循环一级一级地遍历 obj 对象的值，最后返回。其他 set， delete 与 get 类似，就不做分析了，注意一下的就是 set 命令会对
输入的内容进行一定的处理，因为终端输入的内容都是 `String` 类型，因此检测到含有数字，则将其转为 Number 类型，如果检测到 `'true' || 'false'`，会将其转为
`Boolean` 类型。
