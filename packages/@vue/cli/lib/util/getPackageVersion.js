const { request } = require('@vue/cli-shared-utils')

// const res = await getPackageVersion('vue-cli-version-marker', 'latest')
module.exports = async function getPackageVersion(id, range = '') {
  const registry = (await require('./shouldUseTaobao')()) ?
    `https://registry.npm.taobao.org` :
    `https://registry.npmjs.org`

  let result

  try {
    // https://registry.npm.taobao.org/vue-cli-version-marker/latest
    result = await request.get(`${registry}/${encodeURIComponent(id).replace(/^%40/, '@')}/${range}`)
  } catch (e) {
    return e
  }
  return result
}

/**
 * 为什么通过 vue-cli-version-marker 获取 vue-cli 的版本，而不是直接获取 vue-cli 的版本
 * 官方介绍：
 * The npm registry does not expose /latest endpoints for scoped packages. Getting the full metadata for a scoped package is typically ~300ms slower than simply getting the latest version from an unscoped package.
 * 翻译一下大致有一下两点原因 
 * 1. vue-cli 从 3.0 开始是一个 scoped package ( @vue/cli ) ，但是 npm registry 对于 scoped packages 并没有暴露获取 latest 版本的 api，
 * 2. 获取 scoped packages 的数据比获取 unscoped package 通常要慢 300ms
 * 因此通过 unscoped package （vue-cli-version-marker） 获取 @vue 下面所有的 scoped packages 的版本号
 * /


/** 
 * https://registry.npmjs.org/@vue/cli （可以正常访问）
 * https://registry.npmjs.org/@vue/cli/latest （不能正常访问）
*/



/**
 * vue-cli-version-marker：
 * 
 *  { 
 *    "@vue/babel-preset-app": "3.2.0", 
 *    "@vue/cli-init": "3.2.0", 
 *    "@vue/cli-overlay": "3.2.0",
 *    "@vue/cli-plugin-babel": "3.2.0", 
 *    "@vue/cli-plugin-e2e-cypress": "3.2.0", 
 *    "@vue/cli-plugin-e2e-nightwatch": "3.2.0", 
 *    "@vue/cli-plugin-eslint": "3.2.1", 
 *    "@vue/cli-plugin-pwa": "3.2.0", 
 *    "@vue/cli-plugin-typescript": "3.2.0", 
 *    "@vue/cli-plugin-unit-jest": "3.2.0", 
 *    "@vue/cli-plugin-unit-mocha": "3.2.0", 
 *    "@vue/cli-service-global": "3.2.1", 
 *    "@vue/cli-service": "3.2.0", 
 *    "@vue/cli-shared-utils": "3.2.0", 
 *    "@vue/cli-test-utils": "3.2.0", 
 *    "@vue/cli-ui-addon-webpack": "3.2.1", 
 *    "@vue/cli-ui-addon-widgets": "3.2.1", 
 *    "@vue/cli-ui": "3.2.1", 
 *    "@vue/cli-upgrade": "3.2.0", 
 *    "@vue/cli": "3.2.1" 
 *  } 
 * */