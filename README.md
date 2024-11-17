## 快速开始

- 拉取项目

```shell
git clone https://github.com/RicardoPang/pf-vue3.git
```

- 安装依赖

```shell
npm install
```

- 运行项目

```shell
npm run dev
```

- 调试代码

```shell
打开examples下的html文件进行查看和调试
```

## Vue3 设计思想

- 声明式框架
  > 声明式代码更加简单 不需要关注实现 按照要求填代码就可以
- 采用虚拟 DOM
  > 虚拟 DOM 就是一个对象 用来描述真实 DOM 的 可以比较新旧虚拟节点 找到变化再进行更新
- 区分编译时和运行时
  > 专门写个编译时可以将模板编译成虚拟 DOM (在哦古剑的时候进行编译性能更高 不需要在运行的时候进行编译 Vue3 在编译中做了很多优化)

## Vue3 和 Vue2 的区别

- 项目架构上作对比: Vue3 monorepo 的方式可以让我们一个项目下管理多个项目, 每个包可以单独发布和使用(依赖关系)
- Vue3 (reactivity -> runtime-core -> runtime-dom) runtime-only
  (compiler-dom -> compiler-core) 模板编译相比 Vue2 做了哪些优化
- Vue3 基于 TS optionsApi 缺陷就是不能 tree-shaking compositionApi 对 tree-shaking 支持比较友好
- 内部优化:
  - Vue3 proxy(好处就是可以支持数组和对象 不用一上来就递归 不用改写属性的 get 和 set)
  - Vue3 采用了 compositionApi 实现了方便代码的复用(解决了 mixin 的问题 -命名冲突 - 数据来源不明确)
  - Vue3 diff 算法 内部用的是 最长递增子序列 + 暴力的递归比对 (全量比对浪费性能)
  - Vue3 中的优化 模板编译 BlockTree(block 块) 模版编译 template -> render 函数
  - 将 html 语法进行解析 解析成一颗 ast 语法树 -> 对这棵树进行优化(标记哪些节点是变化) patchFlag(可以非常明确的知道哪些是变化那些没变 这样做 diff 之前我可以筛选出只比较变化了的属性 靶向更新) -> 生成 render 函数
  - block 接地那拥有了一个功能可以收集动态的节点 dynmainicChildren 把动态的属性收集到这里 下次更新的时候 按照数组的方式来进行更新(把输的 diff 变成了数组的 diff)
  - block 也有很多地方解决不了 block 无法解决节点不稳定的情况 会导致更新失败 我们会给导致不稳定的标签增加 block 这样就组成了一个 blockTree (靶向更新 你的有一体模板 1,2,3 -> 1,2,3,4 只能采用全量 diff 因为没有对应的目标去比对)
  - Vue3 里面在编译的时候 采用 blockTree + patchFlag 的方式
  - Vue3 静态提升 属性提升 字符串化 事件缓存

## 编译过程

- 先将模板进行分析 生成对应的 ast 树 -> 对象来描述语法的
- 做转化流程 transform -> 对动态节点做一些标记 指令 插槽 事件 属性... patchFlag
- 代码生成 codegen -> 生成最终代码

## Block 的概念 -> Block Tree

- diff 算法的特点 是递归遍历，每次比较同一层 之前写的都是全量比对
- block 的作用就是为了收集动态节点 （他自己下面所有的） 将树的递归拍平成了有一个数组
- 在 createVnode 的时候 会判断这个节点是动态的 就让外层的 block 收集起来
- 目的是为了 diff 的时候只 diff 动态的节点

> 如果会影响 结构的 都会被标记成 block 节点 v-if v-else
> 父亲也会收集儿子 block -> blockTree (多个节点组成的)

block --> div 父亲更新 会找到 dynamicChildren => 子的 block 和动态节点
block(v-if key="0") <div>{{xxx}}</div>

block --> div
block(v-else key="1") <div>{{xxx}}</div>

> 改变结构的也要封装到 block 中， 我们期望的更新方式是拿以前的和现在的区别, 靶向更新， 如果前后节点个数不一致 那只能全部比对

block -> div v-for 里的内容 走正规的 diff 流程
block -> v-for 不收集动态节点了

block -> div
block -> v-for 不收集动态节点了

> 两个儿子的全量比对

## patchFlags 对不同的动态节点进行描述

> 表示要比对哪些类型

## 求最长递增子序列的个数

1. 思路就是当前这一项比我们最后一项大则直接放到末尾
2. 如果当前这一项比最后一项小, 需要在序列中通过二分查找找到比当前大的这一项 用它来替换掉
3. 最优的情况, 就是默认递增

```js
function getSequence(arr) {
  const len = arr.length;
  const result = [0]; // 以默认第0个为基准做序列
  const p = new Array(len).fill(0); // 最后要标记索引 放的东西不用关心 但是要和数组一样长

  let start;
  let end;
  let middle;
  let resultlastIndex;
  for (let i = 0; i < len; i++) {
    let arrI = arr[i];
    if (arrI !== 0) {
      // 因为vue里面的序列中0意味着没有意义需要创建
      resultlastIndex = result[result.length - 1];
      if (arr[resultlastIndex] < arrI) {
        // 比较最后一项和当前项的值 如果比最后一项大 则将当前的索引放到结果集中
        result.push(i);

        p[i] = resultlastIndex; //当前放到末尾的要记住它前面的那个人是谁
        continue;
      }

      // 这里我们需要通过二分查找 在结果几种找到比当前值大的 用当前值的索引将其替换掉
      // 递增序列 采用二分查找是最快的
      start = 0;
      end = result.length - 1;
      while (start < end) {
        // start === end 的时候就停止了 这个二分查找在找索引
        middle = ((start + end) / 2) | 0;

        if (arr[result[middle]] < arrI) {
          start = middle + 1;
        } else {
          end = middle;
        }
      }
      // 找到中间值之后 我们需要做替换操作 start / end
      if (arr[result[end]] > arrI) {
        result[end] = i; // 这里用当前这一项 替换掉已有的比当前大的那一项 更有潜力的我需要它

        p[i] = result[end - 1]; // 记住它的前一个人是谁
      }
    }
  }

  // 1.默认追加
  // 2.替换
  // 3.记住每个人的前驱节点

  // 通过最后一项进行回溯
  let i = result.length;
  let last = result[i - 1]; // 找到最后一项了
  while (i-- > 0) {
    // 倒序追溯
    result[i] = last; // 最后一项是确定的
    last = p[last];
  }

  return result;
}
// console.log(getSequence([1, 2, 3, 4, 5, 6, 7, 0]));
// console.log(getSequence([3, 2, 8, 9, 5, 6, 7, 11, 15, 4]));
console.log(getSequence([2, 3, 1, 5, 6, 8, 7, 9, 4]));
```
