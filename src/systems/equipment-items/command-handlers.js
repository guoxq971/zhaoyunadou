import { gamePackFor } from '../../engine-core/public.js';
import { boardCellType } from '../board/index.js';
import { itemAtLocation, itemSignature, unlockHero } from '../economy/index.js';
import {
  commitShovelUse,
  consumeShovelFromBench,
  publishCommittedShovelUse,
  relocateShovel,
  useBrush,
} from './operations.js';

export function createEquipmentCommandHandlers({ game, drag, gamePack, invalid, clearDrag }) {
  const stateNow = () => game.state;
  return {
    'item.relocate'(command) {
      const result = relocateShovel(stateNow(), command.payload);
      clearDrag();
      return result.ok ? result : invalid(command, result.reason);
    },
    'item.use'(command) {
      const state = stateNow();
      const { itemId, target, source } = command.payload;
      if (target?.zone !== 'grid') {
        clearDrag();
        return invalid(command, 'invalid-target', itemId);
      }
      if (itemId === 'brush') {
        const rewritten = useBrush(state, target.r, target.c, command.tick, gamePackFor(state, gamePack));
        if (!rewritten) return invalid(command, 'invalid-brush-target', 'brush');
        drag.mode = null;
        if (rewritten.hero) unlockHero(state, rewritten.hero, gamePack);
        return {
          ok: true, reason: 'none', action: 'use', itemId,
          target, char: rewritten.char, heroUnlocked: rewritten.hero?.key ?? null,
        };
      }
      if (itemId !== 'shovel') return invalid(command, 'unknown-item');
      const slot = source?.zone === 'bench'
        ? Number(source.index)
        : state.bench.findIndex((entry) => entry?.kind === 'shovel');
      const shovel = itemAtLocation(state, { zone: 'bench', index: slot });
      if (shovel?.kind !== 'shovel') {
        clearDrag();
        return invalid(command, 'tool-unavailable', 'shovel');
      }
      if (command.payload.expectedSource && command.payload.expectedSource !== itemSignature(shovel)) {
        clearDrag();
        return invalid(command, 'source-changed', 'shovel');
      }
      const committed = commitShovelUse(state, target.r, target.c, command.tick);
      if (!committed.ok) {
        clearDrag();
        return invalid(command, boardCellType(state, target.r, target.c) === null
          ? 'invalid-target'
          : 'target-not-locked', 'shovel');
      }
      const consumed = consumeShovelFromBench(state, slot);
      if (!consumed.ok) throw new Error('[equipment-items] validated shovel disappeared during atomic command');
      const usageSource = source?.zone === 'bench' ? 'bench' : 'shovel-mode';
      publishCommittedShovelUse(state, committed, usageSource);
      clearDrag();
      return { ok: true, reason: 'none', action: 'use', itemId, target, source: usageSource };
    },
  };
}
