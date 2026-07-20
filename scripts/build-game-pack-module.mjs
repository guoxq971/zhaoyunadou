import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'games/zhaoyun-adou');
const entries = [
  ['game', 'game.json'],
  ['balance', 'balance.json'],
  ['levels', 'levels.json'],
  ['copy', 'copy.zh-CN.json'],
  ['theme', 'theme.json'],
  ['assets', 'assets.json'],
  ['audio', 'audio.json'],
  ['events', 'events.json'],
];

const manifests = {};
for (const [key, filename] of entries) {
  manifests[key] = JSON.parse(await readFile(path.join(root, filename), 'utf8'));
}

const output = `// 由 scripts/build-game-pack-module.mjs 生成；请修改 JSON Manifest 后重新生成。\n`
  + `export const manifests = ${JSON.stringify(manifests, null, 2)};\n`;
await writeFile(path.join(root, 'generated-manifests.js'), output);
console.log(`generated ${path.join(root, 'generated-manifests.js')}`);
