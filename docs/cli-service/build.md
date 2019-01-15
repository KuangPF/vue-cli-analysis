# vue-cli-service build

 `vue-cli-service build` 会在 `dist/` 目录产生一个可用于生产环境的包，带有 JS/CSS/HTML 的压缩，和为更好的缓存而做的自动的 vendor chunk splitting。
它的 chunk manifest 会内联在 HTML 里。

相比 vue-cli 2.x 版本而言，vue-cli 3.0 在构建生产环境包的时候拥有更多的选择，执行 `vue-cli-service build --help` 可查看参数：

```
--mode              指定环境模式 (默认值：production)
--dest              指定输出目录 (默认值：dist)
--modern            面向现代浏览器带自动回退地构建应用
--no-unsafe-inline  不以 inline 方式引入 script （针对 Safari 10 中 <script nomodule> 的修复）
--target            app | lib | wc | wc-async (默认值：app)
--formats           构建目标为库的时候指定输出格式默认为 commonjs,umd,umd-min
--name              库或 Web Components 模式下的名字 (默认值：package.json 中的 "name" 字段或入口文件名)
--no-clean          在构建项目之前不清除目标目录
--report            生成 report.html 以帮助分析包内容
--report-json       生成 report.json 以帮助分析包内容
--watch             监听文件变化
```
其中[构建目标](https://cli.vuejs.org/zh/guide/build-targets.html)和[现代模式](https://cli.vuejs.org/zh/guide/browser-compatibility.html#%E7%8E%B0%E4%BB%A3%E6%A8%A1%E5%BC%8F)
很有意思，官方文档对这两个参数做了详细的介绍，这里就先不重复描述了。`build` 命令的运行流程和 `serve` 命令类似，都会先获取 webpack 的配置，然后进行打包，
下面就简单看下源码。
