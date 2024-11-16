import { currentInstance, setCurrentInstance } from './component';

// 父-》 setup （target = currentInstance = 父）  -> 子 => setup(target = currentInstance = 子)
// 父 omounted (currentInstance)
const enum LifeCycleHooks {
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
}

const injectHook = (type, hook, target) => {
  // target指向的肯定是生命周期指向的实例
  // 后面可能是先渲染儿子 此时currentInstance已经变成渲染儿子了 但是target永远指向是正确的
  // 在这个函数中保留了实例 闭包
  if (!target) {
    return console.warn(
      'injection APIs can only be used during execution of setup().'
    );
  } else {
    const hooks = target[type] || (target[type] = []); // instance.bm = []
    const wrap = () => {
      setCurrentInstance(target); // currentInstance = 自己的
      hook.call(target);
      setCurrentInstance(null);
    };
    hooks.push(wrap);
  }
};
const createHook =
  (lifecycle) =>
  (hook, target = currentInstance) => {
    // 全局的当前实例
    // target用来表示他是哪个实例的钩子
    // 给当前实例 增加 对应的生命周期 即可
    injectHook(lifecycle, hook, target);
  };

export const invokeArrayFns = (fns) => {
  for (let i = 0; i < fns.length; i++) {
    // vue2中也是 调用是 让函数依次执行
    fns[i]();
  }
};

export const onBeforeMount = createHook(LifeCycleHooks.BEFORE_MOUNT);
export const onMounted = createHook(LifeCycleHooks.MOUNTED);
export const onBeforeUpdate = createHook(LifeCycleHooks.BEFORE_UPDATE);
export const onUpdated = createHook(LifeCycleHooks.UPDATED);
