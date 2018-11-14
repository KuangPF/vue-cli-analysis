# vue-cli 源码分析

![@vue/cli](https://img.shields.io/badge/@vue/cli-v3.1.3-42b983.svg) ![@vue/cli-init](https://img.shields.io/badge/@vue/cli--init-v3.1.1-42b983.svg) ![@vue/cli-service](https://img.shields.io/badge/@vue/cli--service-v3.1.4-42b983.svg) ![node-version](https://img.shields.io/badge/node-v8.11.4-brightgreen.svg) ![platform](https://img.shields.io/badge/platform-macOS%20%EF%A3%BF-000000.svg) ![License](https://img.shields.io/github/license/KuangPF/vue-cli-analysis.svg)

## 写在前面

其实最开始不是特意来研究 `vue-cli` 的源码，只是想了解下 `node` 的命令，如果想要了解 `node` 命令的话，那么肯定绕不开 [tj](https://github.com/tj) 写的 [commander.js](https://github.com/tj/commander.js)。在学习 [commander.js](https://github.com/tj/commander.js) 过程中发现 `vue-cli` 的交互方式挺炫酷的，然后就去看了下源码，所以就有了这个仓库。

**慎重提醒：我对 `vue-cli` 的源码以及其中的一些知识点并不熟悉，如果我对其中的知识点非常了解的话我就不会来分析了，分析源码只是想更加了解 `vue-cli` 整个工具的实现过程以及 `vue-cli3` 的一些新特性。如果文中有描述有误，还请各位大大 issues or PR**。

## 目录

* 前言
* 环境
* vue
  * create
  * add
  * invoke
  * inspect
  * serve
  * build
  * ui
  * init
  * config
  * upgrade
* 结束语

## 进度

![progress](http://progressed.io/bar/1?title=progress)