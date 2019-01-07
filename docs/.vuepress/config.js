module.exports = {
  base: '/vue-cli-analysis/',
  title: 'vue-cli-analysis',
  description: 'vue-cli 源码分析',
  head: [
    ['link', {
      rel: 'icon',
      href: `/logo.png`
    }]
  ],
  themeConfig: {
    repo: 'KuangPF/vue-cli-analysis',
    editLinks: true,
    docsDir: 'docs',
    editLinkText: '在 GitHub 上编辑此页',
    lastUpdated: '上次更新',
    nav: [{
      text: '首页',
      link: '/'
    }],
    sidebar: [{
      title: '前言',
      collapsable: false,
      children: [
        ['foreword/', '介绍']
      ]
    }, {
      title: '开始',
      collapsable: false,
      children: [
        ['start/env', '环境介绍'],
        ['start/npm', '常见 npm 包']
      ]
    }, {
      title: 'vue create',
      collapsable: false,
      children: [
        ['create/', 'create 入口'],
        ['create/overall-analysis.md', '整体分析'],
        ['create/basic-verification.md', '基础验证'],
        ['create/get-preset.md', '获取预设选项（preset）'],
        ['create/install-deps.md', '依赖安装（installDeps）'],
        ['create/generator.md', 'Generator'],
        ['create/end-part.md', '结尾分析'],
        ['create/summary.md', '总结']
      ]
    }, {
      title: 'vue init',
      collapsable: false,
      children: [
        ['init/', 'init 入口'],
        ['init/vue-cli-init-module.md', '@vue/cli-init 分析'],
        ['init/vue-cli-init-2.x.md', 'vue-cli 2.x  init 分析'],
        ['init/generate.md', 'generate 函数分析'],
        ['init/summary.md', '总结']
      ]
    }]
  }
};
