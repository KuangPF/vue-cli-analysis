# generator

在安装完依赖以后，就会调用 generators ，首先后实例化一个 Generator ，看代码：
```js
const generator = new Generator(context, {
  pkg,
  plugins,
  completeCbs: createCompleteCbs
})
```
