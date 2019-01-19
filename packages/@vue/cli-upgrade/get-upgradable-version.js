const execa = require('execa')

function getMaxSatisfying (packageName, range) {
  let version = JSON.parse(
    execa.shellSync(`npm view ${packageName}@${range} version --json`).stdout
  )

  if (typeof version !== 'string') {
    version = version[0]
  }

  return version
}

module.exports = function getUpgradableVersion (
  packageName,
  currRange,
  semverLevel
) {
  let newRange
  if (semverLevel === 'patch') { // 安装最近的小版本依赖包， 补丁号
    const currMaxVersion = getMaxSatisfying(packageName, currRange)
    newRange = `~${currMaxVersion}`
    const newMaxVersion = getMaxSatisfying(packageName, newRange)
    newRange = `~${newMaxVersion}`
  } else if (semverLevel === 'minor') { // 安装最近大版本依赖包，次版本号
    const currMaxVersion = getMaxSatisfying(packageName, currRange)
    newRange = `^${currMaxVersion}`
    const newMaxVersion = getMaxSatisfying(packageName, newRange)
    newRange = `^${newMaxVersion}`
  } else if (semverLevel === 'major') { // 主版本号
    newRange = `^${getMaxSatisfying(packageName, 'latest')}`
  } else {
    throw new Error('Release type must be one of patch | minor | major!')
  }

  return newRange
}
