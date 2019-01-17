# vue-cli-service help

内置插件 help 用于输出一些帮助信息，包含 `vue-cli-service` 以及 `build` ,`serve` 等命令的帮助信息，触发执行 help 的命令有很多种情形，以下几种命令都可以
触发 help 命令：

```bash
vue-cli-service
vue-cli-service help
vue-cli-service --help
vue-cli-service serve --help
vue-cli-service help serve
...
```
总结一下有三种情形会触发 help 命令：
* **没有包含命令**
* **直接执行的是 help 命令**
* **命令中包含 --help 参数**

 之所以会这样，因为代码就是这样写的😄😄：
```js
if (!command || args.help) { // vue-cli-service || vue-cli-service --help
  command = this.commands.help
}
// some code ...
const { fn } = command
```
好了，接下来还是看下 help CLI 服务是怎么实现的，代码如下：

```js
args => {
  const command = args._[0]
  if (!command) {
    logMainHelp()
  } else {
    logHelpForCommand(command, api.service.commands[command])
  }
}
```
这种代码就很清晰了，如果没有命令就直接执行 `logMainHelp` 函数，输出` vue-cli-service` 的帮助信息，如果含有命令，就是执行 `logHelpForCommand` 输出
指定命令的帮助信息，一个一个来分析。

## logMainHelp

```js
function logMainHelp () {
  console.log(
    `\n  Usage: vue-cli-service <command> [options]\n` +
    `\n  Commands:\n`
  )
  const commands = api.service.commands
  const padLength = getPadLength(commands) // 获取填充字符串的最大长度
  for (const name in commands) {
    if (name !== 'help') {
      const opts = commands[name].opts || {}
      console.log(`    ${
        chalk.blue(padEnd(name, padLength))
      }${
        opts.description || ''
      }`)
    }
  }
  console.log(`\n  run ${
    chalk.green(`vue-cli-service help [command]`)
  } for usage of a specific command.\n`)
}
```
首先调用 `getPadLength` 函数确定填充字符串的长度，关于字符串填充可查看[String.prototype.padEnd
](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd)，`getPadLength` 
函数中默认取的最大值为 10，如果命令字符比较长的话，该值会在命令字符串的长度上加1（直接上代码，可能会更容易理解）：

```js
module.exports = function getPadLength (obj) {
  let longest = 10
  for (const name in obj) {
    if (name.length + 1 > longest) {
      longest = name.length + 1
    }
  }
  return longest
}

```
然后利用 npm 包 [padEnd](https://github.com/es-shims/String.prototype.padEnd)
实现[String.prototype.padEnd](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd)
效果，并循环将 command 的名称以及对应的 `command.description` 输出到控制台上。


## logHelpForCommand

```js
function logHelpForCommand (name, command) {
  if (!command) {
    console.log(chalk.red(`\n  command "${name}" does not exist.`))
  } else {
    const opts = command.opts || {}
    if (opts.usage) {
      console.log(`\n  Usage: ${opts.usage}`)
    }
    if (opts.options) {
      console.log(`\n  Options:\n`)
      const padLength = getPadLength(opts.options) // eg for build: --mode,--dest,--no-unsafe-inline etc.
      for (const name in opts.options) {
        console.log(`    ${
          chalk.blue(padEnd(name, padLength))
        }${
          opts.options[name]
        }`)
      }
    }
    if (opts.details) {
      console.log()
      console.log(opts.details.split('\n').map(line => `  ${line}`).join('\n'))
    }
    console.log()
  }
}
```
`logHelpForCommand` 主要输出特定命令的帮助信息，如果有用法 usage 的描述会先输出，然后与 `logMainHelp` 函数类似，先获取获取填充字符串的长度，
然后遍历输出每种参数名称以及描述，如果还有详情 details 的描述也会输出到控制上。





























