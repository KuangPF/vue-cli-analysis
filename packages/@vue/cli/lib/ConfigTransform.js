const transforms = require('./util/configTransforms')

/**
 * eg:
 * new ConfigTransform({
    file: {
      lines: ['.browserslistrc']
    }
  })
 *
 *
 * */

class ConfigTransform {
  constructor(options) {
    this.fileDescriptor = options.file
  }

  /**
   * eg: browserslist
   * @value: [ '> 1%', 'last 2 versions', 'not ie <= 8' ]
   * @checkExisting: false
   * @files: { 'postcss.config.js': 'module.exports = {\n  plugins: {\n    autoprefixer: {}\n  }\n}\n' }
   * @content: path/demo
   *
   * */
  transform(value, checkExisting, files, context) {
    let file
    if (checkExisting) {
      file = this.findFile(files)
    }
    if (!file) {
      file = this.getDefaultFile()
    }
    const {type, filename} = file

    const transform = transforms[type]

    let source
    let existing
    if (checkExisting) {
      source = files[filename]
      if (source) {
        existing = transform.read({
          source,
          filename,
          context
        })
      }
    }

    const content = transform.write({
      source,
      filename,
      context,
      value,
      existing
    })

    return {
      filename,
      content
    }
  }

  findFile(files) {
    for (const type of Object.keys(this.fileDescriptor)) {  // json: ['.eslintrc', '.eslintrc.json'],
      const descriptors = this.fileDescriptor[type]
      for (const filename of descriptors) { // ['.eslintrc', '.eslintrc.json']
        if (files[filename]) {
          return {type, filename}
        }
      }
    }
  }

  getDefaultFile() {
    // 默认取第一种类型
    const [type] = Object.keys(this.fileDescriptor) // ['js', 'json', 'yaml', 'lines']
    const [filename] = this.fileDescriptor[type]
    return {type, filename}
  }
}

module.exports = ConfigTransform
