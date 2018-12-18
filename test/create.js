function camelize (str) {
  return str.replace(/-(\w)/g, (_, c) => c ? c.toUpperCase() : '')
}

// console.log(camelize('user-name'))

const cli = cli=> {
  cli.say('vue cli')
}

class API {
  constructor() {

  }
  say(msg) {
    console.log(msg)
  }
}

const api = new API()
console.log(cli(api))
// cli(api)
