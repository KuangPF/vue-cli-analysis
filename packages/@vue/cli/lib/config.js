const fs = require('fs-extra')
const path = require('path')
const homedir = require('os').homedir()
const { get, set, unset, error, launch } = require('@vue/cli-shared-utils')

async function config (value, options) {
  const file = path.resolve(homedir, '.vuerc') // 获取 .vuerc 路径
  const config = await fs.readJson(file) // 获取 .vuerc 中的内容

  if (!options.delete && !options.get && !options.edit && !options.set) { // 输出 .vuerc 内容
    if (options.json) { // --json
      console.log(JSON.stringify({
        resolvedPath: file,
        content: config
      }))
    } else {
      console.log('Resolved path: ' + file + '\n', JSON.stringify(config, null, 2))
    }
  }


  /*exports.get = function (target, path) {
    const fields = path.split('.')
    let obj = target
    const l = fields.length
    for (let i = 0; i < l - 1; i++) {
      const key = fields[i]
      if (!obj[key]) {
        return undefined
      }
      obj = obj[key]
    }
    return obj[fields[l - 1]]
  }*/
  if (options.get) { // 获取 .vuerc 中某个指定的配置，vue config -g presets 可以获取预设的值
    const value = get(config, options.get)
    if (options.json) {
      console.log(JSON.stringify({
        value
      }))
    } else {
      console.log(value)
    }
  }

  if (options.delete) { // 删除 .vuerc 中某个指定的配置
    unset(config, options.delete)
    await fs.writeFile(file, JSON.stringify(config, null, 2), 'utf-8')
    if (options.json) {
      console.log(JSON.stringify({
        deleted: options.delete
      }))
    } else {
      console.log(`You have removed the option: ${options.delete}`)
    }
  }

  if (options.edit) { // 启用编辑器编辑 .vuerc
    launch(file)
  }

  if (options.set && !value) {
    throw new Error(`Make sure you define a value for the option ${options.set}`)
  }

  if (options.set && value) { // 设置选项
    set(config, options.set, value)

    if (value.match('[0-9]')) {
      set(config, options.set, parseInt(value))
    }

    if (value === 'true') {
      set(config, options.set, true)
    }

    if (value === 'false') {
      set(config, options.set, false)
    }

    await fs.writeFile(file, JSON.stringify(config, null, 2), 'utf-8')
    if (options.json) {
      console.log(JSON.stringify({
        updated: options.set
      }))
    } else {
      console.log(`You have updated the option: ${options.set} to ${value}`)
    }
  }
}

module.exports = (...args) => {
  return config(...args).catch(err => {
    error(err)
    if (!process.env.VUE_CLI_TEST) {
      process.exit(1)
    }
  })
}
