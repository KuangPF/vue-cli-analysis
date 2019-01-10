# @vue/cli-service

在分析 @vue/cli-service 之前，首先要明白它是干什么的，简单来说 @vue/cli-service 提供了本地开发构建服务。比如执行 npm run serve，对应执行的
命令是 vue-cli-service serve，该命令的用于构建一个开发服务，类似与在 vue-cli 2.X 中执行 npm run dev 加载 build/webpack.dev.conf.js。
在 vue-cli 3.0 中将 webpack 及相关插件提供的功能都收敛到 @vue/cli-service 内部来实现。下面就开始看下 @vue/cli-service 是如何实现插件系统的。


