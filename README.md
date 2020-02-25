# vue-cli 源码分析

![@vue/cli](https://img.shields.io/badge/@vue/cli-v3.1.3-42b983.svg) ![@vue/cli-service](https://img.shields.io/badge/@vue/cli--service-v3.1.4-42b983.svg) ![node-version](https://img.shields.io/badge/node-v8.11.4-brightgreen.svg) ![platform](https://img.shields.io/badge/platform-macOS%20%EF%A3%BF-000000.svg) ![Github action](https://github.com/KuangPF/vue-cli-analysis/workflows/Deploy%20to%20GitHub%20Pages/badge.svg) ![License](https://img.shields.io/github/license/KuangPF/vue-cli-analysis.svg) 

## 写在前面

其实最开始不是特意来研究 `vue-cli` 的源码，只是想了解下 `node` 的命令，如果想要了解 `node` 命令的话，那么绕不开 [tj](https://github.com/tj) 写的 [commander.js](https://github.com/tj/commander.js)。在学习 [commander.js](https://github.com/tj/commander.js) 过程中发现 `vue-cli` 的交互方式挺炫酷的，然后就去看了下源码，所以就有了这个仓库。

**慎重提醒：我对 `vue-cli` 的源码以及其中的一些知识点并不熟悉，如果我对其中的知识点非常了解的话我就不会来分析了，分析源码只是想更加了解 `vue-cli` 整个工具的实现过程以及 `vue-cli3` 的一些新特性。如果文中有描述有误，还请各位大大 issues or PR**。

## 相关说明

[vue-cli](https://github.com/vuejs/vue-cli/tree/dev/packages) 仓库 dev 分支下面 package 目录包含了 `cli`，`cli-service`，`CLI 插件`，`UI 插件`，`cli 工具函数`代码等等。本项目中的 package 文件夹里面对其中的代码有一定的注释，主要集中在 `cli`，`cli-service` 上，有兴趣的同学可以 fork 后查看。

## 目录

### @vue/cli

* **前言**
  * [介绍](https://kuangpf.com/vue-cli-analysis/foreword/)
* **开始**
  * [环境介绍](https://kuangpf.com/vue-cli-analysis/start/env.html/)
  * [常见 npm 包](https://kuangpf.com/vue-cli-analysis/start/npm.html/)
* **vue create**
  * [create 入口](https://kuangpf.com/vue-cli-analysis/create/)
  * [整体分析](https://kuangpf.com/vue-cli-analysis/create/overall-analysis.html)
  * [基础验证](https://kuangpf.com/vue-cli-analysis/create/basic-verification.html)
  * [获取预设选项（preset）](https://kuangpf.com/vue-cli-analysis/create/get-preset.html)
  * [依赖安装（installDeps）](https://kuangpf.com/vue-cli-analysis/create/install-deps.html)
  * [Generator](https://kuangpf.com/vue-cli-analysis/create/create/generator.html#)
  * [结尾分析](https://kuangpf.com/vue-cli-analysis/create/end-part.html)
  * [总结](https://kuangpf.com/vue-cli-analysis/create/summary.html)
* **vue add**
  * [add 入口](https://kuangpf.com/vue-cli-analysis/add/)
  * [安装插件](https://kuangpf.com/vue-cli-analysis/add/plugin-install.html)
  * [调用插件](https://kuangpf.com/vue-cli-analysis/add/plugin-invoke.html)
  * [总结](https://kuangpf.com/vue-cli-analysis/add/summary.html)
* **vue invoke**
  * [invoke 命令](https://kuangpf.com/vue-cli-analysis/invoke/)
* **vue inspect**
  * [inspect 命令](https://kuangpf.com/vue-cli-analysis/inspect/)
* **vue serve**
  * [serve 命令](https://kuangpf.com/vue-cli-analysis/serve/)
* **vue build**
  * [build 命令](https://kuangpf.com/vue-cli-analysis/build/)
* **vue ui**
  * [ui 入口](https://kuangpf.com/vue-cli-analysis/ui/)
  * [整体分析](https://kuangpf.com/vue-cli-analysis/ui/overall-analysis.html)
  * [server 端](https://kuangpf.com/vue-cli-analysis/ui/server.html)
  * [client 端](https://kuangpf.com/vue-cli-analysis/ui/client.html)
  * [总结](https://kuangpf.com/vue-cli-analysis/ui/summary.html)
* **vue init**
  * [init 入口](https://kuangpf.com/vue-cli-analysis/init/)
  * [@vue/cli-init 分析](https://kuangpf.com/vue-cli-analysis/init/vue-cli-init-module.html)
  * [vue-cli 2.x init 分析](https://kuangpf.com/vue-cli-analysis/init/vue-cli-init-2.x.html)
  * [generate 函数分析](https://kuangpf.com/vue-cli-analysis/init/generate.html)
  * [总结](https://kuangpf.com/vue-cli-analysis/init/summary.html)
* **vue config**
  * [config 命令](https://kuangpf.com/vue-cli-analysis/config/)
* **vue upgrade**
  * [upgrade 命令](https://kuangpf.com/vue-cli-analysis/upgrade/)
* **vue info**
  * [info 命令](https://kuangpf.com/vue-cli-analysis/info/)

### @vue/cli-service

* **整体介绍**
  * [入口](https://kuangpf.com/vue-cli-analysis/cli-service/entrance.html)
  * [new Service()](https://kuangpf.com/vue-cli-analysis/cli-service/new-service.html)
  * [service.run()](https://kuangpf.com/vue-cli-analysis/cli-service/service-run.html)
* **内置插件**
  * [serve](https://kuangpf.com/vue-cli-analysis/cli-service/serve.html)
  * [build](https://kuangpf.com/vue-cli-analysis/cli-service/build.html)
  * [inspect](https://kuangpf.com/vue-cli-analysis/cli-service/inspect.html)
  * [help](https://kuangpf.com/vue-cli-analysis/cli-service/help.html)


## 请作者喝杯咖啡☕️

如果觉得文章对你有所帮助，不如请作者喝杯咖啡 ☕️

<img width=200 src='https://user-images.githubusercontent.com/20694238/75290073-9a76cf80-585a-11ea-8c14-730274b9987d.jpg' /> <img width=205 src='https://user-images.githubusercontent.com/20694238/75290080-9d71c000-585a-11ea-8976-bed1ea2c8550.jpg' />

## 总结

vue-cli-analysis 整个项目可大致分为两个部分，一部分是 vue 命令分析，包含 create，add，invoke， ui 等等，另一部分就是 vue-cli-service 的分析。通过分析发现与 2.X 相比，3.0 变化太大了，通过引入插件系统，可以让开发者利用其暴露的 API 对项目进行扩展。在分析之前对插件机制不是很了解，不知道如何实现的，分析之后逐渐了解了其实现机制，而且对于 vue 项目的配置也更加熟悉了。除此之外，在分析过程过程中还了解了很多有意思的 npm 包，比如 execa， debug， lowdb，lodash，inquirer 等等，最后，如果你想学习 node 命令或者想写一些比较有意思的命令行工具的话，阅读 vue-cli 源码是一个不错的选择。


