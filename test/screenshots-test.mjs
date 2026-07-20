import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from './source-fingerprint.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const screenshotRoot = join(root, 'test-artifacts/screenshots');
const datedDirs = (await readdir(screenshotRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
  .map((entry) => join(screenshotRoot, entry.name))
  .sort();
assert.ok(datedDirs.length > 0, '至少需要一批按日期归档的截图');

// 最新日期必须对应当前代码；历史目录仍用于保留移动端等回归证据。
const artifactDir = datedDirs.at(-1);
const manifest = JSON.parse(await readFile(join(artifactDir, 'manifest.json'), 'utf8'));

assert.equal(manifest.browser, 'Chrome');
assert.equal(manifest.schemaVersion, 2, '截图清单必须使用可追踪格式');
assert.equal(manifest.sourceFingerprint, await sourceFingerprint(root), '代码变化后必须重新生成截图证据');
assert.match(manifest.userAgent, /Chrome\/\d+/, '截图清单必须记录真实 Chrome 用户代理');
assert.equal(manifest.consoleErrors, 0);
assert.equal(manifest.consoleWarnings, 0);
assert.ok(manifest.screenshots.length >= 15, '至少保存 15 张关键截图');
assert.ok(manifest.screenshots.every((entry) => entry.result === 'pass'));
const currentEntries = manifest.screenshots.filter((entry) => entry.runId === manifest.runId);
assert.deepEqual(currentEntries.map((entry) => entry.file), manifest.currentRunFiles);
assert.ok(currentEntries.length >= 15, '当前代码指纹至少要有 15 张关键截图，旧截图不能冒充本轮证据');

for (const entry of manifest.screenshots) {
  const bytes = await readFile(join(artifactDir, entry.file));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', `${entry.file} 必须为 PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(`${width}x${height}`, entry.imageSize, `${entry.file} 尺寸必须与清单一致`);
}

let historicalMobile;
for (const directory of [...datedDirs].reverse()) {
  try {
    const candidate = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    const entry = candidate.screenshots.find((item) => item.file.includes('mobile-390x844'));
    if (entry) {
      historicalMobile = { directory, entry };
      break;
    }
  } catch {
    // 未完成归档不会覆盖已经验收的历史移动端证据。
  }
}
assert.equal(historicalMobile?.entry.imageSize, '390x844');
const mobileBytes = await readFile(join(historicalMobile.directory, historicalMobile.entry.file));
assert.equal(mobileBytes.subarray(1, 4).toString(), 'PNG');

assert.ok(currentEntries.some((entry) => entry.state?.resultAction === 'replay'));
assert.ok(currentEntries.some((entry) => entry.state?.resultAction === 'complete'));
assert.ok(currentEntries.some((entry) => entry.testPoint.includes('征兵')));
assert.ok(currentEntries.some((entry) => entry.testPoint.includes('铲地')));
assert.ok(currentEntries.some((entry) => entry.state?.merges === 1));
assert.ok(currentEntries.some((entry) => entry.state?.paused === true));
assert.ok(currentEntries.some((entry) => entry.state?.bossActive === true));

const batchInitial = currentEntries.find((entry) => entry.testPoint.includes('批量征兵·补满'));
assert.deepEqual(
  [batchInitial?.state?.batchFilled, batchInitial?.state?.batchCost, batchInitial?.state?.batchStopReason],
  [1, 16, 'bench-full'],
  '初始营栏一键征兵应只补唯一空位，并且只扣一次费用',
);
const batchPartial = currentEntries.find((entry) => entry.testPoint.includes('批量征兵·部分成功'));
assert.deepEqual(
  [batchPartial?.state?.batchFilled, batchPartial?.state?.batchCost, batchPartial?.state?.batchStopReason],
  [2, 36, 'insufficient-mantou'],
  '资源不足时应保留已成功的两次征兵并说明停止原因',
);
const batchFull = currentEntries.find((entry) => entry.testPoint.includes('营满不扣费'));
assert.deepEqual(
  [batchFull?.state?.batchFilled, batchFull?.state?.batchCost, batchFull?.state?.batchStopReason],
  [0, 0, 'bench-full'],
  '营栏已满时不得扣费或消耗随机抽取',
);
assert.ok(currentEntries.some((entry) => entry.state?.swaps >= 1 && entry.state?.lastCommandAction === 'swap'),
  '必须保留真实单位原子交换证据');
const rollback = currentEntries.find((entry) => entry.testPoint.includes('非法回滚'));
assert.equal(rollback?.state?.lastCommandResult, false);
assert.equal(rollback?.state?.lastCommandReason, 'target-not-open');
assert.equal(rollback?.state?.rollbackBeforeBench, rollback?.state?.rollbackAfterBench,
  '非法落点前后营栏必须完全一致');
assert.equal(rollback?.state?.rollbackBeforeBoard, rollback?.state?.rollbackAfterBoard,
  '非法落点前后棋盘必须完全一致');
assert.ok(currentEntries.some((entry) => entry.testPoint.includes('合成后移动')
  && entry.state?.merges >= 1
  && entry.state?.moves >= 1
  && entry.state?.lastCommandAction === 'move'), '必须保留升级单位继续移动证据');
assert.ok(currentEntries.some((entry) => entry.testPoint.includes('路线') && entry.state?.routeLanes === 2),
  '必须保留由关卡数据驱动的双路线证据');

const clearedStages = new Set(currentEntries
  .filter((entry) => entry.state?.screen === 'result' && entry.state?.win === true)
  .map((entry) => entry.state.stage));
assert.deepEqual([...clearedStages].sort((a, b) => a - b), [1, 2, 3, 4, 5]);

const expectedHeroes = ['guanyu', 'huangzhong', 'liubei', 'zhangfei', 'zhaoyun'];
const usedHeroes = new Set(currentEntries
  .filter((entry) => entry.state?.heroCasts > 0)
  .map((entry) => entry.state.lastHeroCast));
assert.deepEqual([...usedHeroes].filter(Boolean).sort(), expectedHeroes);
assert.ok(currentEntries.some((entry) => entry.state?.screen === 'title' && entry.state?.stars === 5));

console.log(`✓ ${manifest.screenshots.length} 张 Chrome 关键截图及清单完整`);
