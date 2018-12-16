# 基础验证

当执行 vue create 命令的时候会加载 cli/lib/create.js 中的 create 函数。在 create 函数里会先定义以下几个变量：

``` js
const cwd = options.cwd || process.cwd() // 当前目录
const inCurrent = projectName === '.' // 是否在当前目录
const name = inCurrent ? path.relative('../', cwd) : projectName // 项目名称
const targetDir = path.resolve(cwd, projectName || '.') // 生成项目的目录
```
比较重要的就是 name 和 targetDir 这两个，在下面的运行过程中会使用到。
