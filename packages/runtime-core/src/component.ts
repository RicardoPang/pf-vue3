// 组件中所有的方法
import { isFunction, isObject, ShapeFlags } from '@vue/shared/src';
import { PublicInstanceProxyHandlers } from './componentPublicInstance';

let uid = 0;
export function createComponentInstance(vnode) {
  // webcomponent 组件需要有“属性” “插槽”
  const instance = {
    // 组件的实例
    uid: uid++,
    vnode, // 实例上的vnode就是我们处理过的vnode
    type: vnode.type, // 用户写的对象
    props: {}, // props就是组件里用户声明过的
    attrs: {}, // 用户没用到的props就会放到attrs中
    slots: {}, // 组件就是插槽
    ctx: {}, // 上下文
    data: {},
    setupState: {}, // setup返回值
    emit: null, // 组件通信
    proxy: null,
    render: null,
    subTree: null, // render函数的返回结果就是subTree
    isMounted: false, // 表示这个组件是否挂载过
  };
  instance.ctx = { _: instance }; // 将自己放到了上下文中 instance.ctx._
  return instance;
}

export function setupComponent(instance) {
  const { props, children } = instance.vnode; // {type,props,children}

  // 初始化属性 initProps
  // 初始化插槽 initSlots
  instance.props = props; // initProps()
  instance.children = children; // 插槽的解析 initSlot()

  // 看当前组件是不是有状态的组件 函数组件
  let isStateful = instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT;
  if (isStateful) {
    // 调用当前实例的setup方法 用setup的返回值 填充setupState和对应的render方法
    setupStatefulComponent(instance);
  }
}
export let currentInstance = null;
export let setCurrentInstance = (instance) => {
  currentInstance = instance;
};
export let getCurrentInstance = () => {
  // 在setuop中获取当前实例
  return currentInstance;
};
function setupStatefulComponent(instance) {
  // 1.代理 传递给render函数的参数
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers as any);
  // 2.获取组件的类型 拿到组件的setup方法
  let Component = instance.type;
  let { setup } = Component;
  // ------ 没有setup------
  if (setup) {
    let setupContext = createSetupContext(instance);
    currentInstance = instance;
    const setupResult = setup(instance.props, setupContext); // instance 中props attrs slots emit expose 会被提取出来，因为在开发过程中会使用这些属性
    currentInstance = null;
    handleSetupResult(instance, setupResult);
  } else {
    finishComponentSetup(instance); // 如果用户没写setup 那么直接用外面的render
  }
}
function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    instance.render = setupResult;
  } else if (isObject(setupResult)) {
    instance.setupState = setupResult;
  }
  // 处理后可能依旧没有render 1.用户没写render函数 2.用户写了setup但是什么都没有返回
  finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
  let Component = instance.type;
  if (!instance.render) {
    // 对template模板进行编译 产生render函数
    // instance.render = render;// 需要将生成render函数放在实例上
    if (!Component.render && Component.template) {
      // 需要将template变成render函数 compileToFunctions()
    }
    instance.render = Component.render;
  }

  // 对vue2.0API做了兼容处理
  // applyOptions
}
function createSetupContext(instance) {
  return {
    attrs: instance.attrs,
    slots: instance.slots,
    emit: () => {},
    expose: () => {}, // 是为了表示组件暴露了哪些方法 用户可以通过ref调用哪些方法
  };
}

// 他们的关系涉及到后面的使用
// instance 表示的组件的状态 各种各样的状态，组件的相关信息
// context 就4个参数 是为了开发时使用的
// proxy 主要为了取值方便  =》 proxy.xxxx
