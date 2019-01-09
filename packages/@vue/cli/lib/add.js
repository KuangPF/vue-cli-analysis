const chalk = require('chalk')
const invoke = require('./invoke')
const { loadOptions } = require('./options')
const { installPackage } = require('./util/installDeps')
const {
  log,
  error,
  hasProjectYarn,
  resolvePluginId,
  resolveModule,
  loadModule
} = require('@vue/cli-shared-utils')

async function add (pluginName, options = {}, context = process.cwd()) {
  // special internal "plugins"
  // 内部 plugin
  if (/^(@vue\/)?router$/.test(pluginName)) { // 匹配 @vue/router，router。 ? 表示匹配前面的子表达式零次或一次
    return addRouter(context)
  }
  if (/^(@vue\/)?vuex$/.test(pluginName)) { // 匹配 @vue/vuex，vuex
    return addVuex(context)
  }

  // 解析插件名称
  // full id, scoped short, or default short
  // @bar/foo => @bar/vue-cli-plugin-foo
  // @vue/foo => @vue/cli-plugin-foo
  // foo => vue-cli-plugin-foo
  const packageName = resolvePluginId(pluginName)

  log()
  log(`📦  Installing ${chalk.cyan(packageName)}...`)
  log()

  const packageManager = loadOptions().packageManager || (hasProjectYarn(context) ? 'yarn' : 'npm')
  await installPackage(context, packageManager, options.registry, packageName)

  log(`${chalk.green('✔')}  Successfully installed plugin: ${chalk.cyan(packageName)}`)
  log()

  const generatorPath = resolveModule(`${packageName}/generator`, context)
  if (generatorPath) {
    invoke(pluginName, options, context)
  } else {
    log(`Plugin ${packageName} does not have a generator to invoke`)
  }
}

async function addRouter (context) {
  const inquirer = require('inquirer')
  const options = await inquirer.prompt([{
    name: 'routerHistoryMode',
    type: 'confirm',
    message: `Use history mode for router? ${chalk.yellow(`(Requires proper server setup for index fallback in production)`)}`
  }])
  invoke.runGenerator(context, {
    id: 'core:router',
    apply: loadModule('@vue/cli-service/generator/router', context),
    options
  })
}

async function addVuex (context) {
  invoke.runGenerator(context, {
    id: 'core:vuex',
    apply: loadModule('@vue/cli-service/generator/vuex', context)
  })
}

module.exports = (...args) => {
  return add(...args).catch(err => {
    error(err)
    if (!process.env.VUE_CLI_TEST) {
      process.exit(1)
    }
  })
}
