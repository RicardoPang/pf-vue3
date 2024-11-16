import { createVnode } from './vnode';

export function createAppAPI(render) {
  return function createApp(rootComponent, rootProps) {
    // 告诉他那个组件那个属性来创建的应用
    const app = {
      _props: rootProps,
      _component: rootComponent, // 为了稍后组件挂载之前可以先校验组件是否有render函数
      _container: null,
      mount(container) {
        // 1.根据用户传入的组件生成一个虚拟节点
        const vnode = createVnode(rootComponent, rootProps);
        // 2.将虚拟节点变成真实节点 插入到对应的容器中
        render(vnode, container);

        app._container = container;
      },
    };
    return app;
  };
}
