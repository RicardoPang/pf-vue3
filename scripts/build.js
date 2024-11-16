// 这里就是我们要针对menorepo进行编译项目 把package目录下的所有包都进行打包

const fs = require('fs'); // node来解析packages文件夹
const execa = require('execa'); // 开启子进程 进行打包， 最终还是使用rollup来进行打包

const targets = fs.readdirSync('packages').filter((f) => {
  if (!fs.statSync(`packages/${f}`).isDirectory()) {
    return false;
  }
  return true;
});

// 对我们目标进行依次打包 ，并行打包
async function build(target) {
  // rollup  -c --environment TARGET:shated
  await execa('rollup', ['-c', '--environment', `TARGET:${target}`], {
    stdio: 'inherit',
  }); // 当子进程打包的信息共享给父进程
}

function runParallel(targets, iteratorFn) {
  // 并发去打包 每次打包都调用build方法
  const res = [];
  for (const item of targets) {
    const p = iteratorFn(item);
    res.push(p);
  }
  return Promise.all(res); // 存储打包时的promise 等待所有全部打包完毕后 调用成功
}

runParallel(targets, build);
