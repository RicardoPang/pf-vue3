import { hasOwn } from '@vue/shared/src';

export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    // 取值时 要访问 setUpState， props ,data
    const { setupState, props, data } = instance;
    if (key[0] == '$') {
      return; // 不能访问$ 开头的变量
    }
    if (hasOwn(setupState, key)) {
      // 先自己的状态 再向上下文中查找 再向属性中查找
      return setupState[key];
    } else if (hasOwn(props, key)) {
      return props[key];
    } else if (hasOwn(data, key)) {
      return data[key];
    }
  },
  set({ _: instance }, key, value) {
    const { setupState, props, data } = instance;
    if (hasOwn(setupState, key)) {
      setupState[key] = value;
    } else if (hasOwn(props, key)) {
      props[key] = value;
    } else if (hasOwn(data, key)) {
      data[key] = value;
    }
    return true;
  },
};
