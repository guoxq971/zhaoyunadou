import assert from 'node:assert/strict';
import { createGame } from '../src/state.js';
import {
  insertGeneratedShovel,
  relocateShovel,
  updateLuoyangShovel,
  useBrush,
  useShovel,
} from '../src/systems/equipment-items/index.js';

{
  const state = createGame();
  const locked = state.grid.flatMap((row, r) => row.map((cell, c) => ({ cell, r, c })))
    .find(({ cell }) => cell.type === 'locked');
  assert.equal(useShovel(state, locked.r, locked.c), true);
  assert.equal(locked.cell.type, 'open');
  assert.equal(state.shovels, 0);
  assert.equal(state.stats.shovelsUsed, 1);
  assert.equal(useShovel(state, locked.r, locked.c), false, '已开放地块不得重复消耗');
}

{
  const state = createGame();
  state.grid[4][2].unit = state.bench[0];
  state.bench[0] = null;
  const result = useBrush(state, 4, 2);
  assert.equal(result.char, '赵');
  assert.equal(state.grid[4][2].unit.kind, 'frag');
  assert.equal(state.brushes, 0);
}

{
  const state = createGame();
  state.bench[0] = null;
  const generated = insertGeneratedShovel(state);
  assert.equal(generated.ok, true);
  assert.equal(state.bench[generated.slot].kind, 'shovel');
  const empty = state.bench.findIndex((entry) => entry === null);
  assert.equal(relocateShovel(state, {
    source: { zone: 'bench', index: generated.slot },
    target: { zone: 'bench', index: empty },
  }).ok, true);
  assert.equal(state.bench[empty].kind, 'shovel');
}

{
  const state = createGame();
  assert.equal(updateLuoyangShovel(state, 59.9), null);
  assert.equal(updateLuoyangShovel(state, 0.1).ok, true);
  assert.equal(state.stats.luoyangGenerated, 1);
}

console.log('✓ 道具系统铲地、改字、营栏窄口与洛阳铲生产');
