const isObject = (value) => typeof value == 'object' && value !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isFunction = (value) => typeof value == 'function';
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

export { computed, effect, reactive, readonly, ref, shallowReactive, shallowReadonly, shallowRef, toRef, toRefs };
//# sourceMappingURL=reactivity.esm-bundler.js.map
