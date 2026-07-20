import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');
const forbidden = /\b(?:window|document|localStorage|AudioContext|webkitAudioContext|wx|nativeBridge|userAgent)\b/;

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path.relative(srcRoot, target).split(path.sep)[0] === 'platforms') continue;
      output.push(...await filesUnder(target));
    } else if (entry.isFile() && entry.name.endsWith('.js')) output.push(target);
  }
  return output;
}

for (const file of await filesUnder(srcRoot)) {
  const source = await readFile(file, 'utf8');
  assert.doesNotMatch(source, forbidden, `${path.relative(root, file)} 不可直接识别平台全局`);
}

for (const file of await filesUnder(path.join(root, 'games'))) {
  const source = await readFile(file, 'utf8');
  assert.doesNotMatch(source, forbidden, `${path.relative(root, file)} 不可包含平台判断`);
}

console.log('✓ 非平台目录无浏览器、微信或原生桥全局');
