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
let uid = 0;
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
    effect.id = uid++; // 制作一个effect标识 用于区分effect
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
const readonlyGet = createGetter(true);
const showllowReadonlyGet = createGetter(true, true);
const set = createSetter();
const mutableHandlers = {
    get,
    set,
};
let readonlyObj = {
    set: (target, key) => {
        console.warn(`set on key ${key} falied`);
    },
};
const readonlyHandlers = extend({
    get: readonlyGet,
}, readonlyObj);
extend({
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
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers);
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
    normalizeChildren(vnode, children);
    return vnode;
};
function normalizeChildren(vnode, children) {
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
                // 挂载的目的地
                // let vnode = {}
                // render(vnode,container);
                // 1.根据组件创建虚拟节点
                // 2.将虚拟节点和容器获取到后调用render方法进行渲染
                // 创造虚拟节点
                const vnode = createVnode(rootComponent, rootProps);
                // 调用render
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
function createComponentInstance(vnode) {
    // webcomponent 组件需要有“属性” “插槽”
    const instance = {
        // 组件的实例
        vnode,
        type: vnode.type,
        props: {},
        attrs: {},
        slots: {},
        ctx: {},
        data: {},
        setupState: {},
        render: null,
        subTree: null,
        isMounted: false, // 表示这个组件是否挂载过
    };
    instance.ctx = { _: instance }; // instance.ctx._
    return instance;
}
function setupComponent(instance) {
    const { props, children } = instance.vnode; // {type,props,children}
    // 根据props 解析出 props 和 attrs，将其放到instance上
    instance.props = props; // initProps()
    instance.children = children; // 插槽的解析 initSlot()
    // 需要先看下 当前组件是不是有状态的组件， 函数组件
    let isStateful = instance.vnode.shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */;
    if (isStateful) {
        // 表示现在是一个带状态的组件
        // 调用 当前实例的setup方法，用setup的返回值 填充 setupState和对应的render方法
        setupStatefulComponent(instance);
    }
}
function setupStatefulComponent(instance) {
    // 1.代理 传递给render函数的参数
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    // 2.获取组件的类型 拿到组件的setup方法
    let Component = instance.type;
    let { setup } = Component;
    // ------ 没有setup------
    if (setup) {
        let setupContext = createSetupContext(instance);
        const setupResult = setup(instance.props, setupContext); // instance 中props attrs slots emit expose 会被提取出来，因为在开发过程中会使用这些属性
        handleSetupResult(instance, setupResult);
    }
    else {
        finishComponentSetup(instance); // 完成组件的启动
    }
}
function handleSetupResult(instance, setupResult) {
    if (isFunction(setupResult)) {
        instance.render = setupResult;
    }
    else if (isObject(setupResult)) {
        instance.setupState = setupResult;
    }
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
        expose: () => { },
    };
}
// 他们的关系涉及到后面的使用
// instance 表示的组件的状态 各种各样的状态，组件的相关信息
// context 就4个参数 是为了开发时使用的
// proxy 主要为了取值方便  =》 proxy.xxxx

let queue = [];
function queueJob(job) {
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
    // 清空时  我们需要根据调用的顺序依次刷新  , 保证先刷新父在刷新子
    queue.sort((a, b) => a.id - b.id);
    for (let i = 0; i < queue.length; i++) {
        const job = queue[i];
        job();
    }
    queue.length = 0;
}

function createRenderer(rendererOptions) {
    // 告诉core 怎么渲染
    const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, } = rendererOptions;
    // -------------------组件----------------------
    const setupRenderEfect = (instance, container) => {
        // 需要创建一个effect 在effect中调用 render方法，这样render方法中拿到的数据会收集这个effect，属性更新时effect会重新执行
        instance.update = effect(function componentEffect() {
            // 每个组件都有一个effect， vue3 是组件级更新，数据变化会重新执行对应组件的effect
            if (!instance.isMounted) {
                // 初次渲染
                let proxyToUse = instance.proxy;
                // $vnode  _vnode
                // vnode  subTree
                let subTree = (instance.subTree = instance.render.call(proxyToUse, proxyToUse));
                // 用render函数的返回值 继续渲染
                patch(null, subTree, container);
                instance.isMounted = true;
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
    const mountElement = (vnode, container) => {
        // 递归渲染
        const { props, shapeFlag, type, children } = vnode;
        let el = (vnode.el = hostCreateElement(type));
        if (props) {
            for (const key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
            hostSetElementText(el, children); // 文本比较简单 直接扔进去即可
        }
        else if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
            mountChildren(children, el);
        }
        hostInsert(el, container);
    };
    const processElement = (n1, n2, container) => {
        if (n1 == null) {
            mountElement(n2, container);
        }
    };
    //----------------- 处理元素-----------------
    // -----------------文本处理-----------------
    const processText = (n1, n2, container) => {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateText(n2.children)), container);
        }
    };
    // -----------------文本处理-----------------
    const patch = (n1, n2, container) => {
        // 针对不同类型 做初始化操作
        const { shapeFlag, type } = n2;
        switch (type) {
            case Text:
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container);
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
// createRenderer 目的是创建一个渲染器
// 框架 都是将组件 转化成虚拟DOM -》 虚拟DOM生成真实DOM挂载到真实页面上

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

export { createRenderer, h };
//# sourceMappingURL=runtime-core.esm-bundler.js.map
