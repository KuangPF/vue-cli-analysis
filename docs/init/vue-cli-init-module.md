# @vue/cli-init 分析

`@vue/cli-init` 的源码很简单，如下：

``` javascript
const execa = require('execa')
const binPath = require.resolve('vue-cli/bin/vue-init')

execa(
  binPath,
  process.argv.slice(process.argv.indexOf('init') + 1),
  { stdio: 'inherit' }
)

```

对，你没有看错，这就是 `@vue/cli-init 的源码`。这段代码引入了 [execa](https://github.com/sindresorhus/execa)，execa 是可以调用 shell 和本地外部程序的 javascript 封装，会启动子进程执行。支持多操作系统，包括 windows。如果父进程退出，则生成的全部子进程都被杀死。对应在这里就会启动一个子线程去执行 `vue-cli/bin/vue-init` 脚本，那么 `vue-cli/bin/vue-init` 又是什么脚本？其实就是 `vue-cli 2.x` 中对应 `vue init` 的脚本（`vue cli 3.0` 中 `vue init` 命令的源码就是加载 `vue-cli 2.x` 中的 `vue init` 命令）。

那么接下来就开始分析 `vue-cli 2.x` 中 `init` 命令的源码。
