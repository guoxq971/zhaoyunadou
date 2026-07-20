import assert from 'node:assert/strict';
import { computeCanvasFit } from '../src/canvas-fit.js';
import { createSafeStorage, createScopedStorage, e2eStorageNamespace } from '../src/storage.js';

{
  const fit = computeCanvasFit(390, 844, 3);
  assert.equal(fit.cssWidth, 390);
  assert.equal(fit.cssHeight, 706);
  assert.equal(fit.pixelWidth, 1170);
  assert.equal(fit.pixelHeight, 2118);
  assert.equal(fit.transformScale, 390 / 420 * 3);
}

assert.equal(e2eStorageNamespace(''), '');
assert.equal(e2eStorageNamespace('?e2e=selector-1'), 'zyad-e2e-selector-1');
assert.equal(e2eStorageNamespace('?e2e'), 'zyad-e2e-anonymous', '空 e2e 参数也必须隔离');
assert.match(e2eStorageNamespace('?e2e=关卡选择'), /^zyad-e2e-run-[0-9a-f]+$/, '非拉丁运行号不可回落正常存档');

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

{
  const values = new Map([['zyad_cleared_stars', '5']]);
  const primary = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const normal = createSafeStorage(primary);
  const testRun = createScopedStorage(normal, 'e2e:selector');
  testRun.setItem('zyad_cleared_stars', '2');
  assert.equal(normal.getItem('zyad_cleared_stars'), '5', '测试运行不可污染正常游戏存档');
  assert.equal(testRun.getItem('zyad_cleared_stars'), '2');
  testRun.removeItem('zyad_cleared_stars');
  assert.equal(testRun.getItem('zyad_cleared_stars'), null);
  assert.equal(normal.getItem('zyad_cleared_stars'), '5');
}

console.log('✓ DPR 画布适配、安全存储降级与测试存档隔离');
