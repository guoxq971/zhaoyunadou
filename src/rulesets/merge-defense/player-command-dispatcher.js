import { composeCommandHandlerMaps, eventsFor } from '../../engine-core/public.js';
import {
  createEconomyCommandHandlers,
  itemAtLocation,
  itemSignature,
  isMovableUnit,
} from '../../systems/economy/index.js';
import { createEquipmentCommandHandlers } from '../../systems/equipment-items/index.js';
import { createStageEncounterCommandHandlers } from '../../systems/stage-encounter/index.js';

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
  return composeCommandHandlerMaps([
    { systemId: 'match-controller', handlers },
    {
      systemId: 'economy-formation',
      handlers: createEconomyCommandHandlers({ game, drag, gamePack, invalid, clearDrag }),
    },
    {
      systemId: 'equipment-items',
      handlers: createEquipmentCommandHandlers({ game, drag, gamePack, invalid, clearDrag }),
    },
    {
      systemId: 'stage-encounter',
      handlers: createStageEncounterCommandHandlers({ getState: stateNow, invalid }),
    },
  ]);
}
