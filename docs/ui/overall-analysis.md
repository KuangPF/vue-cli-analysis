# vue ui 整体分析

ui 命令旨在通过 GUI 的形式对 vue 项目进行管理，可以说是 vue-cli3.0 中的除了插件系统后的又一大新特性，那么整个 ui 系统是怎么运行起来的呢，可以大致的分为两部分进行分析，server 端和 client 端。server 端主要使用了 [apollo-server](https://github.com/apollographql/apollo-server) 与 [express](https://github.com/expressjs/express)，以 [GraphQL](https://graphql.org/) API 查询语言来实现数据的查询，变更以及订阅。而 client 端在 `ui` 方面使用了自家的 [@vue/ui](https://www.npmjs.com/package/@vue/ui)，另外在项目中还集成了[vue-apollo](https://github.com/Akryum/vue-apollo)。

先从 cli 官网搬一张图来整体感受下 vue ui：

<img :src="$withBase('/assets/ui-img01.png')" width=650>

这张图是 `vue ui` 的整体架构，如果现在不是很清楚里面里面涉及的知识的话，不要慌，可以在了解完 ui 命令后再来回看一下。

除此之外，还需要了解以下这些知识：

* [GraphQL](https://graphql.org/)：API 查询语言
* [apollo-server](https://github.com/apollographql/apollo-server)： nodejs上构建grqphql服务端的web中间件,支持express，koa ，hapi等框架。
* [vue-apollo](https://vue-apollo.netlify.com/zh-cn/)：在 vue 项目中集成 GraphQL
* [express](https://github.com/expressjs/express)：Node.js Web 应用程序框架

接下来就从 server 端和 client 端进行分析。