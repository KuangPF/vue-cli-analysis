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
      }
    ],
    sidebar: [{
        title: '前言',
        collapsable: true,
        children: [
          ['foreword/', '介绍']
        ]
      },{
        title: '环境',
        collapsable: true,
        children: [
          ['env/', '介绍']
        ]
      }, {
        title: 'vue init',
        collapsable: false,
        children: [
          ['init/', '👉 step 1'],
          ['init/vue-cli-init-module.md', '👉 step 2'],
          ['init/vue-cli-init-2.x.md', '👉 step 3']
        ]
      }
    ]
  }
};
