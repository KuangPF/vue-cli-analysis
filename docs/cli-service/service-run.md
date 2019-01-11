# service.run()

还是老规矩，把 `run` 的源码贴出来看看：

```js
async run (name, args = {}, rawArgv = []) {
  // 命令指定模式
  // resolve mode
  // prioritize inline --mode
  // fallback to resolved default modes from plugins or development if --watch is defined
  const mode = args.mode || (name === 'build' && args.watch ? 'development' : this.modes[name])

  // load env variables, load user config, apply plugins
  // 加载本地环境变量，vue.config.js || package.vue， 执行所有被加载的插件
  this.init(mode)
  args._ = args._ || []
  let command = this.commands[name] // 加载插件时注册了 command，api.registerCommand
  if (!command && name) { // 非法命令
    error(`command "${name}" does not exist.`)
    process.exit(1)
  }
  console.log(args)
  if (!command || args.help || args.h) { // vue-cli-service || vue-cli-service -h
    console.log('ssssss')
    command = this.commands.help
  } else {
    args._.shift() // remove command itself
    rawArgv.shift()
  }
  const { fn } = command
  return fn(args, rawArgv)
}
```
::: tip
每次贴代码的时候都会发现，代码不会很长，因为在 vue-cli 3.0 中，很多功能都会被模块化，而且会将一个大的功能拆分成多个小的功能进行实现，这样提高了代码
的可读性并且也利于代码的维护，这种编程方式十分值得学习。
:::

`run` 方法开始会获取该命令所对应的模式值，然后调用实例的 `init` 方法，`init` 主要有三个功能：
* **加载对应模式下本地的环境变量**
* **解析 vue.config.js 或者 package.vue**
* **执行所有被加载的插件**

那么继续看下 `init` 方法代码：
