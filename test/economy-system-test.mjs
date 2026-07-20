import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGame } from '../src/state.js';
import {
  attemptRecruit,
  consumeEconomyDomainEvents,
  createEconomyCommandHandlers,
  updateProducerIncome,
} from '../src/systems/economy/index.js';
import { cellXY } from '../src/ui-layout.js';

{
  const state = createGame();
  const before = state.mantou;
  const consumed = consumeEconomyDomainEvents(state, [
    { type: 'combat.enemy_defeated', tick: 1, sequence: 1, payload: { wave: 5 } },
    { type: 'encounter.wave_completed', tick: 1, sequence: 2, payload: { reward: 18 } },
  ], DEFAULT_GAME_PACK);
  assert.equal(consumed, 2);
  assert.equal(state.mantou, before + 3 + 18, '击杀/波次奖励必须各结算一次');
}

{
  const state = createGame();
  state.recruitQueue = [];
  const recruitedItems = [];
  const beforeShovels = state.shovels;
  const result = attemptRecruit(state, () => 0.9999, null, {
    onItemRecruited: (current, piece) => recruitedItems.push({ current, piece }),
  });
  assert.equal(result.got.kind, 'shovel');
  assert.equal(state.shovels, beforeShovels,
    'Economy 不得直写 Equipment 切片，由装配层注入窄口');
  assert.equal(recruitedItems.length, 1);
  assert.equal(recruitedItems[0].current, state);
  assert.equal(recruitedItems[0].piece, result.got);
}

{
  const state = createGame();
  const open = state.grid.flatMap((row) => row).find((cell) => cell.type === 'open');
  open.unit = { kind: 'troop', type: 'nong', level: 3, cd: 0 };
  const before = state.mantou;
  const gains = updateProducerIncome(state, 0.1, cellXY, DEFAULT_GAME_PACK.config);
  assert.equal(gains.length, 1);
  assert.equal(gains[0].amount, 6);
  assert.equal(state.mantou, before + 6);
  assert.equal(updateProducerIncome(state, 0.1, cellXY, DEFAULT_GAME_PACK.config).length, 0,
    '农民产出冷却位于 Economy 切片，不得每 tick 重复发放');
}

{
  const game = { state: createGame() };
  game.state.title = false;
  const drag = {};
  const handlers = createEconomyCommandHandlers({
    game,
    drag,
    gamePack: DEFAULT_GAME_PACK,
    invalid: (_command, reason) => ({ ok: false, reason }),
    clearDrag: () => {},
    onItemRecruited: () => {},
  });
  assert.deepEqual(Object.keys(handlers).sort(), ['battle.batch_recruit', 'unit.drop']);
  const recruited = handlers['battle.batch_recruit']({ type: 'battle.batch_recruit', tick: 0, payload: {} });
  assert.equal(recruited.ok, true);
  assert.equal(recruited.filledCount, 1);
}

console.log('✓ Economy/Formation 命令归属、资源奖励与生产冷却');
