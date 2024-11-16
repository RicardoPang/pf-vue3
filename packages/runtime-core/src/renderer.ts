import { effect } from '@vue/reactivity/src';
import { ShapeFlags } from '@vue/shared/src';
import { createAppAPI } from './apiCreateApp';
import { invokeArrayFns } from './apiLifecycle';
import { createComponentInstance, setupComponent } from './component';
import { queueJob } from './scheduler';
import { normalizeVNode, Text } from './vnode';

export function createRenderer(rendererOptions) {
  // 告诉core 怎么渲染

  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    nextSibling: hostNextSibling,
  } = rendererOptions;

  // -------------------组件----------------------
  const setupRenderEfect = (instance, container) => {
    // 每次状态变化后 都会重新执行effect 是第一次还是修改的?
    instance.update = effect(
      function componentEffect() {
        // 每个组件都有一个effect， vue3 是组件级更新，数据变化会重新执行对应组件的effect
        if (!instance.isMounted) {
          // 初次渲染
          let { bm, m } = instance;
          if (bm) {
            invokeArrayFns(bm);
          }

          let proxyToUse = instance.proxy;
          // $vnode  _vnode
          // vnode  subTree
          let subTree = (instance.subTree = instance.render.call(
            proxyToUse,
            proxyToUse
          ));

          // 用render函数的返回值 继续渲染
          patch(null, subTree, container);
          instance.isMounted = true;

          if (m) {
            // mounted要求必须在我们子组件完成后才会调用自己
            invokeArrayFns(m);
          }
        } else {
          console.log('渲染');
          let { bu, u } = instance;
          if (bu) {
            invokeArrayFns(bu);
          }

          // diff算法（核心 diff + 序列优化 watchApi 生命周期）
          const prevTree = instance.subTree; // 数据没变的时候的subTree
          let proxyToUse = instance.proxy;
          // 再次调用render 此时用的是最新数据渲染出来了
          const nextTree = instance.render.call(proxyToUse, proxyToUse);
          instance.subTree = nextTree;
          patch(prevTree, nextTree, container);

          if (u) {
            invokeArrayFns(u);
          }
        }
      },
      {
        scheduler: queueJob,
      }
    );
  };
  const updateComponent = (n1, n2, container) => {};
  const mountComponent = (initialVNode, container) => {
    // 组件的渲染流程  最核心的就是调用 setup拿到返回值，获取render函数返回的结果来进行渲染
    // 1.先有实例
    const instance = (initialVNode.component =
      createComponentInstance(initialVNode));
    // 2.需要的数据解析到实例上
    setupComponent(instance); // state props attrs render ....
    // 3.创建一个effect 让render函数执行
    setupRenderEfect(instance, container);
  };
  const processComponent = (n1, n2, container) => {
    if (n1 == null) {
      // 组件没有上一次的虚拟节点
      mountComponent(n2, container);
    } else {
      // 组件更新流程
      updateComponent(n1, n2, container); // 更新组件
    }
  };
  // ------------------组件 ------------------

  //----------------- 处理元素-----------------
  const mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      let child = normalizeVNode(children[i]);
      patch(null, child, container);
    }
  };
  const mountElement = (vnode, container, anchor = null) => {
    // 把虚拟节点变成真实的DOM元素
    const { props, shapeFlag, type, children } = vnode;
    let el = (vnode.el = hostCreateElement(type)); // 对应的是真实DOM元素

    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    // 父创建完毕后 需要创建儿子
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, children); // 文本比较简单 直接扔进去即可
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(children, el);
    }
    hostInsert(el, container, anchor);
  };
  const patchProps = (oldProps, newProps, el) => {
    if (oldProps !== newProps) {
      for (let key in newProps) {
        const prev = oldProps[key];
        const next = newProps[key];
        if (prev !== next) {
          hostPatchProp(el, key, prev, next);
        }
      }
      for (const key in oldProps) {
        if (!(key in newProps)) {
          hostPatchProp(el, key, oldProps[key], null);
        }
      }
    }
  };
  const patchKeyedChildren = (c1, c2, el) => {
    // 两方都有儿子 才能称之为diff算法
    // 能复用的尽可能复用 之前和现在的差异 不一样的要新建或者删除 一样的要复用 复用dom和属性
    let i = 0; // 都是默认从头开始比对
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;

    // 从头开始一个个比 遇到不同就停止 以短的为主 谁先遍历完毕就终止了
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVNode(n1, n2)) {
        // 是同一个元素 要比较属性和这两个人的儿子
        patch(n1, n2, el);
      } else {
        break;
      }
      i++;
    }

    // 从尾开始比
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];
      if (isSameVNode(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      e1--;
      e2--;
    }

    // 如果老的少新的多 需要将新的直接插入即可 无论是头部增加还是尾部增加 都是这个逻辑
    if (i > e1) {
      // 老的少新的多 有一方已经完全比对完成了
      if (i <= e2) {
        const nextPos = e2 + 1; // 如果是向后追加 e2+1 肯定大于c2的总长度, 如果是向前追加 e2+1 肯定小于c2的长度
        // 想知道是向前插入 还是向后插入
        const anchor = nextPos < c2.length ? c2[nextPos].el : null;
        while (i <= e2) {
          patch(null, c2[i], el, anchor);
          i++;
        }
      }
    } else if (i > e2) {
      // 老的多新的少 有一方已经完全比对完成了
      while (i <= e1) {
        unmount(c1[i]);
        i++;
      }
    } else {
      // 乱序比较(最长递增子序列) 尽可能复用 用新的元素做成一个映射表去老的里找 一样的就复用 不一样的要不插入要不删除

      // 通过i和e1/e2之间的部分进行差异比对
      let s1 = i;
      let s2 = i;

      // 正常来说 应该永久的节点做成一个映射表 拿新的节点去找 看一下能否复用
      // 根据新的节点生成一个索引的映射表
      const keyToNewIndexMap = new Map(); // Vue3用的是新的做映射表 Vue2用的是老的做映射表 索引: 值weakMap key对象
      for (let i = s2; i <= e2; i++) {
        const childVNode = c2[i]; // 获取新的儿子中每一个节点 child
        keyToNewIndexMap.set(childVNode.key, i);
      }
      // 接下来有了映射表之后 我们要知道哪些可以被patch 哪些不能

      // 计算有几个需要被patch
      const toBePatched = e2 - s2 + 1;
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0);

      // 去老的里面查找 看有没有复用的
      for (let i = s1; i <= e1; i++) {
        // 循环老的将老的索引记录到newIndexToOldIndexMap(根据索引进行查找)
        const oldVnode = c1[i]; // 老的虚拟节点 通过老的key去新的映射表里进行查找 如果有就复用
        let newIndex = keyToNewIndexMap.get(oldVnode.key); // 新的索引

        if (newIndex === undefined) {
          // 用老的去新的找 新的里面没有 删除掉这个节点
          unmount(oldVnode);
        } else {
          // 这里用新索引的时候 需要减去开头的长度
          newIndexToOldIndexMap[newIndex - s2] = i + 1; // 构建新的索引和老的索引的关系
          // 新老的比对 比较完毕后位置有差异
          patch(oldVnode, c2[newIndex], el);
          // 如果里面的值是0的话说明新的有老的没有 而且数组里面会记录新的对应老的索引
        }
      }

      let increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);

      let j = increasingNewIndexSequence.length - 1; // 取出最后一个人的索引
      for (let i = toBePatched - 1; i >= 0; i--) {
        let currentIndex = i + s2; // 获取h位置
        let childVNode = c2[currentIndex]; // 找到h对应的节点
        let anchor =
          currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
        // 如果以前不存在这个节点就创造出来 进行插入操作
        if (newIndexToOldIndexMap[i] === 0) {
          // 如果自己是0说明没有被patch过
          patch(null, childVNode, el, anchor);
        } else {
          if (i !== increasingNewIndexSequence[j]) {
            hostInsert(childVNode.el, el, anchor); // dom操作具有移动性 肯定用的是以前的 但是都做了一遍重新插入
          } else {
            j--; // 跳过不需要移动的元素 为了减少移动操作 需要这个最长递增子序列算法
          }
        }
      }
    }
  };
  function getSequence(arr) {
    // 最终的结果是索引
    const len = arr.length;
    const result = [0]; // 索引 递增的序列 用二分查找性能高
    const p = arr.slice(0); // 里面内容无所谓 和原本的数组相同 用来存放索引
    let start;
    let end;
    let middle;
    for (let i = 0; i < len; i++) {
      const arrI = arr[i];
      if (arrI !== 0) {
        let resultLastIndex = result[result.length - 1];
        // 取到索引对应的值
        if (arr[resultLastIndex] < arrI) {
          p[i] = resultLastIndex; // 标记当前前一个对应的索引
          result.push(i);
          continue; // 当前的值比上一个大 直接push 并且让这个人得记录他的前一个
        }
        // 二分查找 找到比当前值大的那一个
        start = 0;
        end = result.length - 1;
        while (start < end) {
          // 重合就说明找到了对应的值 O(logn)
          middle = ((start + end) / 2) | 0; // 找到中建位置的前一个
          if (arr[result[middle]] < arrI) {
            start = middle + 1;
          } else {
            end = middle;
          } // 找到结果集 比当前这一项大的数
        }
        // start / end 就是找到的位置
        if (arrI < arr[result[start]]) {
          // 如果相同或者比当前的还大就不换了
          if (start > 0) {
            // 才需要替换
            p[i] = result[start - 1]; // 要将他替换的前一个记住
          }
          result[start] = i;
        }
      }
    }
    let len1 = result.length; // 总长度
    let last = result[len1 - 1]; // 找到了最后一项
    while (len1-- > 0) {
      // 根据前驱节点一个个向前查找
      result[len1] = last;
      last = p[last];
    }
    return result;
  } // O(nlogn) 性能比较好 O(n^2)

  const patchChildren = (n1, n2, el) => {
    // 做两个虚拟节点的儿子比较
    const c1 = n1.children;
    const c2 = n2.children;

    // 老的有儿子新的没儿子 新的有儿子老的没儿子 新老都有儿子 新老都是文本
    const prevShapeFlag = n1.shapeFlag;
    const shapeFlag = n2.shapeFlag;
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, c2); // 直接干掉以前的
    } else {
      // 现在是数组
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 两个都是数组
        patchKeyedChildren(c1, c2, el);
      } else {
        // 之前的是文本 现在是数组
        hostSetElementText(el, '');
        mountChildren(c2, el);
      }
    }
  };
  const patchElement = (n1, n2) => {
    // 走到这里说明前后两个元素能复用
    let el = (n2.el = n1.el);

    // 更新属性 更新儿子
    const oldProps = n1.props || {};
    const newProps = n2.props || {};

    patchProps(oldProps, newProps, el);
    patchChildren(n1, n2, el);
  };
  const processElement = (n1, n2, container, anchor) => {
    if (n1 == null) {
      mountElement(n2, container, anchor);
    } else {
      // 元素更新
      patchElement(n1, n2);
    }
  };
  //----------------- 处理元素-----------------

  // -----------------文本处理-----------------
  const processText = (n1, n2, container) => {
    if (n1 == null) {
      hostInsert((n2.el = hostCreateText(n2.children)), container);
    }
  };
  const isSameVNode = (n1, n2) => {
    return n1.type === n2.type && n1.key === n2.key;
  };
  const unmount = (n1) => {
    // 如果是组件 调用的组件的生命周期等
    hostRemove(n1.el);
  };
  // -----------------文本处理-----------------
  const patch = (n1, n2, container, anchor = null) => {
    // 针对不同类型 做初始化操作
    const { shapeFlag, type } = n2;

    // 不是初始化才比较两个节点是不是同一个节点
    if (n1 && !isSameVNode(n1, n2)) {
      // 把以前的删掉 换成n2
      anchor = hostNextSibling(n1.el);
      unmount(n1);
      n1 = null; // 如果n1为空则直接重新渲染
    }

    switch (type) {
      case Text:
        processText(n1, n2, container);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor);
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container);
        }
    }
  };
  const render = (vnode, container) => {
    // core的核心, 根据不同的虚拟节点 创建对应的真实元素

    // 默认调用render 可能是初始化流程
    patch(null, vnode, container);
  };
  return {
    createApp: createAppAPI(render),
  };
}

// createRenderer目的是创建一个渲染器
// 框架都是将组件转换成虚拟dom -> 虚拟dom生成真实dom挂载到页面上
// 最长递增子序列: 如果当前找到的值比末尾大 直接将至添加到后面 如果当前这个值比末尾小 就去序列中通过二分查找的方式将比他大的值替换掉
// 函数定义的作用域和执行的作用域不是同一个 就会产生闭包
// 作用域不会产生(js是静态作用域 定义的时候就确定了) 产生的叫上下文
