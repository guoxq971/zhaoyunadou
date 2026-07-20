import assert from 'node:assert/strict';
import { computeCanvasFit } from '../src/canvas-fit.js';
import { createSafeStorage } from '../src/storage.js';

{
  const fit = computeCanvasFit(390, 844, 3);
  assert.equal(fit.cssWidth, 390);
  assert.equal(fit.cssHeight, 706);
  assert.equal(fit.pixelWidth, 1170);
  assert.equal(fit.pixelHeight, 2118);
  assert.equal(fit.transformScale, 390 / 420 * 3);
}

{
  const fit = computeCanvasFit(1916, 808, 1);
  assert.equal(fit.cssWidth, 420, '桌面端不放大，保持参考图原生比例与清晰线条');
  assert.equal(fit.cssHeight, 760);
  assert.equal(fit.pixelWidth, 420);
  assert.equal(fit.pixelHeight, 760);
}

{
  const primary = {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); },
  };
  const storage = createSafeStorage(primary);
  assert.equal(storage.getItem('stars'), null);
  storage.setItem('stars', '3');
  assert.equal(storage.getItem('stars'), '3', '主存储异常时必须回退到会话内存');
  assert.equal(storage.persistent, false);
}

{
  const primary = {
    getItem() { return '1'; },
    setItem() { throw new Error('quota exceeded'); },
  };
  const storage = createSafeStorage(primary);
  assert.equal(storage.getItem('stars'), '1');
  storage.setItem('stars', '2');
  assert.equal(
    storage.getItem('stars'),
    '2',
    '写入失败后必须保留本会话的新进度，不能再被旧持久值覆盖',
  );
  assert.equal(storage.persistent, false);
}

console.log('✓ DPR 画布适配与安全存储降级');
