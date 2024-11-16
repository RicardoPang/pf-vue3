import { isFunction } from '@vue/shared';
import { effect, track, trigger } from './effect';
import { TrackOpTypes, TriggerOrTypes } from './operators';

class ComputedRefImpl {
  public _dirty = true; // 默认取值时不要用缓存
  public _value;
  public effect;
  constructor(public getter, public setter) {
    // 返还了effect的执行权限
    this.effect = effect(getter, {
      lazy: true, // 默认不执行
      scheduler: () => {
        // 传入了scheduler后 下次数据更新 原则上应该让effect重新执行 下次更新会调用scheduler
        if (!this._dirty) {
          // 依赖属性变化时
          this._dirty = true; // 标记为脏 触发视图更新
          trigger(this, TriggerOrTypes.SET, 'value');
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
    track(this, TrackOpTypes.GET, 'value'); // 进行属性依赖收集
    return this._value;
  }
  set value(newValue) {
    // 当用户给计算属性设置值的时候会触发set方法 此时调用计算属性的setter
    this.setter(newValue);
  }
}

export function computed(getterOrOptoins) {
  let getter;
  let setter;
  if (isFunction(getterOrOptoins)) {
    // computed两种写法
    getter = getterOrOptoins;
    setter = () => {
      console.warn('computed value must be readonly');
    };
  } else {
    getter = getterOrOptoins.get;
    setter = getterOrOptoins.set;
  }
  return new ComputedRefImpl(getter, setter);
}
