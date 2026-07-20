import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/state.js';
import { advanceBattle } from '../src/game-loop.js';
import { cellXY } from '../src/ui-layout.js';

function deployStarterBench(state) {
  const cells = [[4, 4], [4, 5], [5, 4]];
  cells.forEach(([r, c], index) => {
    state.grid[r][c].unit = state.bench[index];
    state.bench[index] = null;
  });
}

{
  const state = createGame();
  assert.deepEqual(
    state.bench.map((item) => item?.type ?? item?.kind ?? null),
    ['qiang', 'gong', 'dao', 'shovel', null],
    '开局应提供三张可作战字牌与一把可拖拽铲子',
  );
  assert.equal(state.phaseT, null, '首波应等玩家主动开战');
  advanceBattle(state, 30, cellXY);
  assert.equal(state.wave, 0, '待命期不应自动进入第一波');
}

{
  const state = createGame();
  state.title = false;
  state.phase = 'wave';
  state.wave = 1;
  state.grid[4][4].unit = { kind: 'troop', type: 'dao', level: 5, cd: 0 };
  state.enemies.push({
    type: 'normal', wave: 1, hp: 10, maxHp: 10,
    p: 14, speed: 1, stun: 0, bob: 0,
  });
  state.effects.push({ kind: 'dragon', p: 0, speed: 14, life: 5, t: 0, hit: new Set() });
  const before = {
    hp: state.enemies[0].hp,
    kills: state.stats.kills,
    mantou: state.mantou,
    dragonP: state.effects[0].p,
  };

  advanceBattle(state, 0, cellXY);

  assert.deepEqual({
    hp: state.enemies[0].hp,
    kills: state.stats.kills,
    mantou: state.mantou,
    dragonP: state.effects[0].p,
  }, before, '暂停时不应推进任何战斗状态');
}

{
  const state = createGame();
  state.title = false;
  deployStarterBench(state);
  state.phaseT = 0;

  let completed = 0;
  for (let elapsed = 0; elapsed < 240 && !state.over; elapsed += 0.025) {
    advanceBattle(state, 0.025, cellXY);
    if (state.phase === 'break' && state.wave > completed) {
      completed = state.wave;
      if (completed >= 5) break;
      state.phaseT = 0;
    }
  }
  if (state.win) completed = state.wave;

  assert.equal(completed, state.waveTarget, '起始编队应能稳定守过第一关');
  assert.ok(state.lives > 0, '第一关结算时阿斗必须存活');
}

console.log('✓ 首波主动开战');
console.log('✓ 暂停完全冻结战斗');
console.log('✓ 起始编队通过第一关');
