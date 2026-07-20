import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/state.js';
import {
  addGlobalModifier,
  resolveStat,
  troopDamage,
} from '../src/systems/attribute/index.js';

assert.equal(troopDamage(CONFIG.troops.dao.dmg, 1, CONFIG.levelMult), 6);
assert.equal(troopDamage(CONFIG.troops.dao.dmg, 2, CONFIG.levelMult), Math.round(6 * 2.2));
assert.equal(resolveStat(10, 'damage', [
  { id: 'aura', stat: 'damage', operation: 'multiply', value: 1.5, priority: 20 },
  { id: 'equipment', stat: 'damage', operation: 'add', value: 2, priority: 10 },
]), 18);

{
  const state = createGame();
  addGlobalModifier(state, {
    id: 'aura', stat: 'damage', operation: 'multiply', value: 1.5, priority: 20,
  });
  assert.equal(resolveStat(10, 'damage', undefined, state), 15);
  assert.throws(() => addGlobalModifier(state, {
    id: 'aura', stat: 'damage', operation: 'add', value: 1, priority: 10,
  }), /duplicate modifier.*aura/i);
}

console.log('✓ Attribute 基础成长、稳定 Modifier 与状态切片公共契约');
