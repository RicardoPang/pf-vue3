const patchClass = (el, value) => {
  if (value == null) {
    value = '';
  }
  el.className = value;
};

const patchStyle = (el, prev, next) => {
  const style = el.style; // 获取样式
  if (next == null) {
    el.removeAttribute('style'); // 如果新的没有 直接移除样式即可
  } else {
    // 老的有新的没有
    if (prev) {
      for (let key in prev) {
        if (next[key] == null) {
          // 老的有 新的没有 需要删除
          style[key] = '';
        }
      }
    }
    for (let key in next) {
      // 新的需要赋值到style上
      style[key] = next[key];
    }
  }
};

// 1.给元素缓存一个绑定事件的列表
// 2.如果缓存中没有缓存过的，而且value有值 需要绑定方法，并且缓存起来
// 3.以前绑定过需要删除掉，删除缓存
// 4.如果前后都有，直接改变invoker中value属性指向最新的事件 即可
const patchEvent = (el, key, value) => {
  // 对函数的缓存
  const invokers = el._vei || (el._vei = {});
  const exists = invokers[key];
  if (value && exists) {
    // 需要绑定事件 而且存在的情况下
    exists.value = value; // 替换事件 但是不用解绑
  } else {
    const eventName = key.slice(2).toLowerCase();
    if (value) {
      // 绑定事件
      let invoker = (invokers[key] = createInvoker(value));
      el.addEventListener(eventName, invoker);
    } else {
      // 以前绑定了 但是没有value
      el.removeEventListener(eventName, exists);
      invokers[key] = undefined;
    }
  }
};

function createInvoker(value) {
  const invoker = (e) => {
    invoker.value(e);
  };
  invoker.value = value; // 为了能随时更改value属性
  return invoker;
}

const patchAttr = (el, key, value) => {
  if ((value = null)) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
};

export const patchProp = (el, key, prevValue, nextValue) => {
  switch (key) {
    case 'class':
      patchClass(el, nextValue); // 比对属性
      break;
    case 'style':
      patchStyle(el, prevValue, nextValue);
      break;
    default:
      // 如果不是事件 才是属性
      if (/^on[^a-z]/.test(key)) {
        // 事件就是增加和删除 修改 addEventListener
        patchEvent(el, key, nextValue);
      } else {
        // 其他属性 直接使用setAttribute
        patchAttr(el, key, nextValue);
      }
      break;
  }
};
