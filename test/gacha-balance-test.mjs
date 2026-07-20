import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { rollGacha } from '../src/logic.js';

const seededRandom = (seed) => () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const makesHero = (chars) => Object.values(CONFIG.heroes)
  .some((hero) => hero.chars.every((char) => chars.includes(char)));

let completed = 0;
const samples = 50_000;
for (let seed = 1; seed <= samples; seed++) {
  const rand = seededRandom(seed);
  const owned = [];
  for (let draw = 0; draw < 6; draw++) {
    const got = rollGacha(rand, owned);
    if (got.kind === 'frag') owned.push(got.char);
    if (makesHero(owned)) { completed++; break; }
  }
}

const rate = completed / samples;
assert.ok(rate >= 0.10, `6 次征兵成将率过低：${(rate * 100).toFixed(2)}%`);
assert.ok(rate <= 0.30, `成将率过高会淹没兵种养成：${(rate * 100).toFixed(2)}%`);

console.log(`✓ 六次征兵自然成将率 ${(rate * 100).toFixed(2)}%`);
