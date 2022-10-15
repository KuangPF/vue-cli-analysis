---
sidebarDepth: 0
---

# 常见 npm 包

在进去 `vue-cli` 源码学习之前，这里先介绍下在 `vue-cli` 项目中用到的一些必备的 `npm` 包，这样在后面分析源码的时候会比较快的理解（`handlebars`，`metalsmith`，`consolidate` 主要用于
 `vue init` 命令）。
* [commander](https://github.com/tj/commander.js)：node.js command-line interfaces made easy。
* [Inquirer](https://github.com/SBoudrias/Inquirer.js)：A collection of common interactive command line user interfaces。
* [execa](https://github.com/sindresorhus/execa)：A better [child_process](https://nodejs.org/api/child_process.html)。
* [handlebars](https://github.com/wycats/handlebars.js)：一个 javascript 语义模版库。
* [metalsmith](https://github.com/segmentio/metalsmith)；An extremely simple, pluggable static site generator。
* [chalk](https://github.com/chalk/chalk)：Terminal string styling done right。
* [download-git-repo](https://github.com/flipxfx/download-git-repo)：Download and extract a git repository (GitHub, GitLab, Bitbucket) from node。
* [consolidate](https://github.com/tj/consolidate.js)：Template engine consolidation library for node.js 。

下面逐个介绍：

## commander

`commander` 是一款重量轻，表现力和强大的命令行框架，提供了用户命令行输入和参数解析强大功能。

``` javascript
#!/usr/bin/env node

const program = require('commander')

program
  .version('0.0.1')
  .command('rmdir <dir> [otherDirs...]')
  .action(function(dir, otherDirs) {
    console.log('rmdir %s', dir);
    if (otherDirs) {
      otherDirs.forEach(function(oDir) {
        console.log('rmdir %s', oDir);
      });
    }
  });

program.parse(process.argv);
```
这段代码为 `commander.js` 官方的一个示例，它展示了 `commander.js` 可变参数的特性，可以在 `action` 的回调中获取对应的参数，当然也可以通过 `process.argv` 获取，[commander.js 中文文档](https://github.com/tj/commander.js/blob/master/Readme_zh-CN.md)。

## Inquirer
`Inquirer` 为交互式命令行工具，比如执行 `vue create` 命令会有以下的命令行交互：

<img :src="$withBase('/assets/install-img01.png')">

`Inquirer` 的基本使用如下：

``` javascript
var inquirer = require('inquirer');
inquirer
  .prompt([
    /* Pass your questions in here */
  ])
  .then(answers => {
    // Use user feedback for... whatever!!
  });
```
`inquirer.prompt` 接受一个 `questions` 数组， 一个 `question` 对象包含 `type`，`name`， `message`， `default` 等等字段，然后通过回调获取命令行交互的值，[详细文档](https://github.com/SBoudrias/Inquirer.js)。


## execa

`execa` 是可以调用 shell 和本地外部程序的 javascript 封装。会启动子进程执行，支持多操作系统，包括 windows，如果父进程退出，则生成的全部子进程都被杀死。它是在 Node.js 内置的 `child_process.exec` 基础上进行了提升，比如更好地支持 windows 平台，以及提供 `Promise` 的接口等等。可以看一个很简单的例子：

``` js
const execa = require('execa');

(async () => {
	const {stdout} = await execa('echo', ['unicorns']);
	console.log(stdout);
	//=> 'unicorns'
})();
```
上面例子就是执行  `echo unicorns` 命令输出 unicorns。关于 `execa` 更多的用法可查看 [详细文档](https://github.com/sindresorhus/execa#API)。

## handlebars
`handlebars` 是一个 `javascript` 语义模版库，而且与 `Mustache` 模板 是兼容的，通过一个 `demo` 来感受下：

``` javascript
var source = "<p>Hello, my name is {{name}}. I am from {{hometown}}. I have " +
             "{{kids.length}} kids:</p>" +
             "<ul>{{#kids}}<li>{{name}} is {{age}}</li>{{/kids}}</ul>";
var template = Handlebars.compile(source);

var data = { "name": "Alan", "hometown": "Somewhere, TX",
             "kids": [{"name": "Jimmy", "age": "12"}, {"name": "Sally", "age": "4"}]};
var result = template(data);

// Would render:
// <p>Hello, my name is Alan. I am from Somewhere, TX. I have 2 kids:</p>
// <ul>
//   <li>Jimmy is 12</li>
//   <li>Sally is 4</li>
// </ul>
```
这是官方的一个 `demo`, 就是通过 `Handlebars` 的 `compile` 方法将模板编译成 `html` 。在 `vue-cli` 的 `init` 命令中，利用 `Handlebars.registerHelper` 方法注册了一些 `helper`，这样就可以在模板中方便的使用这些 `helper`，[详细文档](https://handlebarsjs.com/)。

## metalsmith

`metalsmith` 一个静态网站生成器，可以用在批量处理模板的场景，和 `hexo` 类似。它最大的特点就是所有的逻辑都是由插件处理，你只需要将这些插件用 `metalsmith` 连接起来使用即可，比如官方的一个 `demo`：

``` javascript
Metalsmith(__dirname)
  .use(markdown())
  .use(layouts('handlebars'))
  .build(function(err) {
    if (err) throw err;
    console.log('Build finished!');
  });
```
这段代码就是通过使用 [metalsmith-markdown](https://github.com/segmentio/metalsmith-markdown) 和 [metalsmith-layouts](https://github.com/metalsmith/metalsmith-layouts) 插件 将 `markdown` 文件以 `handlebars` 的模板形式来生成`html` 文件，在 `vue-cli` 的 `init` 命令中使用了三个插件：`askQuestions` `filterFiles` `renderTemplateFiles` 从这名字就知道这个插件的作用了。编写 metalsmith 其实不是很难，官方对插件的编写介绍地比较详细，示例代码：

**metalsmith-myplugin**:

``` javascript
// we would like you to use debug
var debug = require('debug')('metalsmith-myplugin');
var multimatch = require('multimatch');

// Expose `plugin`.
module.exports = plugin;

function plugin(opts){
  opts.pattern = opts.pattern || [];

  return function (files, metalsmith, done){

    setImmediate(done);
    Object.keys(files).forEach(function(file){
      if(multimatch(file, opts.pattern).length) {
        debug('myplugin working on: %s', file);

        //
        // here would be your code
        //

      }
    });
  };
}
```
关于 `metalsmith` 的更多介绍以及语法可查看[详细文档](https://metalsmith.io/)。

## chalk

`chalk` 是用于修改控制台字符串的样式，包括字体样式（加粗），颜色以及背景颜色等。

<img :src="$withBase('/assets/install-img02.png')">

使用比较简单：

``` javascript
const chalk = require('chalk');
console.log(chalk.blue('Hello world!'));
```
更多的用法以及 `API` 可查看[详细文档](https://github.com/chalk/chalk)。


## download-git-repo
`download-git-repo` 是用于 从 `GitHub`, `GitLab`, `Bitbucket` 下载一个 `git` 仓库，`API` 如下：
``` javascript
download(repository, destination, options, callback)
```

* repository：仓库地址。
* destination：存放下载 git 仓库的路径。
* options：选项，clone。是以 http download 的形式还是 git clone 的形式下载。其中 git clone 的形式支持下载 private 仓库。
* callback：下载完成地回调。

更多例子可查看 [详细文档](https://github.com/flipxfx/download-git-repo)。

## consolidate
`consolidate` 是一个模版引擎整合库，它的作用是把一些著名的模板引擎适配成 `Express` 兼容的接口。在 `vue-cli` 的 `init` 命令中利用 `consolidate.handlebars.render` 是实现模版的渲染。在 `/example/metalsmith` 目录里有个 `demo`，就是通过 `metalsmith` 以及`consolidate.handlebars.render` 方法将一个 `package.json` 以 `handlebars` 的模板引擎来渲染，在项目里运行

``` bash
npm run metalsmith
```
<img :src="$withBase('/assets/install-img03.gif')">

希望可以通过这个小 `demo` 可以比较好地理解 `metalsmith`， `handlebars` ，`consolidate` 以及`inquirer`，关于 `consolidate` 的更多语法请查看[详细文档](https://github.com/tj/consolidate.js)。


## 总结
这部分主要介绍了在利用 `node` 搭建脚手架工具时一些常见的 `npm` 包，对这些 `npm` 包进行一定的了解后，在后面看源码的时候会比较容易些，下面开始进行源码分析。
