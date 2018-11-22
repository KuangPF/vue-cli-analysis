const Metalsmith = require('metalsmith')
const Inquirer = require('inquirer')
const Render = require('consolidate').handlebars.render
const async = require('async')

Metalsmith(__dirname)
  .metadata({
    name: 'hello metalsmith',
    description: 'some description'
  })
  .use(renderTemplateFiles())
  .source('./templates')
  .destination('./src')
  .build((err, files) => {
    if (err) { throw err; }
  })

function askQuestion() {
  return (file, metalsmith, done) => {
    
  }
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