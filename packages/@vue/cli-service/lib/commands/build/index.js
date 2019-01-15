const defaults = {
  clean: true,
  target: 'app',
  formats: 'commonjs,umd,umd-min',
  'unsafe-inline': true
}

const buildModes = {
  lib: 'library',
  wc: 'web component',
  'wc-async': 'web component (async)'
}

const modifyConfig = (config, fn) => {
  if (Array.isArray(config)) {
    config.forEach(c => fn(c))
  } else {
    fn(config)
  }
}

module.exports = (api, options) => {
  api.registerCommand('build', {
    description: 'build for production',
    usage: 'vue-cli-service build [options] [entry|pattern]',
    options: {
      '--mode': `specify env mode (default: production)`,
      '--dest': `specify output directory (default: ${options.outputDir})`,
      '--modern': `build app targeting modern browsers with auto fallback`,
      '--no-unsafe-inline': `build app without introducing inline scripts`,
      '--target': `app | lib | wc | wc-async (default: ${defaults.target})`,
      '--formats': `list of output formats for library builds (default: ${defaults.formats})`,
      '--name': `name for lib or web-component mode (default: "name" in package.json or entry filename)`,
      '--no-clean': `do not remove the dist directory before building the project`,
      '--report': `generate report.html to help analyze bundle content`,
      '--report-json': 'generate report.json to help analyze bundle content',
      '--watch': `watch for changes`
    }
  }, async (args) => {
    for (const key in defaults) {
      if (args[key] == null) {
        args[key] = defaults[key]
      }
    }
    args.entry = args.entry || args._[0] // 构建一个库的入口文件，默认为 src/App.vue
    if (args.target !== 'app') {
      args.entry = args.entry || 'src/App.vue'
    }

    process.env.VUE_CLI_BUILD_TARGET = args.target
    if (args.modern && args.target === 'app') { // 现代模式
      process.env.VUE_CLI_MODERN_MODE = true
      delete process.env.VUE_CLI_MODERN_BUILD
      await build(Object.assign({}, args, { // 支持旧浏览器
        modernBuild: false,
        keepAlive: true
      }), api, options)

      process.env.VUE_CLI_MODERN_BUILD = true
      await build(Object.assign({}, args, { // 支持现代浏览器
        modernBuild: true,
        clean: false
      }), api, options)

      delete process.env.VUE_CLI_MODERN_MODE
      delete process.env.VUE_CLI_MODERN_BUILD
    } else {
      if (args.modern) {
        const { warn } = require('@vue/cli-shared-utils')
        warn(
          `Modern mode only works with default target (app). ` +
          `For libraries or web components, use the browserslist ` +
          `config to specify target browsers.`
        )
      }
      await build(args, api, options)
    }
    delete process.env.VUE_CLI_BUILD_TARGET
  })
}

async function build (args, api, options) {
  const fs = require('fs-extra')
  const path = require('path')
  const chalk = require('chalk')
  const webpack = require('webpack')
  const formatStats = require('./formatStats')
  const validateWebpackConfig = require('../../util/validateWebpackConfig')
  const {
    log,
    done,
    info,
    logWithSpinner,
    stopSpinner
  } = require('@vue/cli-shared-utils')

  log()
  const mode = api.service.mode // 模式
  if (args.target === 'app') { // 构建目标 app
    const bundleTag = args.modern // 现代版本还是旧浏览器版本
      ? args.modernBuild
        ? `modern bundle `
        : `legacy bundle `
      : ``
    logWithSpinner(`Building ${bundleTag}for ${mode}...`)
  } else { // 获取构建目标 lib || wc || wc-async
    const buildMode = buildModes[args.target]
    if (buildMode) {
      // 不同的构建版本 myLib.common.js，myLib.umd.js，myLib.umd.min.js
      const additionalParams = buildMode === 'library' ? ` (${args.formats})` : ``
      logWithSpinner(`Building for ${mode} as ${buildMode}${additionalParams}...`)
    } else {
      throw new Error(`Unknown build target: ${args.target}`)
    }
  }

  const targetDir = api.resolve(args.dest || options.outputDir) // 默认 dist 目录

  const isLegacyBuild = args.target === 'app' && args.modern && !args.modernBuild // 是否是支持就浏览器进行 build

  // resolve raw webpack config
  let webpackConfig
  if (args.target === 'lib') { // 加载构建目标为 lib 的 webpack 配置
    webpackConfig = require('./resolveLibConfig')(api, args, options)
  } else if ( // 加载构建目标为 wc || wc-async 的 webpack 配置
    args.target === 'wc' ||
    args.target === 'wc-async'
  ) {
    webpackConfig = require('./resolveWcConfig')(api, args, options)
  } else { // 默认的应用构建目标
    webpackConfig = require('./resolveAppConfig')(api, args, options)
  }

  // check for common config errors
  validateWebpackConfig(webpackConfig, api, options, args.target)

  // apply inline dest path after user configureWebpack hooks
  // so it takes higher priority
  if (args.dest) { // 指定输出目录 (默认值：dist)，args.dest 有更高的优先级
    modifyConfig(webpackConfig, config => {
      config.output.path = targetDir
    })
  }
  // 监听文件变化
  if (args.watch) {
    modifyConfig(webpackConfig, config => {
      config.watch = true
    })
  }

  // Expose advanced stats
  if (args.dashboard) {
    const DashboardPlugin = require('../../webpack/DashboardPlugin')
    modifyConfig(webpackConfig, config => {
      config.plugins.push(new DashboardPlugin({
        type: 'build',
        modernBuild: args.modernBuild,
        keepAlive: args.keepAlive
      }))
    })
  }

  if (args.report || args['report-json']) { // 分析包内容
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
    modifyConfig(webpackConfig, config => {
      const bundleName = args.target !== 'app'
        ? config.output.filename.replace(/\.js$/, '-')
        : isLegacyBuild ? 'legacy-' : ''

      config.plugins.push(new BundleAnalyzerPlugin({
        logLevel: 'warn',
        openAnalyzer: false,
        analyzerMode: args.report ? 'static' : 'disabled',
        reportFilename: `${bundleName}report.html`,
        statsFilename: `${bundleName}report.json`,
        generateStatsFile: !!args['report-json']
      }))
    })
  }

  if (args.clean) { // 在构建项目之前清除目标目录
    await fs.remove(targetDir)
  }

  return new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      stopSpinner(false)
      if (err) {
        return reject(err)
      }

      if (stats.hasErrors()) {
        return reject(`Build failed with errors.`)
      }

      if (!args.silent) {
        const targetDirShort = path.relative(
          api.service.context,
          targetDir
        )
        log(formatStats(stats, targetDirShort, api))
        if (args.target === 'app' && !isLegacyBuild) {
          if (!args.watch) {
            done(`Build complete. The ${chalk.cyan(targetDirShort)} directory is ready to be deployed.`)
            info(`Check out deployment instructions at ${chalk.cyan(`https://cli.vuejs.org/guide/deployment.html`)}\n`)
          } else {
            done(`Build complete. Watching for changes...`)
          }
        }
      }

      // test-only signal
      if (process.env.VUE_CLI_TEST) {
        console.log('Build complete.')
      }

      resolve()
    })
  })
}

module.exports.defaultModes = {
  build: 'production'
}
