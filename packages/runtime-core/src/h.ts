import { isArray, isObject } from '@vue/shared';
import { createVnode, isVnode } from './vnode';

export function h(type, propsOrChildren, children) {
  // 第一个一定是类型 第一个采纳数可能是属性可能是儿子 后面的一定都是儿子 没有属性的情况只能放数组
  // 一个的情况可以写文本 一个type + 一个文本
  const l = arguments.length;
  if (l === 2) {
    // 如果propsOrChildren是数组 直接作为第三个参数
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isVnode(propsOrChildren)) {
        return createVnode(type, null, [propsOrChildren]);
      }
      return createVnode(type, propsOrChildren);
    } else {
      // 如果第二个参数 不是对象 那一定是孩子
      return createVnode(type, null, propsOrChildren);
    }
  } else {
    if (l > 3) {
      children = Array.from(arguments).slice(2);
    } else if (l === 3 && isVnode(children)) {
      children = [children];
    }
    return createVnode(type, propsOrChildren, children);
  }
}
