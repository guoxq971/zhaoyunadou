import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  checkBalanceSources,
  compileBalanceSources,
  stringifyBalanceManifest,
  writeBalanceManifest,
} from '../scripts/compile-balance-sources.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceGamePackDir = path.join(repoRoot, 'games/zhaoyun-adou');
const sourceDir = path.join(sourceGamePackDir, 'sources/balance');
const expected = JSON.parse(await readFile(path.join(sourceGamePackDir, 'balance.json'), 'utf8'));

const compiled = await compileBalanceSources({ gamePackDir: sourceGamePackDir });
assert.deepEqual(compiled, expected, '拆分后的人工源必须无损组合为现有 balance manifest');
assert.equal(
  stringifyBalanceManifest(compiled),
  stringifyBalanceManifest(await compileBalanceSources({ gamePackDir: sourceGamePackDir })),
  '相同人工源必须生成字节稳定的 JSON',
);
await assert.doesNotReject(() => checkBalanceSources({ gamePackDir: sourceGamePackDir }));

const makeFixture = async () => {
  const gamePackDir = await mkdtemp(path.join(tmpdir(), 'zhaoyun-adou-balance-'));
  await cp(sourceDir, path.join(gamePackDir, 'sources/balance'), { recursive: true });
  await writeFile(
    path.join(gamePackDir, 'balance.json'),
    stringifyBalanceManifest(expected),
  );
  return gamePackDir;
};

{
  const gamePackDir = await makeFixture();
  try {
    const stale = structuredClone(expected);
    stale.recruitCost.base += 1;
    await writeFile(path.join(gamePackDir, 'balance.json'), stringifyBalanceManifest(stale));
    await assert.rejects(
      () => checkBalanceSources({ gamePackDir }),
      /out of sync.*--write/i,
      '人工源与兼容 manifest 不同步时必须明确失败',
    );
    await writeBalanceManifest({ gamePackDir });
    assert.deepEqual(
      JSON.parse(await readFile(path.join(gamePackDir, 'balance.json'), 'utf8')),
      expected,
      '--write 必须恢复与人工源深等价的兼容 manifest',
    );
  } finally {
    await rm(gamePackDir, { recursive: true, force: true });
  }
}

{
  const gamePackDir = await makeFixture();
  try {
    const piecesPath = path.join(gamePackDir, 'sources/balance/pieces.json');
    const piecesText = await readFile(piecesPath, 'utf8');
    await writeFile(
      piecesPath,
      piecesText.replace('"dmg": 6,', '"dmg": 6,\n      "dmg": 7,'),
    );
    await assert.rejects(
      () => compileBalanceSources({ gamePackDir }),
      /duplicate key "dmg"/i,
      '嵌套数值定义中的重复键也必须明确失败',
    );
  } finally {
    await rm(gamePackDir, { recursive: true, force: true });
  }
}

{
  const gamePackDir = await makeFixture();
  try {
    const economyPath = path.join(gamePackDir, 'sources/balance/economy.json');
    const economyText = await readFile(economyPath, 'utf8');
    await writeFile(
      economyPath,
      economyText.replace(
        '"version": "1.0.0",',
        '"version": "1.0.0",\n  "version": "1.0.0",',
      ),
    );
    await assert.rejects(
      () => compileBalanceSources({ gamePackDir }),
      /duplicate top-level key "version"/i,
      '单个人工源内的重复顶层键不能被 JSON\.parse 静默覆盖',
    );
  } finally {
    await rm(gamePackDir, { recursive: true, force: true });
  }
}

{
  const gamePackDir = await makeFixture();
  try {
    const economyPath = path.join(gamePackDir, 'sources/balance/economy.json');
    const economy = JSON.parse(await readFile(economyPath, 'utf8'));
    economy.unknownBalanceSection = {};
    await writeFile(economyPath, JSON.stringify(economy, null, 2));
    await assert.rejects(
      () => compileBalanceSources({ gamePackDir }),
      /unknown section "unknownBalanceSection"/i,
      '未知 balance section 必须明确失败',
    );
  } finally {
    await rm(gamePackDir, { recursive: true, force: true });
  }
}

{
  const gamePackDir = await makeFixture();
  try {
    const economyPath = path.join(gamePackDir, 'sources/balance/economy.json');
    const economy = JSON.parse(await readFile(economyPath, 'utf8'));
    economy.items = structuredClone(expected.items);
    await writeFile(economyPath, JSON.stringify(economy, null, 2));
    await assert.rejects(
      () => compileBalanceSources({ gamePackDir }),
      /duplicate section "items"/i,
      '不同人工源共同声明同一 section 时必须明确失败',
    );
  } finally {
    await rm(gamePackDir, { recursive: true, force: true });
  }
}

{
  const gamePackDir = await makeFixture();
  try {
    await execFileAsync(process.execPath, [
      path.join(repoRoot, 'scripts/compile-balance-sources.mjs'),
      '--game-dir',
      gamePackDir,
    ]);

    const stale = structuredClone(expected);
    stale.maxLevel += 1;
    await writeFile(path.join(gamePackDir, 'balance.json'), stringifyBalanceManifest(stale));
    await assert.rejects(
      () => execFileAsync(process.execPath, [
        path.join(repoRoot, 'scripts/compile-balance-sources.mjs'),
        '--game-dir',
        gamePackDir,
      ]),
      /out of sync/i,
      '无操作参数的 CLI 必须默认执行只读 --check',
    );
  } finally {
    await rm(gamePackDir, { recursive: true, force: true });
  }
}

console.log('✓ balance 人工源拆分、确定性编译、同步与错误门禁');
