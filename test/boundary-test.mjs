import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreDir = path.join(root, 'src/engine-core');
const coreFiles = (await readdir(coreDir)).filter((file) => file.endsWith('.js'));

for (const file of coreFiles) {
  const source = await readFile(path.join(coreDir, file), 'utf8');
  assert.doesNotMatch(source, /from ['"].*(?:games\/|config\.js|rulesets\/|presentation-pack\/)/, `${file} 不可反向依赖具体内容、规则或表现包`);
  assert.doesNotMatch(source, /赵云|阿斗|巨鹿|zyad_/, `${file} 不可包含首包题材或存档键`);
}

const sourceFiles = (await readdir(path.join(root, 'src'))).filter((file) => file.endsWith('.js'));
const gameImports = [];
for (const file of sourceFiles) {
  const source = await readFile(path.join(root, 'src', file), 'utf8');
  if (source.includes('../games/')) gameImports.push(file);
}
assert.deepEqual(gameImports, ['game-pack.js'], '只有 composition root 可以选择具体内容包');

const configSource = await readFile(path.join(root, 'src/config.js'), 'utf8');
assert.doesNotMatch(configSource, /烽燧|baseHp|gachaWeights|startMantou\s*:/, 'CONFIG 只能是默认 Pack 兼容门面');

console.log('✓ engine-core、ruleset/content/presentation 与 composition root 依赖边界');
