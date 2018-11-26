const Metalsmith = require('metalsmith')
const Inquirer = require('inquirer')
const Render = require('consolidate').handlebars.render
const async = require('async')

// Support types from prompt-for which was used before
const promptMapping = {
  string: 'input',
  boolean: 'confirm'
}

// 定义 prompts
var prompts = {
  name: {
    type: 'string',
    required: true,
    message: 'Project name',
  },
  description: {
    type: 'string',
    required: false,
    message: 'Project description',
    default: 'A metalsmith-demo project',
  },
}
Metalsmith(__dirname)
  .use(askQuestion())
  .use(renderTemplateFiles())
  .source('./templates')
  .destination('./src')
  .build((err, files) => {
    if (err) { throw err; }
  })

function askQuestion() {
  return (file, metalsmith, done) => {
    async.eachSeries(Object.keys(prompts), (key, next) => {
      prompt(metalsmith.metadata(), key, prompts[key], next)
    }, done)
  }
}

function prompt(data, key, prompt, done) {
  let promptDefault = prompt.default
  if (typeof prompt.default === 'function') {
    promptDefault = function () {
      return prompt.default.bind(this)(data)
    }
  }
  Inquirer.prompt([{
    type: promptMapping[prompt.type] || prompt.type,
    name: key,
    message: prompt.message || prompt.label || key,
    default: promptDefault,
    choices: prompt.choices || [],
    validate: prompt.validate || (() => true)
  }]).then(answers => {
    if (Array.isArray(answers[key])) {
      data[key] = {}
      answers[key].forEach(multiChoiceAnswer => {
        data[key][multiChoiceAnswer] = true
      })
    } else if (typeof answers[key] === 'string') {
      data[key] = answers[key].replace(/"/g, '\\"')
    } else {
      data[key] = answers[key]
    }
    done()
  }).catch(done)
}

function renderTemplateFiles() {
  return (files, metalsmith, done) => {
    const keys = Object.keys(files)
    const metalsmithMetadata = metalsmith.metadata()
    async.each(keys, (file, next) => {

      const str = files[file].contents.toString()
      // do not attempt to render files that do not have mustaches
      if (!/{{([^{}]+)}}/g.test(str)) {
        return next()
      }
      Render(str, metalsmithMetadata, (err, res) => {
        if (err) {
          err.message = `[${file}] ${err.message}`
          return next(err)
        }
        files[file].contents = new Buffer(res)
        next()
      })
    }, done)
  }
}