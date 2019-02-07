const path = require('path')
const express = require('express')
// 引入 express-history-api-fallback 中间件，避免在 History 路由模式下出现 404 的情况
const fallback = require('express-history-api-fallback')
// Connectors
const clientAddons = require('./connectors/client-addons')
const plugins = require('./connectors/plugins')

const distPath = path.resolve(__dirname, '../dist')
const publicPath = path.resolve(__dirname, '../ui-public')

module.exports = app => {
  app.use(express.static(distPath, { maxAge: 0 })) // express.static 内置中间件函数，设置静态资源（文件）目录
  app.use('/public', express.static(publicPath, { maxAge: 0 }))  // public 资源目录，e.g. http://localhost:8000/public/vue-cli.png
  app.use('/_plugin/:id/*', plugins.serve) // 公共静态文件,在 cli-ui 内建的 HTTP 服务器上暴露一些静态文件
  app.use('/_plugin-logo/:id', plugins.serveLogo) // UI 插件 logo
  app.use('/_addon/:id/*', clientAddons.serve)
  app.use(fallback(path.join(distPath, 'index.html'), { maxAge: 0 }))
}
