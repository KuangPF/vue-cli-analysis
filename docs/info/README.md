# info 命令

**源码目录：**  主要依赖了 npm 包 [envinfo](https://github.com/tabrindle/envinfo)。

**作用：**  输出环境的调试信息。

`vue info` 命令的入口在 `packages/@vue/cli/bin/vue.js` 中:

```js
program
  .command('info')
  .description('print debugging information about your environment')
  .action((cmd) => {
    console.log(chalk.bold('\nEnvironment Info:'))
    require('envinfo').run(
      {
        System: ['OS', 'CPU'],
        Binaries: ['Node', 'Yarn', 'npm'],
        Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
        npmPackages: '/**/{*vue*,@vue/*/}',
        npmGlobalPackages: ['@vue/cli']
      },
      {
        showNotFound: true,
        duplicates: true,
        fullTree: true
      }
    ).then(console.log)
  })
```

`npm info` 命令主要利用 npm `envinfo` 包输出一些环境的调试信息，比如系统信息，二进制执行文件信息，浏览器信息，项目中与 vue 相关的 npm 
包的版本号以及全局 `@vue/cli` 信息，更多关于 `envinfo` 的使用可查看详细文档[envinfo](https://github.com/tabrindle/envinfo)。

