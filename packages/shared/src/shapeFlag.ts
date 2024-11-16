// 用于组合 权限里面 如果有管理员权限 用户权限 可以使用这种方式实现权限的组合和校验
export const enum ShapeFlags {
  ELEMENT = 1, // 1 标识是一个元素
  FUNCTIONAL_COMPONENT = 1 << 1, // 2 函数组件
  STATEFUL_COMPONENT = 1 << 2, // 4 带状态的组件
  TEXT_CHILDREN = 1 << 3, // 8 这个组件的孩子是文本
  ARRAY_CHILDREN = 1 << 4, // 孩子是数组
  SLOTS_CHILDREN = 1 << 5, // 插槽孩子
  TELEPORT = 1 << 6, // 传送门
  SUSPENSE = 1 << 7, // 实现异步组件等待
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 是否需要keep-alive
  COMPONENT_KEPT_ALIVE = 1 << 9, // 组件的keep-alive
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}

// 位运算是以前人总结出来 做权限判断和类型 位运算是最佳实践

// 2进制 一个字节由8个位组成 8个位最大都是1
// 00000001    1 * 2^0
// 00000010    1 * 2^1 + 0 * 2^0
// 00000100    1 * 2^2 + 0 * 2^1  + 0 * 2^0

// 用位运算来做标识位

// 00000100
// 00000010  // 这两个二进制 做|运算 有一个是1 就是1
// 00000110   = component

// 想判断他是不是组件
// 00000100 &  00000110  全1 才是1  =》 00000100  true
// 00001000 &  00000110  => 00000000

// 按位与
const manager = 1 << 1;
const user = 1 << 2;
const order = 1 << 3;
const admin = manager | user;
// admin & order > 0 有权限
// admin & order == 0 无权限
// admin & user > 有权限

// | 有一个是1 就是1
// & 都是1 才是1
