# vue create 整体分析

先通过一张流程图大致聊了解下 `vue create` 的过程:

<img :src="$withBase('/assets/create-overall.png')">

从这个图可以直观地感受到 `vue create` 整个过程还是比较复杂的，为了比较清楚的讲解整个过程，大致分为了 5 个部分，如下：

* **[基础验证](/create/basic-verification.html)**
* **[获取预设选项](/create/get-preset.html)**
* **[依赖安装](/create/install-deps.html)**
* **[Generator](/create/generator.html)**
* **[结尾分析](/create/end-part.html)**

下面将一节一节的来分析 `vue create` 的源码。
