const path = require('path')
const chalk = require('chalk')
const debug = require('debug')
const execa = require('execa')
const inquirer = require('inquirer')
const EventEmitter = require('events')
const Generator = require('./Generator')
const cloneDeep = require('lodash.clonedeep')
const sortObject = require('./util/sortObject')
const getVersions = require('./util/getVersions')
const { installDeps } = require('./util/installDeps')
const { clearConsole } = require('./util/clearConsole')
const PromptModuleAPI = require('./PromptModuleAPI')
const writeFileTree = require('./util/writeFileTree')
const { formatFeatures } = require('./util/features')
const loadLocalPreset = require('./util/loadLocalPreset')
const loadRemotePreset = require('./util/loadRemotePreset')
const generateReadme = require('./util/generateReadme')

const {
  defaults,
  saveOptions,
  loadOptions,
  savePreset,
  validatePreset
} = require('./options')

const {
  log,
  warn,
  error,
  hasGit,
  hasProjectGit,
  hasYarn,
  logWithSpinner,
  stopSpinner,
  exit,
  loadModule
} = require('@vue/cli-shared-utils')

const isManualMode = answers => answers.preset === '__manual__'

// 入口
module.exports = class Creator extends EventEmitter {
  // const creator = new Creator(name, targetDir, getPromptModules())
  constructor (name, context, promptModules) {
    super() // 调用 EventEmitter()
    this.name = name
    this.context = process.env.VUE_CLI_CONTEXT = context
    const { presetPrompt, featurePrompt } = this.resolveIntroPrompts() // 获取了 presetPrompt list，在初始化项目的时候提供选择
    this.presetPrompt = presetPrompt // presetPrompt list
    this.featurePrompt = featurePrompt // babal, pwa, e2e etc.
    this.outroPrompts = this.resolveOutroPrompts() //  存放项目配置的文件（package.json || congfig.js） 以及是否将 presetPrompts 存放起来
    this.injectedPrompts = [] // 对应 feature 的 Prompts
    this.promptCompleteCbs = [] // injectedPrompts 的回调
    this.createCompleteCbs = []

    this.run = this.run.bind(this)

    const promptAPI = new PromptModuleAPI(this)

    /**
     * 1. 将 babel, e2e, pwa 等 push 到 featurePrompt.choices 中，在选择项目需要配置哪些时显示出来 （checkbox）；
     * 2. 将 babel, e2e, pwa 等 push 到 injectedPrompts 中，当设置了 feature 会对应通过 Prompts 来进一步选择哪种模式，比如当选择了 E2E Testing ，然后会再次让你
     *    选择哪种 E2E Testing，即， Cypress (Chrome only) ||  Nightwatch (Selenium-based)；
     * 3. 将每中 feature 的 onPromptComplete push 到 promptCompleteCbs，在后面会根据选择的配置来安装对应的 plugin。
     */
    promptModules.forEach(m => m(promptAPI))
  }

  async create (cliOptions = {}, preset = null) {
    const isTestOrDebug = process.env.VUE_CLI_TEST || process.env.VUE_CLI_DEBUG
    console.log('before creating......')
    // name: demo
    // context: targetDir
    const { run, name, context, createCompleteCbs } = this

    if (!preset) {
      if (cliOptions.preset) {
        // vue create foo --preset bar
        preset = await this.resolvePreset(cliOptions.preset, cliOptions.clone)
      } else if (cliOptions.default) {
        // vue create foo --default
        preset = defaults.presets.default // 使用默认预设选项
      } else if (cliOptions.inlinePreset) { // 使用内联的 JSON 字符串预设选项
        // vue create foo --inlinePreset {...}
        try {
          preset = JSON.parse(cliOptions.inlinePreset)
        } catch (e) {
          error(`CLI inline preset is not valid JSON: ${cliOptions.inlinePreset}`)
          exit(1)
        }
      } else {
        // eg: vue create demo
        preset = await this.promptAndResolvePreset()
      }
    }

    // clone before mutating
    preset = cloneDeep(preset)
    // inject core service
    preset.plugins['@vue/cli-service'] = Object.assign({ // 注入核心 @vue/cli-service
      projectName: name
    }, preset, {
      bare: cliOptions.bare
    })

    // 获取包管理器
    const packageManager = (
      cliOptions.packageManager ||
      loadOptions().packageManager ||
      (hasYarn() ? 'yarn' : 'npm')
    )

    await clearConsole()
    logWithSpinner(`✨`, `Creating project in ${chalk.yellow(context)}.`)
    this.emit('creation', { event: 'creating' })

    // get latest CLI version
    const { latest } = await getVersions()
    // generate package.json with plugin dependencies
    const pkg = {
      name,
      version: '0.1.0',
      private: true,
      devDependencies: {}
    }
    const deps = Object.keys(preset.plugins)
    deps.forEach(dep => {
      if (preset.plugins[dep]._isPreset) { // 本地调试 preset 或者从远处获取 preset，因此不用加入 devDependencies 中
        return
      }
      pkg.devDependencies[dep] = (
        preset.plugins[dep].version ||
        ((/^@vue/.test(dep) && latest[dep]) ? `^${latest[dep]}` : `latest`)
      )
    })
    // write package.json
    await writeFileTree(context, {
      'package.json': JSON.stringify(pkg, null, 2)
    })

    // intilaize git repository before installing deps
    // so that vue-cli-service can setup git hooks.
    const shouldInitGit = await this.shouldInitGit(cliOptions)
    if (shouldInitGit) {
      logWithSpinner(`🗃`, `Initializing git repository...`)
      this.emit('creation', { event: 'git-init' })
      await run('git init')
    }

    // install plugins
    stopSpinner()
    log(`⚙  Installing CLI plugins. This might take a while...`)
    log()
    this.emit('creation', { event: 'plugins-install' })
    if (isTestOrDebug) {
      // in development, avoid installation process
      await require('./util/setupDevProject')(context) // @vue/cli-service/bin/vue-cli-service
    } else {
      await installDeps(context, packageManager, cliOptions.registry)
    }

    // run generator
    log(`🚀  Invoking generators...`)
    this.emit('creation', { event: 'invoking-generators' })
    const plugins = await this.resolvePlugins(preset.plugins)

    const generator = new Generator(context, {
      pkg,
      plugins,
      completeCbs: createCompleteCbs
    })

    await generator.generate({
      extractConfigFiles: preset.useConfigFiles // 如果选择将配置配件注入到 package.json 中的话，extractConfigFiles = false
    })

    return;
    //TODO
    // install additional deps (injected by generators)
    log(`📦  Installing additional dependencies...`)
    this.emit('creation', { event: 'deps-install' })
    log()
    if (!isTestOrDebug) {
      await installDeps(context, packageManager, cliOptions.registry)
    }

    // run complete cbs if any (injected by generators)
    logWithSpinner('⚓', `Running completion hooks...`)
    this.emit('creation', { event: 'completion-hooks' })
    for (const cb of createCompleteCbs) {
      await cb()
    }

    // generate README.md
    stopSpinner()
    log()
    logWithSpinner('📄', 'Generating README.md...')
    await writeFileTree(context, {
      'README.md': generateReadme(generator.pkg, packageManager)
    })

    // commit initial state
    let gitCommitFailed = false
    if (shouldInitGit) {
      await run('git add -A')
      if (isTestOrDebug) {
        await run('git', ['config', 'user.name', 'test'])
        await run('git', ['config', 'user.email', 'test@test.com'])
      }
      const msg = typeof cliOptions.git === 'string' ? cliOptions.git : 'init'
      try {
        await run('git', ['commit', '-m', msg])
      } catch (e) {
        gitCommitFailed = true
      }
    }

    // log instructions
    stopSpinner()
    log()
    log(`🎉  Successfully created project ${chalk.yellow(name)}.`)
    log(
      `👉  Get started with the following commands:\n\n` +
      (this.context === process.cwd() ? `` : chalk.cyan(` ${chalk.gray('$')} cd ${name}\n`)) +
      chalk.cyan(` ${chalk.gray('$')} ${packageManager === 'yarn' ? 'yarn serve' : 'npm run serve'}`)
    )
    log()
    this.emit('creation', { event: 'done' })

    if (gitCommitFailed) {
      warn(
        `Skipped git commit due to missing username and email in git config.\n` +
        `You will need to perform the initial commit yourself.\n`
      )
    }

    generator.printExitLogs()
  }

  run (command, args) {
    if (!args) { [command, ...args] = command.split(/\s+/) }
    return execa(command, args, { cwd: this.context })
  }

  async promptAndResolvePreset (answers = null) {
    // prompt
    if (!answers) {
      await clearConsole(true)
      answers = await inquirer.prompt(this.resolveFinalPrompts())
    }
    debug('vue-cli:answers')(answers)

    if (answers.packageManager) {
      saveOptions({
        packageManager: answers.packageManager
      })
    }

    let preset
    if (answers.preset && answers.preset !== '__manual__') { // 如果是选择使用本地保存的 preset (~/.vuerc) 或者 default
      preset = await this.resolvePreset(answers.preset)
    } else {
      // manual
      preset = {
        useConfigFiles: answers.useConfigFiles === 'files',
        plugins: {}
      }
      answers.features = answers.features || []
      // run cb registered by prompt modules to finalize the preset
      this.promptCompleteCbs.forEach(cb => cb(answers, preset))
    }

    // validate
    validatePreset(preset)

    // save preset
    if (answers.save && answers.saveName) {
      savePreset(answers.saveName, preset)
    }

    debug('vue-cli:preset')(preset)
    return preset
  }

  async resolvePreset (name, clone) { // preset name: cli-demo
    let preset
    const savedPresets = loadOptions().presets || {} // 获取 .vuerc 中保存的 preset
    if (name in savedPresets) { // 如果 -p 的 preset 在 .vuerc 中存在  eg： cli-demo
      preset = savedPresets[name] // 获取项目初始化配置
    } else if (name.endsWith('.json') || /^\./.test(name) || path.isAbsolute(name)) {
      preset = await loadLocalPreset(path.resolve(name))
    } else if (name.includes('/')) {
      logWithSpinner(`Fetching remote preset ${chalk.cyan(name)}...`)
      this.emit('creation', { event: 'fetch-remote-preset' })
      try {
        preset = await loadRemotePreset(name, clone)
        stopSpinner()
      } catch (e) {
        stopSpinner()
        error(`Failed fetching remote preset ${chalk.cyan(name)}:`)
        throw e
      }
    }

    // use default preset if user has not overwritten it
    if (name === 'default' && !preset) {  // defaultPreset eg: vue create demo -p default
      preset = defaults.presets.default
    }
    if (!preset) {
      error(`preset "${name}" not found.`)
      const presets = Object.keys(savedPresets)
      if (presets.length) { // 列出已保存的 preset
        log()
        log(`available presets:\n${presets.join(`\n`)}`)
      } else { // no preset
        log(`you don't seem to have any saved preset.`)
        log(`run vue-cli in manual mode to create a preset.`)
      }
      exit(1)
    }
    // preset
    /* {
      useConfigFiles: true,
      plugins: {
        '@vue/cli-plugin-babel': {},
        '@vue/cli-plugin-eslint': [Object]
      }
    } */
    return preset
  }

  // { id: options } => [{ id, apply, options }]
  async resolvePlugins (rawPlugins) {
    // ensure cli-service is invoked first
    rawPlugins = sortObject(rawPlugins, ['@vue/cli-service'], true)
    /* let rawPlugins = {
        '@vue/cli-service': {
          'projectName': 'demo',
          useConfigFiles: true,
          plugins: {
            '@vue/cli-plugin-babel': {},
            '@vue/cli-plugin-eslint': [Object]
          },
          bare: undefined
        },
        '@vue/cli-plugin-babel': {},
        '@vue/cli-plugin-eslint': { config: 'standard', _isPreset: true, lintOn: ['save'] }
      } */
    const plugins = []
    for (const id of Object.keys(rawPlugins)) {
      // loadModule('@vue/cli-service/generator', '/Users/../vue-cli/demo')
      const apply = loadModule(`${id}/generator`, this.context) || (() => {})
      let options = rawPlugins[id] || {}
      if (options.prompts) {
        const prompts = loadModule(`${id}/prompts`, this.context)
        if (prompts) { //
          log()
          log(`${chalk.cyan(options._isPreset ? `Preset options:` : id)}`)
          options = await inquirer.prompt(prompts)
        }
      }
      plugins.push({ id, apply, options })
    }
    return plugins
  }

  getPresets () {
    const savedOptions = loadOptions() // 加载 ～/.vuerc，获取相关配置
    return Object.assign({}, savedOptions.presets, defaults.presets)
  }

  resolveIntroPrompts () {
    const presets = this.getPresets() // 将 defaults.presets 与 ～/.vuerc 合并
    const presetChoices = Object.keys(presets).map(name => {
      return {
        name: `${name} (${formatFeatures(presets[name])})`,
        value: name
      }
    })
    // 将保存的 preset 列出来，提供选择
    // presetPrompt =》 presetList
    const presetPrompt = {
      name: 'preset',
      type: 'list',
      message: `Please pick a preset:`,
      choices: [
        ...presetChoices,
        {
          name: 'Manually select features',
          value: '__manual__'
        }
      ]
    }
    // featurePrompt： 项目需要安装什么， 比如 Babel TypeScript Progressive Web App (PWA) Support
    const featurePrompt = {
      name: 'features',
      when: isManualMode,
      type: 'checkbox',
      message: 'Check the features needed for your project:',
      choices: [],
      pageSize: 10
    }
    return {
      presetPrompt,
      featurePrompt
    }
  }

  // 其他 prompts
  resolveOutroPrompts () {
    // 将配置文件存放在 config 中， 还是存放在 package.json 中
    const outroPrompts = [
      {
        name: 'useConfigFiles',
        when: isManualMode,
        type: 'list',
        message: 'Where do you prefer placing config for Babel, PostCSS, ESLint, etc.?',
        choices: [
          {
            name: 'In dedicated config files',
            value: 'files'
          },
          {
            name: 'In package.json',
            value: 'pkg'
          }
        ]
      },
      {
        name: 'save',
        when: isManualMode,
        type: 'confirm',
        message: 'Save this as a preset for future projects?',
        default: false
      },
      {
        name: 'saveName',
        when: answers => answers.save,
        type: 'input',
        message: 'Save preset as:'
      }
    ]

    // ask for packageManager once
    const savedOptions = loadOptions()
    if (!savedOptions.packageManager && hasYarn()) {
      outroPrompts.push({
        name: 'packageManager',
        type: 'list',
        message: 'Pick the package manager to use when installing dependencies:',
        choices: [
          {
            name: 'Use Yarn',
            value: 'yarn',
            short: 'Yarn'
          },
          {
            name: 'Use NPM',
            value: 'npm',
            short: 'NPM'
          }
        ]
      })
    }

    return outroPrompts
  }

  resolveFinalPrompts () {
    // patch generator-injected prompts to only show in manual mode
    // 将所有的 Prompt 合并，包含 preset，feature，injected，outro，只有当选择了手动模式的时候才会显示 injectedPrompts
    this.injectedPrompts.forEach(prompt => {
      const originalWhen = prompt.when || (() => true)
      prompt.when = answers => {
        return isManualMode(answers) && originalWhen(answers)
      }
    })
    const prompts = [
      this.presetPrompt,
      this.featurePrompt,
      ...this.injectedPrompts,
      ...this.outroPrompts
    ]
    debug('vue-cli:prompts')(prompts)
    return prompts
  }

  async shouldInitGit (cliOptions) {
    if (!hasGit()) {
      return false
    }
    // --git
    if (cliOptions.forceGit) {
      return true
    }
    // --no-git
    if (cliOptions.git === false || cliOptions.git === 'false') {
      return false
    }
    // default: true unless already in a git repo
    return !hasProjectGit(this.context)
  }
}
