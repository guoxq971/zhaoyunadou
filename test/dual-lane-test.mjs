import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { buildMap } from '../src/map.js';
import { createGame } from '../src/state.js';
import { enemyXY, spawnEnemy, updateEnemies } from '../src/enemies.js';
import { updateDragonDamage, updateHeroes } from '../src/heroes.js';
import { cellXY } from '../src/ui-layout.js';

const { grid, paths, path } = buildMap();

assert.equal(CONFIG.board.cols, 8);
assert.equal(CONFIG.board.rows, 10);
assert.equal(grid.length, 10);
assert.ok(grid.every((row) => row.length === 8), '棋盘必须是 8×10');
assert.equal(paths.length, 2);
assert.strictEqual(path, paths[0], '旧 path 字段必须继续指向第一路');
assert.equal(paths[0].length, paths[1].length, '上下两路必须等长');
assert.deepEqual(paths[0][0], { r: 0, c: 7 });
assert.deepEqual(paths[0].at(-1), { r: 0, c: 0 });
assert.deepEqual(paths[1][0], { r: 9, c: 0 });
assert.deepEqual(paths[1].at(-1), { r: 9, c: 7 });

for (const route of paths) {
  const unique = new Set(route.map(({ r, c }) => `${r},${c}`));
  assert.equal(unique.size, route.length, '同一路径不能重复经过一个格子');
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    assert.equal(Math.abs(a.r - b.r) + Math.abs(a.c - b.c), 1, '路径每一步必须四向相邻');
  }
}

const lane0Cells = new Set(paths[0].map(({ r, c }) => `${r},${c}`));
assert.ok(paths[1].every(({ r, c }) => !lane0Cells.has(`${r},${c}`)), '两路不能相交');
paths[0].forEach((cell, index) => {
  const rotated = paths[1][index];
  assert.deepEqual(rotated, { r: 9 - cell.r, c: 7 - cell.c }, '第二路必须是第一路的 180° 旋转');
});
assert.equal(grid[0][7].decoration, 'bramble');
assert.equal(grid[9][0].decoration, 'bramble');
assert.equal(grid[0][0].type, 'gate');
assert.equal(grid[9][7].type, 'gate');
assert.equal(grid.flat().filter((cell) => cell.type === 'gate').length, 2, '两路终点是营门，不是两个阿斗');

{
  const state = createGame();
  Object.assign(state, { paths, path, wave: 1 });
  spawnEnemy(state, 'normal', 0);
  spawnEnemy(state, 'normal', 1);
  spawnEnemy(state, 'normal', 2);
  assert.deepEqual(state.enemies.map((enemy) => enemy.lane), [0, 1, 0], '敌人必须按 idx 交替上下路');

  state.enemies.forEach((enemy) => { enemy.bob = 0; });
  const top = enemyXY(state, state.enemies[0], cellXY);
  const bottom = enemyXY(state, state.enemies[1], cellXY);
  assert.deepEqual(top, cellXY(0, 7));
  assert.deepEqual(bottom, cellXY(9, 0));
}

{
  const state = createGame();
  Object.assign(state, { paths, path });
  const endP = paths[1].length - 1;
  state.enemies = [{
    type: 'normal', lane: 1, wave: 1, hp: 20, maxHp: 20,
    p: endP - 0.01, speed: 2, stun: 0, bob: 0,
  }];
  const lives = state.lives;
  updateEnemies(state, 0.1, cellXY);
  assert.equal(state.lives, lives - 1, '敌人突破任一营门都应扣除同一个阿斗的共享命数');
  const impact = state.effects.find((effect) => effect.kind === 'text' && effect.text === '-1❤');
  const end = cellXY(9, 7);
  assert.deepEqual({ x: impact.x, y: impact.y }, { x: end.x, y: end.y - 20 });
}

{
  const state = createGame();
  Object.assign(state, { paths, path, title: false, time: 1 });
  state.heroes = [{ key: 'zhaoyun', r: 4, c: 2, cd: 999, ultCd: 0 }];
  state.enemies = [0, 1].map((lane) => ({
    type: 'normal', lane, wave: 1, hp: 1_000, maxHp: 1_000,
    p: 0, speed: 0, stun: 0, bob: 0,
  }));
  updateHeroes(state, 0.1, cellXY);
  const dragons = state.effects.filter((effect) => effect.kind === 'dragon');
  assert.deepEqual(dragons.map((effect) => effect.lane), [0, 1], '赵云大招必须同时生成两路火龙');
  updateDragonDamage(state, cellXY);
  assert.deepEqual(state.enemies.map((enemy) => enemy.hp), [910, 910], '每路敌人只受到本路火龙一次伤害');
  assert.deepEqual(dragons.map((effect) => effect.hit.size), [1, 1]);
}

{
  const legacy = createGame();
  delete legacy.paths;
  legacy.wave = 1;
  spawnEnemy(legacy, 'normal', 1);
  assert.equal(legacy.enemies[0].lane, 0, '旧 state.path 状态必须回退为单路');
  legacy.enemies[0].bob = 0;
  assert.deepEqual(enemyXY(legacy, legacy.enemies[0], cellXY), cellXY(path[0].r, path[0].c));
}

console.log('✓ 8×10 双线 S 路径、交替出兵、分路移动与赵云双龙');
