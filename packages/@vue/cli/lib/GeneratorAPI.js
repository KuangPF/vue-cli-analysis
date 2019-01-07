const fs = require('fs')
const ejs = require('ejs')
const path = require('path')
const merge = require('deepmerge')
const resolve = require('resolve')
const isBinary = require('isbinaryfile')
const mergeDeps = require('./util/mergeDeps')
const stringifyJS = require('./util/stringifyJS')
const ConfigTransform = require('./ConfigTransform')
const { getPluginLink, toShortPluginId } = require('@vue/cli-shared-utils')

const isString = val => typeof val === 'string'
const isFunction = val => typeof val === 'function'
const isObject = val => val && typeof val === 'object'
const mergeArrayWithDedupe = (a, b) => Array.from(new Set([...a, ...b]))

class GeneratorAPI {
  /**
   * @param {string} id - Id of the owner plugin
   * @param {Generator} generator - The invoking Generator instance
   * @param {object} options - generator options passed to this plugin
   * @param {object} rootOptions - root options (the entire preset)
   */

  /* eg.
  rootOption = {
     projectName: 'demo',
     useConfigFiles: true,
     plugins: [Object],
     bare: undefined
   } */
  constructor (id, generator, options, rootOptions) {
    this.id = id
    this.generator = generator
    this.options = options
    this.rootOptions = rootOptions

    this.pluginsData = generator.plugins
      .filter(({ id }) => id !== `@vue/cli-service`)
      .map(({ id }) => ({
        name: toShortPluginId(id), // name: babel
        link: getPluginLink(id) // link: https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-babel
      }))

    this._entryFile = undefined
  }

  /**
   * Resolves the data when rendering templates.
   *
   * @private
   */
  _resolveData (additionalData) {
    return Object.assign({
      options: this.options,
      rootOptions: this.rootOptions,
      plugins: this.pluginsData
    }, additionalData)
  }

  /**
   * Inject a file processing middleware.
   *
   * @private
   * @param {FileMiddleware} middleware - A middleware function that receives the
   *   virtual files tree object, and an ejs render function. Can be async.
   */
  _injectFileMiddleware (middleware) {
    this.generator.fileMiddlewares.push(middleware)
  }

  /**
   * Resolve path for a project.
   *
   * @param {string} _path - Relative path from project root
   * @return {string} The resolved absolute path.
   */
  resolve (_path) {
    return path.resolve(this.generator.context, _path)
  }

  /**
   * Check if the project has a given plugin.
   *
   * @param {string} id - Plugin id, can omit the (@vue/|vue-|@scope/vue)-cli-plugin- prefix
   * @return {boolean}
   *
   * 可以略去 (@vue/|vue-|@scope/vue)-cli-plugin- 前缀
   */
  hasPlugin (id) {
    return this.generator.hasPlugin(id)
  }

  /**
   * Configure how config files are extracted.
   *
   * @param {string} key - Config key in package.json
   * @param {object} options - Options
   * @param {object} options.file - File descriptor
   * Used to search for existing file.
   * Each key is a file type (possible values: ['js', 'json', 'yaml', 'lines']).
   * The value is a list of filenames.
   * Example:
   * {
   *   js: ['.eslintrc.js'],
   *   json: ['.eslintrc.json', '.eslintrc']
   * }
   * By default, the first filename will be used to create the config file.
   */
  addConfigTransform (key, options) {
    const hasReserved = Object.keys(this.generator.reservedConfigTransforms).includes(key)
    if (
      hasReserved ||
      !options ||
      !options.file
    ) {
      if (hasReserved) {
        const { warn } = require('@vue/cli-shared-utils')
        warn(`Reserved config transform '${key}'`)
      }
      return
    }

    this.generator.configTransforms[key] = new ConfigTransform(options)
  }

  /**
   * Extend the package.json of the project.
   * Nested fields are deep-merged unless `{ merge: false }` is passed.
   * Also resolves dependency conflicts between plugins.
   * Tool configuration fields may be extracted into standalone files before
   * files are written to disk.
   *
   * @param {object | () => object} fields - Fields to merge.
   *
   * 扩展 package.json
   */
  extendPackage (fields) {
    const pkg = this.generator.pkg
    const toMerge = isFunction(fields) ? fields(pkg) : fields
    for (const key in toMerge) {
      const value = toMerge[key]
      const existing = pkg[key]
      if (isObject(value) && (key === 'dependencies' || key === 'devDependencies')) {
        // use special version resolution merge
        pkg[key] = mergeDeps(
          this.id,
          existing || {},
          value,
          this.generator.depSources
        )
      } else if (!(key in pkg)) {
        pkg[key] = value
      } else if (Array.isArray(value) && Array.isArray(existing)) {
        pkg[key] = mergeArrayWithDedupe(existing, value)
      } else if (isObject(value) && isObject(existing)) {
        pkg[key] = merge(existing, value, { arrayMerge: mergeArrayWithDedupe })
      } else {
        pkg[key] = value
      }
    }
  }



  /**
   * Render template files into the virtual files tree object.
   *
   * @param {string | object | FileMiddleware} source -
   *   Can be one of:
   *   - relative path to a directory;
   *   - Object hash of { sourceTemplate: targetFile } mappings;
   *   - a custom file middleware function.
   * @param {object} [additionalData] - additional data available to templates.
   * @param {object} [ejsOptions] - options for ejs.
   *
   * 渲染 ejs 模板
   */
  render (source, additionalData = {}, ejsOptions = {}) {
    const baseDir = extractCallDir() // path/node_modules/@vue/cli-service/generator
    if (isString(source)) { // source: './template'
      source = path.resolve(baseDir, source)
      this._injectFileMiddleware(async (files) => {
        const data = this._resolveData(additionalData)
        const globby = require('globby')
        const _files = await globby(['**/*'], { cwd: source }) // 匹配 ./template 目录下面的文件
        /**
         * _file:
         * ['_gitignore','public/favicon.ico','public/index.html','src/App.vue','src/main.js', 'src/assets/logo.png','src/components/HelloWorld.vue']
         *
         */
        for (const rawPath of _files) {
          const targetPath = rawPath.split('/').map(filename => {
            // dotfiles are ignored when published to npm, therefore in templates
            // we need to use underscore instead (e.g. "_gitignore")
            // 将 _fileName 类型的文件还原成 .fileName 类型的文件
            if (filename.charAt(0) === '_' && filename.charAt(1) !== '_') {
              return `.${filename.slice(1)}`
            }
            if (filename.charAt(0) === '_' && filename.charAt(1) === '_') {
              return `${filename.slice(1)}`
            }
            return filename
          }).join('/')
          const sourcePath = path.resolve(source, rawPath)
          const content = renderFile(sourcePath, data, ejsOptions)
          // only set file if it's not all whitespace, or is a Buffer (binary files)
          if (Buffer.isBuffer(content) || /[^\s]/.test(content)) {
            files[targetPath] = content
          }
        }
      })
    } else if (isObject(source)) {
      this._injectFileMiddleware(files => {
        const data = this._resolveData(additionalData)
        for (const targetPath in source) {
          const sourcePath = path.resolve(baseDir, source[targetPath])
          const content = renderFile(sourcePath, data, ejsOptions)
          if (Buffer.isBuffer(content) || content.trim()) {
            files[targetPath] = content
          }
        }
      })
    } else if (isFunction(source)) {
      this._injectFileMiddleware(source)
    }
  }

  /**
   * Push a file middleware that will be applied after all normal file
   * middelwares have been applied.
   *
   * @param {FileMiddleware} cb
   *
   * 当一些普通文件的 middelwares 执行完之后执行，比如执行了 render 后，项目初始化时有需要 vue-router，那么就会对 src/App.vue 文件进行
   * 替换，此时就需要将回调 push 到 postProcessFilesCbs 中。
   */

  postProcessFiles (cb) {
    this.generator.postProcessFilesCbs.push(cb)
  }

  /**
   * Push a callback to be called when the files have been written to disk.
   *
   * @param {function} cb
   */
  onCreateComplete (cb) {
    this.generator.completeCbs.push(cb)
  }

  /**
   * Add a message to be printed when the generator exits (after any other standard messages).
   *
   * @param {} msg String or value to print after the generation is completed
   * @param {('log'|'info'|'done'|'warn'|'error')} [type='log'] Type of message
   */
  exitLog (msg, type = 'log') {
    this.generator.exitLogs.push({ id: this.id, msg, type })
  }

  /**
   * convenience method for generating a js config file from json
   */
  genJSConfig (value) {
    return `module.exports = ${stringifyJS(value, null, 2)}`
  }

  /**
   * Add import statements to a file.
   *
   * 注入 import
   */
  injectImports (file, imports) {
    const _imports = (
        this.generator.imports[file] ||
        (this.generator.imports[file] = new Set())
      )
    ;(Array.isArray(imports) ? imports : [imports]).forEach(imp => {
      _imports.add(imp)
    })
  }

  /**
   * Add options to the root Vue instance (detected by `new Vue`).
   *
   * 在 实例话 Vue 的时候注入选项， eg. router
   */
  injectRootOptions (file, options) {
    const _options = (
        this.generator.rootOptions[file] ||
        (this.generator.rootOptions[file] = new Set())
      )
    ;(Array.isArray(options) ? options : [options]).forEach(opt => {
      _options.add(opt)
    })
  }

  /**
   * Get the entry file taking into account typescript.
   *
   * @readonly
   */
  get entryFile () {
    if (this._entryFile) return this._entryFile
    return (this._entryFile = fs.existsSync(this.resolve('src/main.ts')) ? 'src/main.ts' : 'src/main.js')
  }

  /**
   * Is the plugin being invoked?
   *
   * @readonly
   */
  get invoking () {
    return this.generator.invoking
  }
}

function extractCallDir () {
  // extract api.render() callsite file location using error stack
  const obj = {}
  Error.captureStackTrace(obj)
  const callSite = obj.stack.split('\n')[3]
  const fileName = callSite.match(/\s\((.*):\d+:\d+\)$/)[1]
  return path.dirname(fileName)
}

const replaceBlockRE = /<%# REPLACE %>([^]*?)<%# END_REPLACE %>/g


/**
 * @name   path/node_modules/@vue/cli-service/generator/template/_gitignore
 * @data   options rootOptions plugins additionalData
 * @ejsOptions   ejsOptions = {}
 *
 * 渲染文件
 */
function renderFile (name, data, ejsOptions) {
  if (isBinary.sync(name)) { // 检测是否为二进制文件
    return fs.readFileSync(name) // return buffer
  }
  const template = fs.readFileSync(name, 'utf-8')

  // custom template inheritance via yaml front matter.
  // ---
  // extend: 'source-file'
  // replace: !!js/regexp /some-regex/
  // OR
  // replace:
  //   - !!js/regexp /foo/
  //   - !!js/regexp /bar/
  // ---
  const yaml = require('yaml-front-matter')
  const parsed = yaml.loadFront(template)
  const content = parsed.__content
  let finalTemplate = content.trim() + `\n`
  if (parsed.extend) {
    const extendPath = path.isAbsolute(parsed.extend)
      ? parsed.extend
      : resolve.sync(parsed.extend, { basedir: path.dirname(name) })
    finalTemplate = fs.readFileSync(extendPath, 'utf-8')
    if (parsed.replace) {
      if (Array.isArray(parsed.replace)) {
        const replaceMatch = content.match(replaceBlockRE)
        if (replaceMatch) {
          const replaces = replaceMatch.map(m => {
            return m.replace(replaceBlockRE, '$1').trim()
          })
          parsed.replace.forEach((r, i) => {
            finalTemplate = finalTemplate.replace(r, replaces[i])
          })
        }
      } else {
        finalTemplate = finalTemplate.replace(parsed.replace, content.trim())
      }
    }
    if (parsed.when) {
      finalTemplate = (
        `<%_ if (${parsed.when}) { _%>` +
        finalTemplate +
        `<%_ } _%>`
      )
    }
  }

  return ejs.render(finalTemplate, data, ejsOptions)
}

module.exports = GeneratorAPI
