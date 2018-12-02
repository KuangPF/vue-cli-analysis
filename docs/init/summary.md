# 总结

通过一张图来回顾 `vue init` 命令:

<img :src="$withBase('/assets/vue-cli-init-summary.svg')" width="80%">

从这个图可以比较清晰地看出 `vue init` 命令的整个流程，分析源码也是一样，跟着代码的执行顺序一步一步地分析，从而可以将整个流程搞清。虽然在 `vue-cli 3.0` 当中 `vue init` 是一个遗留的 `API`，不推荐使用，但是通过 `vue init` 来了解 `node` 命令行脚手架工具搭建还是一个不错的选择。