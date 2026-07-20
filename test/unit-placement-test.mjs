import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGame } from '../src/state.js';
import {
  applyUnitTransfer,
  itemSignature,
  isMovableUnit,
} from '../src/rulesets/merge-defense/unit-placement.js';

const bench = (index) => ({ zone: 'bench', index });
const grid = (r, c) => ({ zone: 'grid', r, c });
const transfer = (state, source, target) => applyUnitTransfer(state, {
  source,
  target,
  expectedSource: itemSignature(source.zone === 'bench'
    ? state.bench[source.index]
    : state.grid[source.r][source.c].unit),
}, DEFAULT_GAME_PACK);

assert.equal(isMovableUnit({ kind: 'troop', type: 'dao', level: 5 }), true);
assert.equal(isMovableUnit({ kind: 'frag', char: '赵', level: 3 }), true);
assert.equal(isMovableUnit({ kind: 'hero', key: 'zhaoyun' }), false);
assert.equal(isMovableUnit({ kind: 'shovel' }), false);

{
  const state = createGame();
  const first = state.bench[0];
  const second = state.bench[1];
  assert.equal(transfer(state, bench(0), bench(1)).action, 'swap');
  assert.equal(state.bench[0], second);
  assert.equal(state.bench[1], first);
  assert.equal(transfer(state, bench(1), bench(4)).action, 'move');
  assert.equal(state.bench[1], null);
  assert.equal(state.bench[4], first);
}

{
  const state = createGame();
  const source = state.bench[0];
  const target = state.bench[1];
  state.grid[4][2].unit = target;
  state.bench[1] = null;
  assert.equal(transfer(state, bench(0), grid(4, 2)).action, 'swap');
  assert.equal(state.grid[4][2].unit, source);
  assert.equal(state.bench[0], target, '棋盘原单位必须原子回到源营位');
  assert.equal(transfer(state, grid(4, 2), grid(4, 3)).action, 'move');
  assert.equal(state.grid[4][2].unit, null);
  assert.equal(state.grid[4][3].unit, source);
}

{
  const state = createGame();
  state.grid[4][2].unit = { kind: 'troop', type: 'qi', level: 2, marker: 'grid' };
  state.bench[4] = { kind: 'troop', type: 'gong', level: 3, marker: 'bench' };
  const gridItem = state.grid[4][2].unit;
  const benchItem = state.bench[4];
  assert.equal(transfer(state, grid(4, 2), bench(4)).action, 'swap');
  assert.equal(state.bench[4], gridItem);
  assert.equal(state.grid[4][2].unit, benchItem);
}

{
  const state = createGame();
  state.bench[0] = { kind: 'troop', type: 'dao', level: 1 };
  state.grid[4][2].unit = { kind: 'troop', type: 'dao', level: 1 };
  assert.equal(transfer(state, bench(0), grid(4, 2)).action, 'merge');
  assert.equal(state.bench[0], null);
  assert.equal(state.grid[4][2].unit.level, 2);
}

{
  const state = createGame();
  state.grid[4][2].unit = { kind: 'troop', type: 'dao', level: 1, marker: 'left' };
  state.grid[4][3].unit = { kind: 'troop', type: 'qi', level: 3, marker: 'right' };
  const before = [state.grid[4][2].unit, state.grid[4][3].unit];
  assert.equal(transfer(state, grid(4, 2), grid(4, 3)).action, 'swap');
  assert.equal(state.grid[4][2].unit, before[1]);
  assert.equal(state.grid[4][3].unit, before[0]);
  assert.equal(state.grid[4][2].unit.level, 3, '升级单位交换后等级不得丢失');
}

{
  const state = createGame();
  state.grid[4][2].unit = { kind: 'troop', type: 'dao', level: 1, marker: 'a' };
  state.grid[4][3].unit = { kind: 'troop', type: 'dao', level: 1, marker: 'b' };
  const result = transfer(state, grid(4, 2), grid(4, 3));
  assert.equal(result.action, 'merge');
  assert.equal(state.grid[4][2].unit, null);
  assert.equal(state.grid[4][3].unit.level, 2);
  assert.equal(state.stats.merges, 1);
  assert.equal(transfer(state, grid(4, 3), grid(4, 4)).action, 'move', '合成后的单位必须仍可移动');
  assert.equal(state.grid[4][4].unit.level, 2);
}

{
  const state = createGame();
  state.grid[4][2].unit = state.bench[0];
  state.bench[0] = null;
  const before = JSON.stringify({ bench: state.bench, grid: state.grid });
  assert.deepEqual(transfer(state, grid(4, 2), grid(0, 7)), {
    ok: false,
    reason: 'target-not-open',
  });
  assert.equal(JSON.stringify({ bench: state.bench, grid: state.grid }), before, '非法目标必须完整回滚');

  state.grid[4][3].unit = { kind: 'hero', key: 'zhaoyun', part: 0, level: 1 };
  const heroBefore = JSON.stringify({ bench: state.bench, grid: state.grid });
  assert.deepEqual(transfer(state, grid(4, 2), grid(4, 3)), {
    ok: false,
    reason: 'target-not-movable',
  });
  assert.equal(JSON.stringify({ bench: state.bench, grid: state.grid }), heroBefore);
}

{
  const state = createGame();
  state.grid[4][2].unit = { kind: 'troop', type: 'dao', level: 4, marker: 'a' };
  state.grid[4][3].unit = { kind: 'troop', type: 'qi', level: 2, marker: 'b' };
  const initial = [state.grid[4][2].unit, state.grid[4][3].unit];
  for (let index = 0; index < 100; index++) {
    const result = transfer(state, grid(4, 2), grid(4, 3));
    assert.equal(result.action, 'swap');
  }
  assert.deepEqual([state.grid[4][2].unit, state.grid[4][3].unit], initial, '连续交换不得丢失或复制单位');
}

{
  const state = createGame();
  state.grid[4][2].unit = state.bench[0];
  state.bench[0] = null;
  const before = JSON.stringify({ bench: state.bench, grid: state.grid });
  const result = applyUnitTransfer(state, {
    source: grid(4, 2),
    target: grid(4, 3),
    expectedSource: 'troop:qiang:99',
  }, DEFAULT_GAME_PACK);
  assert.deepEqual(result, { ok: false, reason: 'source-changed' });
  assert.equal(JSON.stringify({ bench: state.bench, grid: state.grid }), before);
}

console.log('✓ 营栏/棋盘移动、原子交换、合成后移动与非法回滚');
