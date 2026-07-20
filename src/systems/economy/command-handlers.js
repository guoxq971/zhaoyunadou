import { eventsFor, randomFor } from '../../engine-core/public.js';
import { attemptBatchRecruit } from './recruitment.js';
import { applyUnitTransfer, detectHero, unlockHero } from './formation.js';

export function createEconomyCommandHandlers({ game, drag, gamePack, invalid, clearDrag }) {
  const stateNow = () => game.state;
  return {
    'battle.batch_recruit'(command) {
      const state = stateNow();
      if (state.title || state.over) return invalid(command, 'not-in-battle');
      return attemptBatchRecruit(state, randomFor(state, 'gameplay'), drag);
    },
    'unit.drop'(command) {
      const state = stateNow();
      const result = applyUnitTransfer(state, command.payload, gamePack, command.tick);
      clearDrag();
      if (!result.ok) return invalid(command, result.reason, 'unit-transfer');
      if (result.action === 'merge') {
        eventsFor(state)?.emit('merge', state, {
          result: 'success', reason: 'none', unitId: result.itemId,
          itemKind: result.itemKind, level: result.level,
          cell: result.target.zone === 'grid' ? { r: result.target.r, c: result.target.c } : null,
        });
      } else if (result.target.zone === 'grid') {
        eventsFor(state)?.emit('deploy', state, {
          result: 'success', reason: 'none', unitId: result.itemId,
          itemKind: result.itemKind, action: result.action,
          cell: { r: result.target.r, c: result.target.c }, source: result.source.zone,
        });
      }
      if (result.action === 'move') state.stats.moves = (state.stats.moves ?? 0) + 1;
      if (result.action === 'swap') state.stats.swaps = (state.stats.swaps ?? 0) + 1;
      const candidates = [];
      if (result.target.zone === 'grid') candidates.push(result.target);
      if (result.action === 'swap' && result.source.zone === 'grid') candidates.push(result.source);
      for (const cell of candidates) {
        const hero = detectHero(state.grid, cell.r, cell.c, gamePack);
        if (!hero) continue;
        unlockHero(state, hero, gamePack);
        result.heroUnlocked ??= hero.key;
        result.heroCell ??= { r: hero.r, c: hero.c };
      }
      return result;
    },
  };
}
