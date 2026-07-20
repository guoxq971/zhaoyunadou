import { randomFor } from '../../engine-core/public.js';
import { readPiece } from '../piece/index.js';
import { attemptBatchRecruit } from './recruitment.js';
import {
  applyUnitTransfer,
  detectHeroOnBoard,
  recordBoardTransfer,
  unlockHero,
} from './formation.js';

function commandRecruitResult(result) {
  if (!result?.got) return { ...result };
  return { ...result, got: { ...readPiece(result.got) } };
}

function commandBatchRecruitResult(result) {
  return {
    ...result,
    results: (result.results ?? []).map(commandRecruitResult),
  };
}

export function createEconomyCommandHandlers({
  game,
  gamePack,
  invalid,
  clearDrag,
  onItemRecruited = null,
}) {
  const stateNow = () => game.state;
  return {
    'battle.batch_recruit'(command) {
      const state = stateNow();
      if (state.title || state.over) return invalid(command, 'not-in-battle');
      const result = attemptBatchRecruit(
        state,
        randomFor(state, 'gameplay'),
        null,
        { onItemRecruited },
      );
      if (!result.ok) invalid(command, result.reason, 'batch-recruit');
      return commandBatchRecruitResult(result);
    },
    'unit.drop'(command) {
      const state = stateNow();
      const result = applyUnitTransfer(state, command.payload, gamePack, command.tick);
      clearDrag();
      if (!result.ok) return invalid(command, result.reason, 'unit-transfer');
      if (result.action === 'move' || result.action === 'swap') {
        recordBoardTransfer(state, result.action);
      }
      const candidates = [];
      if (result.target.zone === 'grid') candidates.push(result.target);
      if (result.action === 'swap' && result.source.zone === 'grid') candidates.push(result.source);
      for (const cell of candidates) {
        const hero = detectHeroOnBoard(state, cell.r, cell.c, gamePack);
        if (!hero) continue;
        unlockHero(state, hero, gamePack);
        result.heroUnlocked ??= hero.key;
        result.heroCell ??= { r: hero.r, c: hero.c };
      }
      return result;
    },
  };
}
