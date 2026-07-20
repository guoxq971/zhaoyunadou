export const ECONOMY_FORMATION_API_VERSION = '1.0.0';

export { createEconomyCommandHandlers } from './command-handlers.js';

export {
  canMerge,
  detectHero,
  ownedFragChars,
  recruitCost,
  rollGacha,
} from './rules.js';
export {
  attemptBatchRecruit,
  attemptRecruit,
  canStartDrag,
  restoreDrag,
} from './recruitment.js';
export {
  applyUnitTransfer,
  classifyUnitTransfer,
  isMovableUnit,
  itemAtLocation,
  itemSignature,
  insertBenchPiece,
  relocateBenchPiece,
  removeBenchPiece,
  unlockHero,
} from './formation.js';

// 奖励只由 Economy 写入资源切片；Combat/Encounter 只发布领域事实。
export function consumeEconomyDomainEvents(state, events, gamePack) {
  let consumed = 0;
  for (const event of events ?? []) {
    if (event.type === 'combat.enemy_defeated') {
      const reward = gamePack.config.waves.killReward(event.payload.wave);
      state.mantou += reward;
      publishDomainEventFor(state, {
        type: 'economy.reward_granted', source: 'economy-formation', tick: event.tick,
        payload: { amount: reward, reason: 'enemy-defeated', sourceEventSequence: event.sequence },
      });
      consumed++;
    } else if (event.type === 'encounter.wave_completed') {
      state.mantou += event.payload.reward;
      publishDomainEventFor(state, {
        type: 'economy.reward_granted', source: 'economy-formation', tick: event.tick,
        payload: {
          amount: event.payload.reward, reason: 'wave-completed',
          sourceEventSequence: event.sequence,
        },
      });
      consumed++;
    }
  }
  return consumed;
}

import { getStateSlice, publishDomainEventFor } from '../../engine-core/public.js';

export function updateProducerIncome(state, dt, cellXY, config) {
  const economy = getStateSlice(state, 'economy');
  economy.producerCooldowns ??= {};
  const gains = [];
  for (let row = 0; row < state.grid.length; row++) {
    for (let column = 0; column < state.grid[row].length; column++) {
      const piece = state.grid[row][column].unit;
      if (piece?.kind !== 'troop') continue;
      const rules = config.troops[piece.type];
      if (rules?.behaviorId !== 'unit.producer') continue;
      const id = piece.pieceId ?? `legacy-producer-${row}-${column}`;
      const remaining = (economy.producerCooldowns[id] ?? piece.cd ?? rules.interval) - dt;
      economy.producerCooldowns[id] = remaining;
      if (remaining > 0) continue;
      economy.producerCooldowns[id] = rules.interval;
      const amount = rules.produce * (piece.level ?? 1);
      state.mantou += amount;
      gains.push({ pieceId: id, amount, ...cellXY(row, column) });
    }
  }
  return gains;
}

export function snapshotEconomyRuntimeState(state) {
  const economy = getStateSlice(state, 'economy');
  return {
    producerCooldowns: Object.fromEntries(Object.entries(economy.producerCooldowns ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => [id, Number(value.toFixed(6))])),
  };
}
