// 需要支持dom创建的api及属性处理的api
import { extend } from '@vue/shared';
import { createRenderer } from '@vue/runtime-core';
import { nodeOps } from './nodeOps';

// 如果元素一致只是元素发生变化 要做属性的diff算法
import { patchProp } from './patchProp';

// 渲染时用到的所有方法
const renderOptions = extend({ patchProp }, nodeOps);

// vue中runtime-core提供了核心的方法 用来处理渲染的 他会使用runtime-dom中的api进行渲染
// runtime-dom主要的作用就是为了抹平平台差异 不同平台对dom操作方式是不同的 将api传入到core core中可以调用这些方法
// 1.用户窜如组件和属性 2.需要创建组件的虚拟节点(diff算法) 3.将虚拟节点变成真实节点
export function createApp(rootComponent, rootProps = null) {
  const app = createRenderer(renderOptions).createApp(rootComponent, rootProps);
  let { mount } = app;
  app.mount = function (container) {
    // 清空容器的操作
    container = nodeOps.querySelector(container);
    container.innerHTML = ''; // 我们在runtime-dom重写的mount方法 会对容器进行情况
    mount(container); // 函数劫持 AOP切片
    // 将组件渲染成dom元素 进行挂载
  };
  return app;
}

export * from '@vue/runtime-core';
