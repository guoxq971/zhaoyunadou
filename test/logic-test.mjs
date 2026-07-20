// node test/logic-test.mjs —— 纯逻辑断言(无 DOM)
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { recruitCost, rollGacha, canMerge, troopDmg, detectHero, unlockHero, useBrush, useShovel } from '../src/logic.js';
import { buildMap } from '../src/map.js';

let n = 0;
const ok = (name, fn) => { fn(); console.log(`✓ ${++n} ${name}`); };
const seededRandom = (seed = 123456789) => () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x100000000;
};

ok('征兵费用曲线 16/20/26/34/44', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(recruitCost), [16, 20, 26, 34, 44]);
});

ok('合成判定:同类同级可合,异类/异级/满级不可', () => {
  const t = (type, level) => ({ kind: 'troop', type, level });
  assert.equal(canMerge(t('dao', 1), t('dao', 1)), true);
  assert.equal(canMerge(t('dao', 1), t('dao', 2)), false);
  assert.equal(canMerge(t('dao', 1), t('gong', 1)), false);
  assert.equal(canMerge(t('dao', CONFIG.maxLevel), t('dao', CONFIG.maxLevel)), false);
  assert.equal(canMerge(t('nong', 3), t('nong', 3)), false); // 农上限3
  assert.equal(canMerge(t('dao', 1), { kind: 'frag', char: '赵' }), false);
  assert.equal(canMerge({ kind: 'frag', char: '赵' }, { kind: 'frag', char: '赵', level: 1 }), true);
  assert.equal(canMerge({ kind: 'frag', char: '赵' }, { kind: 'frag', char: '云' }), false);
});

ok('攻击力等级缩放', () => {
  assert.equal(troopDmg('dao', 1), 6);
  assert.equal(troopDmg('dao', 2), Math.round(6 * 2.2));
  assert.ok(troopDmg('qi', 5) > troopDmg('qi', 4));
});

ok('抽卡:500 次全部落在合法结果内且各类都出过', () => {
  const kinds = new Set();
  const rand = seededRandom(7);
  for (let i = 0; i < 500; i++) {
    const g = rollGacha(rand, []);
    assert.ok(['troop', 'frag', 'shovel'].includes(g.kind));
    if (g.kind === 'troop') assert.ok(CONFIG.troops[g.type]);
    if (g.kind === 'frag') assert.ok(Object.values(CONFIG.heroes).some((h) => h.chars.includes(g.char)));
    kinds.add(g.kind === 'troop' ? g.type : g.kind);
  }
  for (const k of ['dao', 'qiang', 'gong', 'qi', 'frag']) assert.ok(kinds.has(k), `未出过 ${k}`);
});

ok('抽卡配对加权:已有「赵」时「云」概率明显高于「备」', () => {
  let yun = 0, bei = 0;
  const rand = seededRandom(99);
  for (let i = 0; i < 6000; i++) {
    const g = rollGacha(rand, ['赵']);
    if (g.kind === 'frag' && g.char === '云') yun++;
    if (g.kind === 'frag' && g.char === '备') bei++;
  }
  assert.ok(yun > bei * 1.3, `云=${yun} 备=${bei}`);
});

ok('英雄拼字:左右相邻按序才成立,倒序不成立', () => {
  const { grid } = buildMap();
  grid[1][1].unit = { kind: 'frag', char: '赵' };
  grid[1][2].unit = { kind: 'frag', char: '云' };
  const hit = detectHero(grid, 1, 2); // 从右字触发也能找到
  assert.equal(hit?.key, 'zhaoyun');
  assert.equal(hit.c, 1);
  const g2 = buildMap().grid;
  g2[1][1].unit = { kind: 'frag', char: '云' };
  g2[1][2].unit = { kind: 'frag', char: '赵' }; // 倒序
  assert.equal(detectHero(g2, 1, 2), null);
});

ok('英雄解锁:两格变 hero,heroes 列表登记', () => {
  const state = { grid: buildMap().grid, heroes: [] };
  state.grid[2][1].unit = { kind: 'frag', char: '黄' };
  state.grid[2][2].unit = { kind: 'frag', char: '忠' };
  unlockHero(state, { key: 'huangzhong', r: 2, c: 1 });
  assert.equal(state.grid[2][1].unit.kind, 'hero');
  assert.equal(state.grid[2][2].unit.kind, 'hero');
  assert.equal(state.heroes[0].key, 'huangzhong');
});

ok('铲子:locked→open,消耗一把;open/path/rock 不可铲', () => {
  const state = { grid: buildMap().grid, shovels: 2 };
  assert.equal(useShovel(state, 1, 3), true);  // 该格默认 locked
  assert.equal(state.grid[1][3].type, 'open');
  assert.equal(state.shovels, 1);
  assert.equal(useShovel(state, 1, 1), false); // 已是 open
  assert.equal(useShovel(state, 0, 0), false); // path
  assert.equal(state.shovels, 1);
});

ok('毛笔:普通单位改写成本关缺少的英雄字并消耗一次', () => {
  const state = {
    grid: buildMap().grid,
    bench: [],
    stage: CONFIG.campaign.stages[0],
    brushes: 1,
    stats: {},
  };
  state.grid[4][2].unit = { kind: 'troop', type: 'dao', level: 1 };
  state.grid[4][3].unit = { kind: 'frag', char: '云' };
  const result = useBrush(state, 4, 2);
  assert.equal(result.char, '赵');
  assert.equal(result.hero.key, 'zhaoyun');
  assert.equal(state.brushes, 0);
  assert.equal(state.stats.brushUses, 1);
  assert.equal(useBrush(state, 4, 3), false, '次数耗尽后不可重复改字');
});

ok('地图:路径连通(相邻格曼哈顿距离=1)且终点是营门', () => {
  const { grid, path } = buildMap();
  for (let i = 1; i < path.length; i++) {
    const d = Math.abs(path[i].r - path[i - 1].r) + Math.abs(path[i].c - path[i - 1].c);
    assert.equal(d, 1, `路径断裂@${i}`);
  }
  const end = path[path.length - 1];
  assert.equal(grid[end.r][end.c].type, 'gate');
});

console.log(`\n全部 ${n} 组断言通过`);
