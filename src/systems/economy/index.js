export const ECONOMY_FORMATION_API_VERSION = '1.0.0';

import { listBoardOccupants } from '../board/index.js';

export function createEconomyStateSlice({ config, stage } = {}) {
  if (!config?.heroes || !stage?.featuredHero) {
    throw new TypeError('[economy] config and active stage are required');
  }
  const featured = config.heroes[stage.featuredHero];
  if (!featured?.chars) throw new Error(`[economy] unknown featured hero "${stage.featuredHero}"`);
  return {
    mantou: config.startMantou,
    recruitCount: 0,
    recruitQueue: [...featured.chars],
    bench: Array.from({ length: config.benchSize }, (_, index) => {
      const type = config.starterUnits[index];
      if (type) return { kind: 'troop', type, level: 1 };
      if (index === config.starterUnits.length && config.startShovels > 0) return { kind: 'shovel' };
      return null;
    }),
    producerCooldowns: {},
    stats: { merges: 0, recruits: 0 },
  };
}

export { createEconomyCommandHandlers } from './command-handlers.js';

export {
  canMerge,
  detectHero,
  detectHeroOnBoard,
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
        payload: {
          amount: reward, reason: 'enemy-defeated', wave: event.payload.wave,
          sourceEventSequence: event.sequence,
        },
      });
      consumed++;
    } else if (event.type === 'encounter.wave_completed') {
      state.mantou += event.payload.reward;
      publishDomainEventFor(state, {
        type: 'economy.reward_granted', source: 'economy-formation', tick: event.tick,
        payload: {
          amount: event.payload.reward, reason: 'wave-completed',
          wave: event.payload.wave,
          sourceEventSequence: event.sequence,
        },
      });
      consumed++;
    }
  }
  return consumed;
}

import {
  compareCodePointStrings,
  getStateSlice,
  publishDomainEventFor,
} from '../../engine-core/public.js';

export function updateProducerIncome(state, dt, cellXY, config) {
  const economy = getStateSlice(state, 'economy');
  economy.producerCooldowns ??= {};
  const gains = [];
  for (const { row, column, piece } of listBoardOccupants(state, { kind: 'troop' })) {
      const rules = config.troops[piece.type];
      if (rules?.behaviorId !== 'unit.producer') continue;
      const id = piece.pieceId ?? `legacy-producer-${row}-${column}`;
      const remaining = (economy.producerCooldowns[id] ?? piece.cooldown ?? rules.interval) - dt;
      economy.producerCooldowns[id] = remaining;
      if (remaining > 0) continue;
      economy.producerCooldowns[id] = rules.interval;
      const amount = rules.produce * (piece.level ?? 1);
      state.mantou += amount;
      gains.push({ pieceId: id, amount, ...cellXY(row, column) });
  }
  return gains;
}

export function snapshotEconomyRuntimeState(state) {
  const economy = getStateSlice(state, 'economy');
  return {
    producerCooldowns: Object.fromEntries(Object.entries(economy.producerCooldowns ?? {})
      .sort(([left], [right]) => compareCodePointStrings(left, right))
      .map(([id, value]) => [id, Number(value.toFixed(6))])),
  };
}
