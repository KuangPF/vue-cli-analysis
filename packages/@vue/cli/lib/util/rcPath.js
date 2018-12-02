const fs = require('fs-extra')
const os = require('os')
const path = require('path')

// linux 系统获取  .vuerc 的路径
const xdgConfigPath = file => {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME
  if (xdgConfigHome) {
    const rcDir = path.join(xdgConfigHome, 'vue')
    if (!fs.existsSync(rcDir)) {
      fs.ensureDirSync(rcDir, 0o700)
    }
    return path.join(rcDir, file)
  }
}

// migration for 3.0.0-rc.7
// we introduced a change storing .vuerc in AppData, but the benefit isn't
// really obvious so we are reverting it to keep consistency across OSes

// 统一 .vuerc 文件的路径，～/.vuerc
// windows: C:\Users\{username}\.vuerc
// darwin: ~/.vuerc
const migrateWindowsConfigPath = file => {
  if (process.platform !== 'win32') {
    return
  }
  const appData = process.env.APPDATA  // C:\Users\{username}\AppData
  if (appData) {
    const rcDir = path.join(appData, 'vue') 
    const rcFile = path.join(rcDir, file) // C:\Users\{username}\AppData\vue\.vuerc
    const properRcFile = path.join(os.homedir(), file) // C:\Users\{username}\.vuerc
    if (fs.existsSync(rcFile)) {
      try {
        if (fs.existsSync(properRcFile)) {
          fs.removeSync(rcFile)
        } else {
          fs.moveSync(rcFile, properRcFile)
        }
      } catch (e) {}
    }
  }
}


// 获取 .vuerc 的路径
// windows darwin(macos) linux
exports.getRcPath = file => {
  migrateWindowsConfigPath(file)
  return (
    process.env.VUE_CLI_CONFIG_PATH ||
    xdgConfigPath(file) ||
    path.join(os.homedir(), file)
  )
}
