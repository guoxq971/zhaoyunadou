import assert from 'node:assert/strict';
import { attemptRecruit } from '../src/actions.js';
import { createRandomStreams } from '../src/engine-core/random.js';
import { randomFor } from '../src/engine-core/runtime-context.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGameRuntime } from '../src/runtime.js';
import { createGame } from '../src/state.js';
import { enemyGameplayXY, enemyXY } from '../src/enemies.js';
import { findTarget } from '../src/units.js';
import { cellXY } from '../src/ui-layout.js';

function run(seed, consumePresentation = false) {
  const random = createRandomStreams(seed);
  const runtime = createGameRuntime(DEFAULT_GAME_PACK, { random });
  const state = createGame(0, 0, DEFAULT_GAME_PACK, runtime);
  state.recruitQueue = [];
  state.bench.fill(null);
  state.mantou = 100_000;
  const recruited = [];
  for (let index = 0; index < 12; index++) {
    if (consumePresentation) {
      randomFor(state, 'presentation')();
      randomFor(state, 'presentation')();
    }
    const result = attemptRecruit(state, randomFor(state, 'gameplay'));
    recruited.push(result.got.type ?? result.got.char ?? result.got.kind);
    state.bench[result.slot] = null;
  }
  return {
    recruited,
    mantou: state.mantou,
    recruits: state.stats.recruits,
    recruitCount: state.recruitCount,
  };
}

assert.deepEqual(run('same-seed'), run('same-seed'));
assert.deepEqual(run('same-seed'), run('same-seed', true), '表现随机消耗不得改变玩法随机序列');
assert.notDeepEqual(run('same-seed'), run('other-seed'));

{
  const original = createRandomStreams('replay-seed');
  original.gameplay();
  original.gameplay();
  original.presentation();
  const snapshot = original.snapshot();
  const expected = [original.gameplay(), original.presentation(), original.gameplay()];
  const restored = createRandomStreams('replay-seed', snapshot);
  assert.deepEqual(
    [restored.gameplay(), restored.presentation(), restored.gameplay()],
    expected,
    '随机流快照必须恢复两个独立游标，支持同命令日志继续回放',
  );
  assert.throws(() => createRandomStreams('other-seed', snapshot), /incompatible streams snapshot/);
}

{
  const state = createGame();
  const enemy = {
    type: 'normal', lane: 0, wave: 1, hp: 10, maxHp: 10,
    p: 0, speed: 0, stun: 0, bob: 0,
  };
  state.enemies = [enemy];
  const gameplay = enemyGameplayXY(state, enemy, cellXY);
  assert.deepEqual(enemyXY(state, enemy, cellXY), gameplay);
  assert.equal(findTarget(state, gameplay.x, gameplay.y, 0, cellXY)?.e, enemy);
  enemy.bob = Math.PI / 2;
  assert.notDeepEqual(enemyXY(state, enemy, cellXY), gameplay, '浮动仍应保留在敌军演出坐标');
  assert.deepEqual(enemyGameplayXY(state, enemy, cellXY), gameplay, '浮动不得改变玩法坐标');
  assert.equal(findTarget(state, gameplay.x, gameplay.y, 0, cellXY)?.e, enemy,
    '仅消耗表现随机不得改变射程命中');
}

console.log('✓ 相同 seed 可回放，玩法与表现随机流分离');
