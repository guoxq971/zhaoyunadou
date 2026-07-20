import { attemptBatchRecruit } from '../../actions.js';
import { eventsFor, randomFor, registryFor } from '../../engine-core/runtime-context.js';
import { detectHero, unlockHero } from '../../logic.js';
import { ITEM_REGISTRY } from './item-registry.js';
import {
  applyUnitTransfer,
  itemAtLocation,
  itemSignature,
  isMovableUnit,
} from './unit-placement.js';

export const PLAYER_COMMAND_TYPES = Object.freeze([
  'campaign.select_stage',
  'campaign.start_stage',
  'campaign.reset_progress',
  'battle.batch_recruit',
  'battle.start_wave',
  'battle.set_paused',
  'battle.set_speed',
  'interaction.drag_begin',
  'interaction.drag_cancel',
  'unit.drop',
  'item.relocate',
  'item.select_mode',
  'item.use',
  'result.resolve',
  'battle.retry',
  'session.quit',
]);

export function resetInteractionState(drag) {
  Object.assign(drag, {
    item: null, x: 0, y: 0, mode: null,
    source: null, expectedSource: null,
    from: null, index: null, r: null, c: null,
    hover: null,
    lastCommand: null,
    lastRecruitBatch: null,
  });
}

function sourceFields(location) {
  return location?.zone === 'bench'
    ? { from: 'bench', index: location.index, r: null, c: null }
    : { from: 'board', index: null, r: location?.r, c: location?.c };
}

export function createMergeDefenseCommandHandlers({ game, drag, gamePack }) {
  const items = gamePack.manifests.balance.items;
  const stateNow = () => game.state;
  const events = () => eventsFor(stateNow());
  const invalid = (command, reason, actionId = command.type) => {
    events()?.emit('invalid_action', stateNow(), {
      result: 'failure', reason, actionId,
    });
    return { ok: false, reason };
  };
  const clearDrag = () => resetInteractionState(drag);

  const handlers = {
    'campaign.select_stage'(command) {
      const index = Number(command.payload.stageIndex);
      if (!stateNow().title) return invalid(command, 'not-on-title', 'select-stage');
      if (!Number.isInteger(index) || index < 0) return invalid(command, 'invalid-stage', 'select-stage');
      if (index > game.highestUnlockedStageIndex) return invalid(command, 'stage-locked', 'select-stage');
      game.selectStage(index);
      return { ok: true, reason: 'none' };
    },
    'campaign.start_stage'(command) {
      if (!stateNow().title) return invalid(command, 'not-on-title');
      if (command.payload.stageIndex !== undefined) {
        const index = Number(command.payload.stageIndex);
        if (!Number.isInteger(index) || index < 0) return invalid(command, 'invalid-stage', 'start-stage');
        if (index > game.highestUnlockedStageIndex) return invalid(command, 'stage-locked', 'start-stage');
        game.selectStage(index);
      }
      game.startCurrentStage();
      return { ok: true, reason: 'none', stageIndex: stateNow().stageIndex };
    },
    'campaign.reset_progress'(command) {
      if (!stateNow().title) {
        return { ...invalid(command, 'not-on-title', 'reset-progress'), action: 'ignored' };
      }
      if (command.payload.action === 'cancel') {
        game.cancelProgressReset();
        return { ok: true, reason: 'none', action: 'cancel' };
      }
      const action = game.requestProgressReset();
      return { ok: true, reason: 'none', action };
    },
    'battle.batch_recruit'(command) {
      if (stateNow().title || stateNow().over) return invalid(command, 'not-in-battle');
      return attemptBatchRecruit(stateNow(), randomFor(stateNow(), 'gameplay'), drag);
    },
    'battle.start_wave'(command) {
      const state = stateNow();
      if (state.title || state.over || state.phase !== 'break') return invalid(command, 'wave-not-ready');
      state.phaseT = 0;
      return { ok: true, reason: 'none', wave: state.wave + 1 };
    },
    'battle.set_paused'(command) {
      const state = stateNow();
      if (state.title || state.over) return invalid(command, 'not-in-battle');
      const paused = Boolean(command.payload.paused);
      if (paused) {
        if (state.speed !== 0) state.resumeSpeed = state.speed;
        state.speed = 0;
      } else state.speed = state.resumeSpeed || 1;
      return { ok: true, reason: 'none', paused, speed: state.speed };
    },
    'battle.set_speed'(command) {
      const state = stateNow();
      const speed = Number(command.payload.speed);
      if (state.title || state.over) return invalid(command, 'not-in-battle');
      if (![0, 1, 2].includes(speed)) return invalid(command, 'invalid-speed');
      if (speed !== 0) state.resumeSpeed = speed;
      state.speed = speed;
      return { ok: true, reason: 'none', speed };
    },
    'interaction.drag_begin'(command) {
      if (drag.item) return invalid(command, 'drag-active');
      const item = itemAtLocation(stateNow(), command.payload.source);
      const benchShovel = command.payload.source?.zone === 'bench' && item?.kind === 'shovel';
      if (!item) return invalid(command, 'source-empty');
      if (!isMovableUnit(item) && !benchShovel) return invalid(command, 'source-not-movable');
      drag.item = item;
      drag.source = command.payload.source;
      drag.expectedSource = itemSignature(item);
      Object.assign(drag, sourceFields(command.payload.source));
      return { ok: true, reason: 'none', source: command.payload.source, itemKind: item.kind };
    },
    'interaction.drag_cancel'() {
      const active = Boolean(drag.item);
      clearDrag();
      return { ok: true, reason: 'none', active };
    },
    'unit.drop'(command) {
      const state = stateNow();
      const result = applyUnitTransfer(state, command.payload, gamePack, command.tick);
      clearDrag();
      if (!result.ok) return invalid(command, result.reason, 'unit-transfer');
      if (result.action === 'merge') {
        events()?.emit('merge', state, {
          result: 'success', reason: 'none', unitId: result.itemId,
          itemKind: result.itemKind, level: result.level,
          cell: result.target.zone === 'grid' ? { r: result.target.r, c: result.target.c } : null,
        });
      } else if (result.target.zone === 'grid') {
        events()?.emit('deploy', state, {
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
    'item.relocate'(command) {
      const state = stateNow();
      const source = command.payload.source;
      const target = command.payload.target;
      const item = itemAtLocation(state, source);
      const occupied = itemAtLocation(state, target);
      const targetIndex = Number(target?.index);
      const validTarget = target?.zone === 'bench'
        && Number.isInteger(targetIndex)
        && targetIndex >= 0
        && targetIndex < state.bench.length;
      let result;
      if (source?.zone !== 'bench' || item?.kind !== 'shovel') result = invalid(command, 'source-not-movable');
      else if (!validTarget) result = invalid(command, 'invalid-target');
      else if (source.index === target.index) result = invalid(command, 'same-location');
      else if (occupied) result = invalid(command, 'target-not-empty');
      else if (command.payload.expectedSource !== itemSignature(item)) result = invalid(command, 'source-changed');
      else {
        state.bench[targetIndex] = item;
        state.bench[source.index] = null;
        result = {
          ok: true, reason: 'none', action: 'move', itemId: 'shovel', source,
          target: { zone: 'bench', index: targetIndex },
        };
      }
      clearDrag();
      return result;
    },
    'item.select_mode'(command) {
      const state = stateNow();
      const itemId = command.payload.itemId ?? null;
      if (itemId === null) {
        drag.mode = null;
        return { ok: true, reason: 'none', itemId: null };
      }
      if (itemId === 'brush' && state.brushes <= 0) return invalid(command, 'tool-unavailable');
      if (itemId === 'shovel' && state.shovels <= 0) return invalid(command, 'tool-unavailable');
      if (!['brush', 'shovel'].includes(itemId)) return invalid(command, 'unknown-item');
      drag.mode = drag.mode === itemId ? null : itemId;
      return { ok: true, reason: 'none', itemId: drag.mode };
    },
    'item.use'(command) {
      const state = stateNow();
      const { itemId, target, source } = command.payload;
      if (target?.zone !== 'grid') {
        clearDrag();
        return invalid(command, 'invalid-target', itemId);
      }
      const registry = registryFor(state, 'items', ITEM_REGISTRY);
      if (itemId === 'brush') {
        const rewritten = registry.get(items.brush.behaviorId).use(state, target.r, target.c);
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
        ? source.index
        : state.bench.findIndex((entry) => entry?.kind === 'shovel');
      const shovel = state.bench[slot];
      if (shovel?.kind !== 'shovel') {
        clearDrag();
        return invalid(command, 'tool-unavailable', 'shovel');
      }
      if (command.payload.expectedSource && command.payload.expectedSource !== itemSignature(shovel)) {
        clearDrag();
        return invalid(command, 'source-changed', 'shovel');
      }
      const used = registry.get(items.shovel.behaviorId).use(state, target.r, target.c);
      if (!used) {
        clearDrag();
        return invalid(command, state.grid[target.r]?.[target.c] ? 'target-not-locked' : 'invalid-target', 'shovel');
      }
      state.bench[slot] = null;
      events()?.emit('deploy', state, {
        result: 'success', reason: 'none', unitId: 'shovel',
        cell: { r: target.r, c: target.c }, source: source ? 'bench' : 'shovel-mode',
      });
      clearDrag();
      return { ok: true, reason: 'none', action: 'use', itemId, target };
    },
    'result.resolve'(command) {
      if (!stateNow().over) return invalid(command, 'result-not-ready');
      game.resolveResult();
      return { ok: true, reason: 'none', stageIndex: stateNow().stageIndex, title: stateNow().title };
    },
    'battle.retry'(command) {
      if (!stateNow().over) return invalid(command, 'result-not-ready');
      game.restart();
      return { ok: true, reason: 'none', stageIndex: stateNow().stageIndex };
    },
    'session.quit'(command) {
      if (stateNow().title) return invalid(command, 'not-in-battle');
      game.quitToTitle(command.payload.reason ?? 'player-quit');
      return { ok: true, reason: 'none', title: true };
    },
  };
  return handlers;
}
