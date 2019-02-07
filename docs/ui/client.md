# client 端

client 端可以看作是一个 vue 项目，它是通过 vue 组件构成，在 `ui` 方面使用了自家的 [@vue/ui](https://www.npmjs.com/package/@vue/ui)，由于 server 端采用了 graphql，因此 client 端使用了
[vue-apollo](https://github.com/Akryum/vue-apollo)，这样可以利用其提供的 API 和组件高效方便地使用 graphql 进行查询，变更以及订阅。

client 端的内容非常多，从项目创建到项目配置、运行以及打包发布，涉及到的代码很多，但大部分的流程基本上一直，这就不会一一做分析了，会选择导入项目这部分来分析，因为 ui 命令也是基于插件机制的，而导入项目的时候会涉及到插件加载，利用 PluginAPI 增强项目的配置和任务，以及分享数据和在进程间进行通信，下面就开始分析项目导入的整个过程。

::: tip 源码目录
`vue ui` 运行的客户端是要打包压缩过的代码，目录为 `@vue/cli-ui/dist`，通过以下代码设置了静态资源（文件）目录，访问 `localhost:8000` 则指向
`@vue/cli-ui/dist/index.html`,从而启动了 client 端，对应的源码目录为 `@vue/cli-ui/src`。
``` js
app.use(express.static(distPath, { maxAge: 0 }))
```
:::

## importProject

导入项目的组件为 `@vue/cli-ui/src/components/project-manager/ProjectSelect.vue`，部分代码如下

``` html
<div class="actions-bar center">
  <VueButton
    icon-left="unarchive"
    :label="$route.query.action || $t('org.vue.views.project-select.buttons.import')"
    class="big primary import-project"
    :disabled="folderCurrent && !folderCurrent.isPackage"
    :loading="busy"
    @click="importProject()"
  />
</div>
```
这是不是看着就熟悉了，接着看 `importProject` 方法：

``` js
async importProject (force = false) {
  this.showNoModulesModal = false
  this.busy = true
  await this.$nextTick()
  try {
    await this.$apollo.mutate({
      mutation: PROJECT_IMPORT,
      variables: {
        input: {
          path: this.folderCurrent.path,
          force
        }
      }
    })

    this.$router.push({ name: 'project-home' })
  } catch (e) {
    if (e.graphQLErrors && e.graphQLErrors.some(e => e.message === 'NO_MODULES')) {
      this.showNoModulesModal = true
    }
    this.busy = false
  }
}
```
代码写的比较明了，当执行 `importProject` 时候会利用 vue-apollo 提供的 `this.$apollo.mutate()` 来发送一个 GraphQL 变更，从而改变服务端的数据，接下来就看服务端的 Mutation： `projectImport`。