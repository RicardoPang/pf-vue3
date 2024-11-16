import { effect } from '@vue/reactivity';
import { hasChanged } from '@vue/shared';

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
    } else {
      source(); // watchEffect不用比较新的和老的值 直接触发用户参数执行即可
    }
  };
  let runner = effect(() => source(), {
    // 默认不是立即执行
    lazy: true, // 默认不让effect执行
    scheduler,
  }); // 批量更新可以缓存到数组中 开一个异步任务 做队列刷新
  if (immediate) {
    scheduler();
  }
  oldValue = runner();
}

export function watch(source, cb, options) {
  return doWatch(source, cb, options);
}

export function watchEffect(source) {
  return doWatch(source, null, {} as any);
}

// watch 和 computed对比
