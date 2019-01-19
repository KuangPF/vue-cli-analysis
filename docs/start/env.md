# 环境

### 版本
  * vue-cli： 3.1.3
  * node：8.11.4
  * platform： macOS


### 工具
  * vscode： 代码编辑器
  * Typora： Markdown 编辑器
  * carbon： 将代码转为图片 [link](https://carbon.now.sh/?bg=rgba(104%2C135%2C167%2C1)&t=3024-night&wt=none&l=vue&ds=true&dsyoff=20px&dsblur=68px&wc=true&wa=true&pv=48px&ph=32px&ln=false&fm=Hack&fs=14px&lh=133%25&si=false&es=2x&wm=false&ts=false)



### 从一张图开始源码的分析

<img :src="$withBase('/assets/install-env-img01.png')">

##### 安装 `vue-cli`

``` bash
npm install -g @vue/cli
# OR
yarn global add @vue/cli
```
在安装 `vue-cli` 之后，执行 `vue` 命令，就可以得到上面图片中的内容，从这个图片中可以看出，`vue-cli` 一共有 `11` 种命令：
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
  * info

我们就逐个开始分析。
