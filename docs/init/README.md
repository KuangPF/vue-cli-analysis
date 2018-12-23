# init 命令

**源码目录：**  packages/@vue/cli-init/index.js 。

**作用：** 下载远程模板并生成项目 。

**相关说明：** `vue init` 命令主要是 2.x 版本使用，但在 3.0中还是将其保留，3.0 推荐使用 `vue create` 。


`vue init` 命令的入口在 packages/@vue/cli/bin/vue.js 中:

``` javascript
program
  .command('init <template> <app-name>')
  .description('generate a project from a remote template (legacy API, requires @vue/cli-init)')
  .option('-c, --clone', 'Use git clone when fetching remote template')
  .option('--offline', 'Use cached template')
  .action(() => {
    loadCommand('init', '@vue/cli-init')
  })
```

vue init 命令需要输入模版的名称（template）以及 项目名称（app-name），而且都为必填。模版名称可以是官方的模板，[官方模版](https://github.com/vuejs-templates) 包含了 [webpack](https://github.com/vuejs-templates/webpack)，[pwa](https://github.com/vuejs-templates/pwa)，[webpack-simple](https://github.com/vuejs-templates/webpack-simple)，[simple](https://github.com/vuejs-templates/simple)，[browserify](https://github.com/vuejs-templates/browserify)，[browserify-simple](https://github.com/vuejs-templates/browserify-simple) 这 6 种模板。当然支持自定义 Github 模板，比如初始化 `mpvue-quickstart`的命令如下：

``` bash
vue init mpvue/mpvue-quickstart my-project
```
[mpvue/mpvue-quickstart](https://github.com/mpvue/mpvue-quickstart) 中的 `template` 就为mpvue-quickstart 的内容。

另外 option 包含了 -c  和 -offline，这两个参数的作用为：

* -c：当利用 `download-git-repo` 获取模版的时候采用`git clone`下载而不是`http 下载`，默认采用 http 下载。
* --offline：使用缓存的 template 模板，位于`~/.vue-templates`目录下面。



当执行 `vue-init` 命令的时候 `loadCommand` 函数会加载 `@vue/cli-init` 模块，这也是为什么当你安装了 `@vue/cli`，但没有安装 `@vue/cli-init` 的时候执行 `vue init <template> <app-name>` 会有以下的提示：

<img :src="$withBase('/assets/init-img01.png')">

接下来我们就开始分析`@vue/cli-init` 模块做了什么事情。
