# client 端

client 端可以看作是一个 vue 项目，它是通过 vue 组件构成，在 `ui` 方面使用了自家的 [@vue/ui](https://www.npmjs.com/package/@vue/ui)，由于 server 端采用了 graphql，因此 client 端使用了
[vue-apollo](https://github.com/Akryum/vue-apollo)，这样可以利用其提供的 API 和组件高效方便地使用 graphql 进行查询，变更以及订阅。

