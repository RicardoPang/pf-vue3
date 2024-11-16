var VueRuntimeDOM = (function (exports) {
  'use strict';

  const isObject = (value) => typeof value == 'object' && value !== null;
  const extend = Object.assign;
  const isArray = Array.isArray;
  const isFunction = (value) => typeof value == 'function';
  const isString = (value) => typeof value === 'string';
  const isIntegerKey = (key) => parseInt(key) + '' === key;
  let hasOwnpRroperty = Object.prototype.hasOwnProperty;
  const hasOwn = (target, key) => hasOwnpRroperty.call(target, key);
  const hasChanged = (oldValue, value) => oldValue !== value;

  function effect(fn, options = {}) {
      // 我需要让这个effect变成响应的effect，可以做到数据变化重新执行
      const effect = createReactiveEffect(fn, options);
      if (!options.lazy) {
          // 默认的effect会先执行
          effect(); // 响应式的effect默认会先执行一次
      }
      return effect;
  }
  let uid$1 = 0;
  let activeEffect; // 存储当前的effect
  const effectStack = [];
  function createReactiveEffect(fn, options) {
      const effect = function reactiveEffect() {
          if (!effectStack.includes(effect)) {
              // 保证effect没有加入到effectStack中
              try {
                  effectStack.push(effect);
                  activeEffect = effect;
                  return fn(); // 函数执行时会取值  会执行get方法
              }
              finally {
                  effectStack.pop();
                  activeEffect = effectStack[effectStack.length - 1];
              }
          }
      };
      effect.id = uid$1++; // 制作一个effect标识 用于区分effect
      effect._isEffect = true; // 用于标识这个是响应式effect
      effect.raw = fn; // 保留effect对应的原函数
      effect.options = options; // 在effect上保存用户的属性
      return effect;
  }
  // 让某个对象中的属性 收集当前他对应的effect函数
  const targetMap = new WeakMap();
  function track(target, type, key) {
      // 可以拿到当前的effect
      //  activeEffect 当前正在运行的effect
      if (activeEffect === undefined) {
          // 此属性不用收集依赖，因为没在effect中使用
          return;
      }
      let depsMap = targetMap.get(target);
      if (!depsMap) {
          targetMap.set(target, (depsMap = new Map()));
      }
      let dep = depsMap.get(key);
      if (!dep) {
          depsMap.set(key, (dep = new Set()));
      }
      if (!dep.has(activeEffect)) {
          dep.add(activeEffect);
      }
  }
  // 找属性对应的effect 让其执行 （数组、对象）
  function trigger(target, type, key, newValue, oldValue) {
      // 如果这个属性没有收集过effect，那不需要做任何操作
      const depsMap = targetMap.get(target);
      if (!depsMap)
          return; // 只是改了属性 这个属性没有在effect中使用
      const effects = new Set(); // 这里对effect去重了
      const add = (effectsToAdd) => {
          // 如果同时有多个 依赖的effect是同一个 还用set做了一个过滤
          if (effectsToAdd) {
              effectsToAdd.forEach((effect) => effects.add(effect));
          }
      };
      // 我要将所有的 要执行的effect 全部存到一个新的集合中，最终一起执行
      // 1. 看修改的是不是数组的长度 因为改长度影响比较大 小于依赖收集的长度 要触发重新渲染
      // 2. 如果调用了push方法 或者其他新增数组的方法(必须能改变长度的方法) 也要触发更新
      if (key === 'length' && isArray(target)) {
          // 如果对应的长度 有依赖收集需要更新
          depsMap.forEach((dep, key) => {
              if (key === 'length' || key > newValue) {
                  // 如果更改的长度 小于收集的索引，那么这个索引也需要触发effect重新执行
                  add(dep);
              }
          });
      }
      else {
          // 可能是对象
          if (key !== undefined) {
              // 这里肯定是修改， 不能是新增
              add(depsMap.get(key)); // 如果是新增
          }
          // 如果修改数组中的 某一个索引 怎么办？
          switch (type // 如果添加了一个索引就触发长度的更新
          ) {
              case 0 /* TriggerOrTypes.ADD */:
                  if (isArray(target) && isIntegerKey(key)) {
                      add(depsMap.get('length'));
                  }
          }
      }
      effects.forEach((effect) => {
          if (effect.options.scheduler) {
              effect.options.scheduler(effect); // 如果有自己提供的scheduler 则执行scheduler逻辑
          }
          else {
              effect();
          }
      });
  }
  // weakMap {name:'pf',age:12}  (map) =>{name => set(effect),age => set(effect)}
  // {name:'pf',age:12} => name => [effect effect]
  // 函数调用是一个栈型结构
  // effect(()=>{ // effect1   [effect1]
  //     state.name -> effect1
  //     effect(()=>{ // effect2
  //         state.age -> effect2
  //     })
  //     state.address -> effect1
  // })
  // 一个属性对应多个effect 一个effect还可以对应多个属性
  //  target key = [effect,effect]

  // 实现 new Proxy(target, handler)
  const get = createGetter();
  const shallowGet = createGetter(false, true);
  const readonlyGet = createGetter(true);
  const showllowReadonlyGet = createGetter(true, true);
  const set = createSetter();
  const shallowSet = createSetter(true);
  const mutableHandlers = {
      get,
      set,
  };
  const shallowReactiveHandlers = {
      get: shallowGet,
      set: shallowSet,
  };
  let readonlyObj = {
      set: (target, key) => {
          console.warn(`set on key ${key} falied`);
      },
  };
  const readonlyHandlers = extend({
      get: readonlyGet,
  }, readonlyObj);
  const shallowReadonlyHandlers = extend({
      get: showllowReadonlyGet,
  }, readonlyObj);
  // 是不是仅读的，仅读的属性set时会报异常
  // 是不是深度的
  function createGetter(isReadonly = false, shallow = false) {
      // 拦截获取功能
      return function get(target, key, receiver) {
          // let proxy = reactive({obj:{}})
          // proxy + reflect
          // 后续Object上的方法 会被迁移到Reflect Reflect.getProptypeof()
          // 以前target[key] = value 方式设置值可能会失败 ， 并不会报异常 ，也没有返回值标识
          // Reflect 方法具备返回值
          // reflect 使用可以不使用 proxy es6语法
          const res = Reflect.get(target, key, receiver); // target[key];
          if (!isReadonly) {
              // 收集依赖，等会数据变化后更新对应的视图
              console.log('执行effect时会取值', '收集effect');
              track(target, 0 /* TrackOpTypes.GET */, key);
          }
          if (shallow) {
              return res;
          }
          if (isObject(res)) {
              // vue2 是一上来就递归，vue3 是当取值时会进行代理 。 vue3的代理模式是懒代理
              return isReadonly ? readonly(res) : reactive(res);
          }
          return res;
      };
  }
  function createSetter(shallow = false) {
      // 拦截设置功能
      // 针对数组而言 如果调用push方法 就会触发两次 1.给数组新增了一项 2.因为更改了长度再次触发set(第二次触发是无意义的)
      return function set(target, key, value, receiver) {
          const oldValue = target[key]; // 获取老的值
          // 数组且索引
          let hadKey = isArray(target) && isIntegerKey(key)
              ? Number(key) < target.length
              : hasOwn(target, key);
          const result = Reflect.set(target, key, value, receiver); // target[key] = value
          if (!hadKey) {
              // 新增
              trigger(target, 0 /* TriggerOrTypes.ADD */, key, value);
          }
          else if (hasChanged(oldValue, value)) {
              // 修改
              trigger(target, 1 /* TriggerOrTypes.SET */, key, value);
          }
          // 我们要区分是新增的 还是修改的  vue2 里无法监控更改索引，无法监控数组的长度变化  -》 hack的方法 需要特殊处理
          // 当数据更新时 通知对应属性的effect重新执行
          return result;
      };
  }
  // Vue3针对的是对象来进行劫持 不用改写原来的对象 如果是嵌套 当取值的时候才会代理
  // Vue2 针对的是属性劫持 改写了原来对象 一上来就递归
  // Vue3 可以针对不存在的属性进行获取 也会走get方法 proxy支持数组

  function reactive(target) {
      return createReactiveObject(target, false, mutableHandlers);
  }
  function shallowReactive(target) {
      return createReactiveObject(target, false, shallowReactiveHandlers);
  }
  function readonly(target) {
      return createReactiveObject(target, true, readonlyHandlers);
  }
  function shallowReadonly(target) {
      return createReactiveObject(target, true, shallowReadonlyHandlers);
  }
  // 是不是仅读 是不是深度， 柯里化  new Proxy() 最核心的需要拦截 数据的读取和数据的修改  get set
  const reactiveMap = new WeakMap(); // 目的是添加缓存 会自动垃圾回收，不会造成内存泄漏， 存储的key只能是对象
  const readonlyMap = new WeakMap();
  function createReactiveObject(target, isReadonly, baseHandlers) {
      // 如果目标不是对象 没法拦截了，reactive这个api只能拦截对象类型
      if (!isObject(target)) {
          return target;
      }
      // 如果某个对象已经被代理过了 就不要再次代理了  可能一个对象 被代理是深度 又被仅读代理了
      const proxyMap = isReadonly ? readonlyMap : reactiveMap;
      const existProxy = proxyMap.get(target);
      if (existProxy) {
          return existProxy; // 如果已经被代理了 直接返回即可
      }
      const proxy = new Proxy(target, baseHandlers);
      proxyMap.set(target, proxy); // 将要代理的对象 和对应代理结果缓存起来
      return proxy;
  }

  function ref(value) {
      // 将普通类型 变成一个对象 , 可以是对象 但是一般情况下是对象直接用reactive更合理
      return createRef(value);
  }
  // ref 和 reactive的区别 reactive内部采用proxy  ref中内部使用的是defineProperty
  function shallowRef(value) {
      return createRef(value, true);
  }
  // 后续 看vue的源码 基本上都是高阶函数 做了类似柯里化的功能
  const convert = (val) => (isObject(val) ? reactive(val) : val);
  // beta 版本 之前的版本ref 就是个对象 ，由于对象不方便扩展 改成了类 (ts中实现类的话 私有属性必须要先声明才能使用)
  class RefImpl {
      rawValue;
      shallow;
      _value; //表示 声明了一个_value属性 但是没有赋值
      __v_isRef = true; // 产生的实例会被添加 __v_isRef 表示是一个ref属性
      constructor(rawValue, shallow) {
          this.rawValue = rawValue;
          this.shallow = shallow;
          // 参数中前面增加修饰符 标识此属性放到了实例上
          this._value = shallow ? rawValue : convert(rawValue); // 如果是深度 需要把里面的都变成响应式的
      }
      // 类的属性访问器
      get value() {
          // 代理 取值取value 会帮我们代理到 _value上
          track(this, 0 /* TrackOpTypes.GET */, 'value');
          return this._value;
      }
      set value(newValue) {
          if (hasChanged(newValue, this.rawValue)) {
              // 判断老值和新值是否有变化
              this.rawValue = newValue; // 新值会作为老值 用于下次比对
              this._value = this.shallow ? newValue : convert(newValue);
              trigger(this, 1 /* TriggerOrTypes.SET */, 'value', newValue);
          }
      }
  }
  function createRef(rawValue, shallow = false) {
      return new RefImpl(rawValue, shallow); // 借助类的属性访问器
  }
  class ObjectRefImpl {
      target;
      key;
      __v_isRef = true;
      constructor(target, key) {
          this.target = target;
          this.key = key;
      }
      get value() {
          // 代理
          return this.target[this.key]; // 如果原对象是响应式的就会依赖收集
      }
      set value(newValue) {
          this.target[this.key] = newValue; // 如果原来对象是响应式的 那么就会触发更新
      }
  }
  // promisify
  // promisifyAll
  // 将某一个key对应的值 转化成ref
  function toRef(target, key) {
      // 可以把一个对象的值转化成 ref类型
      return new ObjectRefImpl(target, key);
  }
  function toRefs(object) {
      // object 可能传递的是一个数组 或者对象
      const ret = isArray(object) ? new Array(object.length) : {};
      for (let key in object) {
          ret[key] = toRef(object, key);
      }
      return ret;
  }
  // ref其他方法实现 计算属性
  // effect和reactive和ref的关系
  // computed源码调试
  // vue3的渲染原理 diff算法

  class ComputedRefImpl {
      getter;
      setter;
      _dirty = true; // 默认取值时不要用缓存
      _value;
      effect;
      constructor(getter, setter) {
          this.getter = getter;
          this.setter = setter;
          // 返还了effect的执行权限
          this.effect = effect(getter, {
              lazy: true,
              scheduler: () => {
                  // 传入了scheduler后 下次数据更新 原则上应该让effect重新执行 下次更新会调用scheduler
                  if (!this._dirty) {
                      // 依赖属性变化时
                      this._dirty = true; // 标记为脏 触发视图更新
                      trigger(this, 1 /* TriggerOrTypes.SET */, 'value');
                  }
              },
          });
      }
      // 如果用户不去计算属性中取值 就不会执行计算属性的effect
      get value() {
          // 计算属性也要收集依赖
          if (this._dirty) {
              this._value = this.effect(); // 会将用户的返回值返回
              this._dirty = false;
          }
          track(this, 0 /* TrackOpTypes.GET */, 'value'); // 进行属性依赖收集
          return this._value;
      }
      set value(newValue) {
          // 当用户给计算属性设置值的时候会触发set方法 此时调用计算属性的setter
          this.setter(newValue);
      }
  }
  function computed(getterOrOptoins) {
      let getter;
      let setter;
      if (isFunction(getterOrOptoins)) {
          // computed两种写法
          getter = getterOrOptoins;
          setter = () => {
              console.warn('computed value must be readonly');
          };
      }
      else {
          getter = getterOrOptoins.get;
          setter = getterOrOptoins.set;
      }
      return new ComputedRefImpl(getter, setter);
  }

  // createVNode  创建虚拟节点
  function isVnode(vnode) {
      return vnode.__v_isVnode;
  }
  // h(‘div',{style:{color:red}},'children'); //  h方法和createApp类似
  const createVnode = (type, props, children = null) => {
      // 可以根据type 来区分是组件 还是普通的元素
      // 根据type来区分 是元素还是组件
      // 给虚拟节点加一个类型
      const shapeFlag = isString(type)
          ? 1 /* ShapeFlags.ELEMENT */
          : isObject(type)
              ? 4 /* ShapeFlags.STATEFUL_COMPONENT */
              : 0;
      const vnode = {
          // 一个对象来描述对应的内容 ， 虚拟节点有跨平台的能力
          __v_isVnode: true,
          type,
          props,
          children,
          component: null,
          el: null,
          key: props && props.key,
          shapeFlag, // 判断出当前自己的类型 和 儿子的类型
      };
      // 等会做diff算法 肯定要有一个老的虚拟节点(对应着真实的dom)和新的虚拟节点
      // 虚拟节点比对差异 将差异放到真实节点上
      normalizeChildren(vnode, children);
      return vnode;
  };
  function normalizeChildren(vnode, children) {
      // 将儿子的类型统一记录在vnode中的shapeFlag
      let type = 0;
      if (children == null) ;
      else if (isArray(children)) {
          type = 16 /* ShapeFlags.ARRAY_CHILDREN */;
      }
      else {
          type = 8 /* ShapeFlags.TEXT_CHILDREN */;
      }
      vnode.shapeFlag |= type;
  }
  const Text = Symbol('Text');
  function normalizeVNode(child) {
      if (isObject(child))
          return child;
      return createVnode(Text, null, String(child));
  }

  function createAppAPI(render) {
      return function createApp(rootComponent, rootProps) {
          // 告诉他那个组件那个属性来创建的应用
          const app = {
              _props: rootProps,
              _component: rootComponent,
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

  const PublicInstanceProxyHandlers = {
      get({ _: instance }, key) {
          // 取值时 要访问 setUpState， props ,data
          const { setupState, props, data } = instance;
          if (key[0] == '$') {
              return; // 不能访问$ 开头的变量
          }
          if (hasOwn(setupState, key)) {
              // 先自己的状态 再向上下文中查找 再向属性中查找
              return setupState[key];
          }
          else if (hasOwn(props, key)) {
              return props[key];
          }
          else if (hasOwn(data, key)) {
              return data[key];
          }
      },
      set({ _: instance }, key, value) {
          const { setupState, props, data } = instance;
          if (hasOwn(setupState, key)) {
              setupState[key] = value;
          }
          else if (hasOwn(props, key)) {
              props[key] = value;
          }
          else if (hasOwn(data, key)) {
              data[key] = value;
          }
          return true;
      },
  };

  // 组件中所有的方法
  let uid = 0;
  function createComponentInstance(vnode) {
      // webcomponent 组件需要有“属性” “插槽”
      const instance = {
          // 组件的实例
          uid: uid++,
          vnode,
          type: vnode.type,
          props: {},
          attrs: {},
          slots: {},
          ctx: {},
          data: {},
          setupState: {},
          emit: null,
          proxy: null,
          render: null,
          subTree: null,
          isMounted: false, // 表示这个组件是否挂载过
      };
      instance.ctx = { _: instance }; // 将自己放到了上下文中 instance.ctx._
      return instance;
  }
  function setupComponent(instance) {
      const { props, children } = instance.vnode; // {type,props,children}
      // 初始化属性 initProps
      // 初始化插槽 initSlots
      instance.props = props; // initProps()
      instance.children = children; // 插槽的解析 initSlot()
      // 看当前组件是不是有状态的组件 函数组件
      let isStateful = instance.vnode.shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */;
      if (isStateful) {
          // 调用当前实例的setup方法 用setup的返回值 填充setupState和对应的render方法
          setupStatefulComponent(instance);
      }
  }
  let currentInstance = null;
  let setCurrentInstance = (instance) => {
      currentInstance = instance;
  };
  let getCurrentInstance = () => {
      // 在setuop中获取当前实例
      return currentInstance;
  };
  function setupStatefulComponent(instance) {
      // 1.代理 传递给render函数的参数
      instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
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
      }
      else {
          finishComponentSetup(instance); // 如果用户没写setup 那么直接用外面的render
      }
  }
  function handleSetupResult(instance, setupResult) {
      if (isFunction(setupResult)) {
          instance.render = setupResult;
      }
      else if (isObject(setupResult)) {
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
          if (!Component.render && Component.template) ;
          instance.render = Component.render;
      }
      // 对vue2.0API做了兼容处理
      // applyOptions
  }
  function createSetupContext(instance) {
      return {
          attrs: instance.attrs,
          slots: instance.slots,
          emit: () => { },
          expose: () => { }, // 是为了表示组件暴露了哪些方法 用户可以通过ref调用哪些方法
      };
  }
  // 他们的关系涉及到后面的使用
  // instance 表示的组件的状态 各种各样的状态，组件的相关信息
  // context 就4个参数 是为了开发时使用的
  // proxy 主要为了取值方便  =》 proxy.xxxx

  const injectHook = (type, hook, target) => {
      // target指向的肯定是生命周期指向的实例
      // 后面可能是先渲染儿子 此时currentInstance已经变成渲染儿子了 但是target永远指向是正确的
      // 在这个函数中保留了实例 闭包
      if (!target) {
          return console.warn('injection APIs can only be used during execution of setup().');
      }
      else {
          const hooks = target[type] || (target[type] = []); // instance.bm = []
          const wrap = () => {
              setCurrentInstance(target); // currentInstance = 自己的
              hook.call(target);
              setCurrentInstance(null);
          };
          hooks.push(wrap);
      }
  };
  const createHook = (lifecycle) => (hook, target = currentInstance) => {
      // 全局的当前实例
      // target用来表示他是哪个实例的钩子
      // 给当前实例 增加 对应的生命周期 即可
      injectHook(lifecycle, hook, target);
  };
  const invokeArrayFns = (fns) => {
      for (let i = 0; i < fns.length; i++) {
          // vue2中也是 调用是 让函数依次执行
          fns[i]();
      }
  };
  const onBeforeMount = createHook("bm" /* LifeCycleHooks.BEFORE_MOUNT */);
  const onMounted = createHook("m" /* LifeCycleHooks.MOUNTED */);
  const onBeforeUpdate = createHook("bu" /* LifeCycleHooks.BEFORE_UPDATE */);
  const onUpdated = createHook("u" /* LifeCycleHooks.UPDATED */);

  let queue = [];
  function queueJob(job) {
      // 批量处理 多次更新先缓存去重 之后异步更新
      if (!queue.includes(job)) {
          queue.push(job);
          queueFlush();
      }
  }
  let isFlushPending = false;
  function queueFlush() {
      if (!isFlushPending) {
          isFlushPending = true;
          Promise.resolve().then(flushJobs);
      }
  }
  function flushJobs() {
      isFlushPending = false;
      // 清空时 我们需要根据调用的顺序依次刷新, 保证先刷新父在刷新子
      queue.sort((a, b) => a.id - b.id);
      for (let i = 0; i < queue.length; i++) {
          const job = queue[i];
          job();
      }
      queue.length = 0;
  }

  function createRenderer(rendererOptions) {
      // 告诉core 怎么渲染
      const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, nextSibling: hostNextSibling, } = rendererOptions;
      // -------------------组件----------------------
      const setupRenderEfect = (instance, container) => {
          // 每次状态变化后 都会重新执行effect 是第一次还是修改的?
          instance.update = effect(function componentEffect() {
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
                  let subTree = (instance.subTree = instance.render.call(proxyToUse, proxyToUse));
                  // 用render函数的返回值 继续渲染
                  patch(null, subTree, container);
                  instance.isMounted = true;
                  if (m) {
                      // mounted要求必须在我们子组件完成后才会调用自己
                      invokeArrayFns(m);
                  }
              }
              else {
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
          }, {
              scheduler: queueJob,
          });
      };
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
          if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
              hostSetElementText(el, children); // 文本比较简单 直接扔进去即可
          }
          else if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
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
              }
              else {
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
              }
              else {
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
          }
          else if (i > e2) {
              // 老的多新的少 有一方已经完全比对完成了
              while (i <= e1) {
                  unmount(c1[i]);
                  i++;
              }
          }
          else {
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
                  }
                  else {
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
                  let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
                  // 如果以前不存在这个节点就创造出来 进行插入操作
                  if (newIndexToOldIndexMap[i] === 0) {
                      // 如果自己是0说明没有被patch过
                      patch(null, childVNode, el, anchor);
                  }
                  else {
                      if (i !== increasingNewIndexSequence[j]) {
                          hostInsert(childVNode.el, el, anchor); // dom操作具有移动性 肯定用的是以前的 但是都做了一遍重新插入
                      }
                      else {
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
                      }
                      else {
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
          if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
              hostSetElementText(el, c2); // 直接干掉以前的
          }
          else {
              // 现在是数组
              if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                  // 两个都是数组
                  patchKeyedChildren(c1, c2, el);
              }
              else {
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
          }
          else {
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
                  if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                      processElement(n1, n2, container, anchor);
                  }
                  else if (shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */) {
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

  function h(type, propsOrChildren, children) {
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
          }
          else {
              // 如果第二个参数 不是对象 那一定是孩子
              return createVnode(type, null, propsOrChildren);
          }
      }
      else {
          if (l > 3) {
              children = Array.from(arguments).slice(2);
          }
          else if (l === 3 && isVnode(children)) {
              children = [children];
          }
          return createVnode(type, propsOrChildren, children);
      }
  }

  // 核心属性flush怎么刷新 immediate是否立即调用
  function doWatch(source, cb, { flush, immediate }) {
      let oldValue;
      let scheduler = () => {
          if (cb) {
              const newValue = runner();
              if (hasChanged(oldValue, newValue)) {
                  cb(newValue, oldValue);
                  oldValue = newValue;
              }
          }
          else {
              source(); // watchEffect不用比较新的和老的值 直接触发用户参数执行即可
          }
      };
      let runner = effect(() => source(), {
          // 默认不是立即执行
          lazy: true,
          scheduler,
      }); // 批量更新可以缓存到数组中 开一个异步任务 做队列刷新
      if (immediate) {
          scheduler();
      }
      oldValue = runner();
  }
  function watch(source, cb, options) {
      return doWatch(source, cb, options);
  }
  function watchEffect(source) {
      return doWatch(source, null, {});
  }
  // watch 和 computed对比

  const nodeOps = {
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
      }
      else {
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
      }
      else {
          const eventName = key.slice(2).toLowerCase();
          if (value) {
              // 绑定事件
              let invoker = (invokers[key] = createInvoker(value));
              el.addEventListener(eventName, invoker);
          }
          else {
              // 以前绑定了 但是没有value
              el.removeremoveEventListener(eventName, exists);
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
      }
      else {
          el.setAttribute(key, value);
      }
  };
  const patchProp = (el, key, prevValue, nextValue) => {
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
              }
              else {
                  // 其他属性 直接使用setAttribute
                  patchAttr(el, key, nextValue);
              }
              break;
      }
  };

  // 需要支持dom创建的api及属性处理的api
  // 渲染时用到的所有方法
  const renderOptions = extend({ patchProp }, nodeOps);
  // vue中runtime-core提供了核心的方法 用来处理渲染的 他会使用runtime-dom中的api进行渲染
  // runtime-dom主要的作用就是为了抹平平台差异 不同平台对dom操作方式是不同的 将api传入到core core中可以调用这些方法
  // 1.用户窜如组件和属性 2.需要创建组件的虚拟节点(diff算法) 3.将虚拟节点变成真实节点
  function createApp(rootComponent, rootProps = null) {
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

  exports.computed = computed;
  exports.createApp = createApp;
  exports.createRenderer = createRenderer;
  exports.effect = effect;
  exports.getCurrentInstance = getCurrentInstance;
  exports.h = h;
  exports.invokeArrayFns = invokeArrayFns;
  exports.onBeforeMount = onBeforeMount;
  exports.onBeforeUpdate = onBeforeUpdate;
  exports.onMounted = onMounted;
  exports.onUpdated = onUpdated;
  exports.reactive = reactive;
  exports.readonly = readonly;
  exports.ref = ref;
  exports.shallowReactive = shallowReactive;
  exports.shallowReadonly = shallowReadonly;
  exports.shallowRef = shallowRef;
  exports.toRef = toRef;
  exports.toRefs = toRefs;
  exports.watch = watch;
  exports.watchEffect = watchEffect;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
//# sourceMappingURL=runtime-dom.global.js.map
