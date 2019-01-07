const ejs = require('ejs')
const debug = require('debug')
const GeneratorAPI = require('./GeneratorAPI')
const sortObject = require('./util/sortObject')
const writeFileTree = require('./util/writeFileTree')
const inferRootOptions = require('./util/inferRootOptions')
const normalizeFilePaths = require('./util/normalizeFilePaths')
const injectImportsAndOptions = require('./util/injectImportsAndOptions')
const { toShortPluginId, matchesPluginId } = require('@vue/cli-shared-utils')
const ConfigTransform = require('./ConfigTransform')

const logger = require('@vue/cli-shared-utils/lib/logger')
const logTypes = {
  log: logger.log,
  info: logger.info,
  done: logger.done,
  warn: logger.warn,
  error: logger.error
}


// 默认的配置文件，包含 babel，postcss，eslint，jest
const defaultConfigTransforms = {
  babel: new ConfigTransform({
    file: {
      js: ['babel.config.js']
    }
  }),
  postcss: new ConfigTransform({
    file: {
      js: ['postcss.config.js'],
      json: ['.postcssrc.json', '.postcssrc'],
      yaml: ['.postcssrc.yaml', '.postcssrc.yml']
    }
  }),
  eslintConfig: new ConfigTransform({
    file: {
      js: ['.eslintrc.js'],
      json: ['.eslintrc', '.eslintrc.json'],
      yaml: ['.eslintrc.yaml', '.eslintrc.yml']
    }
  }),
  jest: new ConfigTransform({
    file: {
      js: ['jest.config.js']
    }
  }),
  browserslist: new ConfigTransform({
    file: {
      lines: ['.browserslistrc']
    }
  })
}

// vue 保留的 config
const reservedConfigTransforms = {
  vue: new ConfigTransform({
    file: {
      js: ['vue.config.js']
    }
  })
}

const ensureEOL = str => {
  if (str.charAt(str.length - 1) !== '\n') {
    return str + '\n'
  }
  return str
}

module.exports = class Generator {
  constructor (context, {
    pkg = {},
    plugins = [],
    completeCbs = [],
    files = {},
    invoking = false
  } = {}) {
    this.context = context
    this.plugins = plugins
    this.originalPkg = pkg
    this.pkg = Object.assign({}, pkg)
    this.imports = {}
    this.rootOptions = {}
    this.completeCbs = completeCbs
    this.configTransforms = {} // 插件通过 GeneratorAPI 暴露的 addConfigTransform 方法添加如何提取配置文件
    this.defaultConfigTransforms = defaultConfigTransforms // 默认的配置文件
    this.reservedConfigTransforms = reservedConfigTransforms // 保留的配置文件 vue.config.js
    this.invoking = invoking
    // for conflict resolution
    this.depSources = {}
    // virtual file tree
    this.files = files
    this.fileMiddlewares = [] // receives the virtual files tree object, and an ejs render function
    this.postProcessFilesCbs = []
    // exit messages
    this.exitLogs = []

    const cliService = plugins.find(p => p.id === '@vue/cli-service')

    /* rootOption = {
      projectName: 'demo',
      useConfigFiles: true,
      plugins: [Object],
      bare: undefined
    } */
    const rootOptions = cliService
      ? cliService.options
      : inferRootOptions(pkg)
    // apply generators from plugins
    plugins.forEach(({ id, apply, options }) => {
      const api = new GeneratorAPI(id, this, options, rootOptions)
      apply(api, options, rootOptions, invoking)
    })
  }

  async generate ({
                    extractConfigFiles = false,
                    checkExisting = false
                  } = {}) {
    // save the file system before applying plugin for comparison
    const initialFiles = Object.assign({}, this.files)

    // extract configs from package.json into dedicated files.
    // 将一些配置文件从 package.json 中提取到对应的配置文件中，比如 postcss.config.js，babel.config.js 等等。
    this.extractConfigFiles(extractConfigFiles, checkExisting)

    // wait for file resolve
    await this.resolveFiles()  // 模版渲染
    // set package.json
    this.sortPkg()
    this.files['package.json'] = JSON.stringify(this.pkg, null, 2) + '\n'

    // write/update file tree to disk
    // 将内存中的保存的文件字符写入文件
    await writeFileTree(this.context, this.files, initialFiles)
  }

  extractConfigFiles (extractAll, checkExisting) {
    const configTransforms = Object.assign({},
      defaultConfigTransforms,
      this.configTransforms,
      reservedConfigTransforms
    )
    const extract = key => {
      if (
        configTransforms[key] &&
        this.pkg[key] &&
        // do not extract if the field exists in original package.json
        !this.originalPkg[key]
      ) {
        const value = this.pkg[key]
        const configTransform = configTransforms[key]
        const res = configTransform.transform(
          value,
          checkExisting,
          this.files,
          this.context
        )
        const { content, filename } = res
        this.files[filename] = ensureEOL(content)
        delete this.pkg[key]
      }
    }
    if (extractAll) {
      for (const key in this.pkg) {
        extract(key)
      }
    } else {
      if (!process.env.VUE_CLI_TEST) {
        // by default, always extract vue.config.js
        extract('vue')
      }
      // always extract babel.config.js as this is the only way to apply
      // project-wide configuration even to dependencies.
      // TODO: this can be removed when Babel supports root: true in package.json
      extract('babel')
    }
  }

  sortPkg () {
    // ensure package.json keys has readable order
    // 对 package.json 中的字段进行排序
    this.pkg.dependencies = sortObject(this.pkg.dependencies)
    this.pkg.devDependencies = sortObject(this.pkg.devDependencies)
    this.pkg.scripts = sortObject(this.pkg.scripts, [
      'serve',
      'build',
      'test',
      'e2e',
      'lint',
      'deploy'
    ])
    this.pkg = sortObject(this.pkg, [
      'name',
      'version',
      'private',
      'description',
      'author',
      'scripts',
      'dependencies',
      'devDependencies',
      'vue',
      'babel',
      'eslintConfig',
      'prettier',
      'postcss',
      'browserslist',
      'jest'
    ])

    debug('vue:cli-pkg')(this.pkg)
  }

  async resolveFiles () {
    const files = this.files
    for (const middleware of this.fileMiddlewares) {
      await middleware(files, ejs.render)
    }
    // normalize file paths on windows
    // all paths are converted to use / instead of \
    normalizeFilePaths(files)
    // handle imports and root option injections
    // 将 generator 注入的 import 和 rootOption 解析到对应的文件中
    Object.keys(files).forEach(file => {
      files[file] = injectImportsAndOptions(
        files[file],
        this.imports[file],
        this.rootOptions[file]
      )
    })

    // 所有 fileMiddlewares 的回调执行完成之后会执行 postProcessFilesCbs 里面的回调
    // eg: 将 @vue/cli-service/generator/index.js 中的 render 是放在了 fileMiddlewares 里面，而将
    // @vue/cli-service/generator/router/index.js 中将替换 src/App.vue 文件的方法放在了 postProcessFiles 里面，原因是对
    // src/App.vue 文件的一些替换一定是发生在 render 函数之后，如果在之前，那么修改后的 src/App.vue 在之后render 函数执行时又会被覆盖，这样
    // 显然不合理

    for (const postProcess of this.postProcessFilesCbs) {
      await postProcess(files)
    }
    debug('vue:cli-files')(this.files)
  }

  hasPlugin (_id) {
    if (_id === 'router') _id = 'vue-router'
    if (['vue-router', 'vuex'].includes(_id)) {
      const pkg = this.pkg
      return ((pkg.dependencies && pkg.dependencies[_id]) || (pkg.devDependencies && pkg.devDependencies[_id]))
    }
    return [
      ...this.plugins.map(p => p.id),
      ...Object.keys(this.pkg.devDependencies || {}),
      ...Object.keys(this.pkg.dependencies || {})
    ].some(id => matchesPluginId(_id, id))
  }

  printExitLogs () {
    if (this.exitLogs.length) {
      this.exitLogs.forEach(({ id, msg, type }) => {
        const shortId = toShortPluginId(id)
        const logFn = logTypes[type]
        if (!logFn) {
          logger.error(`Invalid api.exitLog type '${type}'.`, shortId)
        } else {
          logFn(msg, msg && shortId)
        }
      })
      logger.log()
    }
  }
}
