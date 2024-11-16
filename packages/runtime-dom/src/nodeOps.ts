export const nodeOps = {
  // 增删改查 元素插入文本 文本创建 文本元素内容设置 获取父亲 获取下一个元素
  createElement: (tagName) => document.createElement(tagName),
  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },
  insert: (child, parent, anchor = null) => {
    parent.insertBefore(child, anchor); // 如果参照物为空 则相当于appendChild
  },
  querySelector: (selector) => document.querySelector(selector),
  setElementText: (el, text) => (el.textContent = text),
  // 文本操作 创建文本
  createText: (text) => document.createTextNode(text),
  setText: (node, text) => (node.nodeValue = text),
  nextSibling: (node) => node.nextSibling,
  getParent: (node) => node.parentNode,
  getNextSibling: (node) => node.nextElementSibling,
};
