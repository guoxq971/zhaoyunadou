import { CONTROLLER_API_VERSION } from '../engine-core/controller.js';
import { createCommandFactory } from '../engine-core/game-command.js';
import { subscribeGameCommands } from '../engine-core/game-command-source.js';
import { canMerge } from '../logic.js';
import { B, UI, benchRect, boardCell, cellXY, inRect, titleStageRect } from '../ui-layout.js';

function pointerLocation(x, y, benchSize) {
  const cell = boardCell(x, y);
  if (cell) return { zone: 'grid', r: cell.r, c: cell.c };
  for (let index = 0; index < benchSize; index++) {
    if (inRect(x, y, benchRect(index))) return { zone: 'bench', index };
  }
  return { zone: 'outside' };
}

function keyboardDropTarget(state, item, gamePack) {
  if (item.kind === 'shovel') {
    for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
      if (state.grid[r][c].type === 'locked') return { zone: 'grid', r, c };
    }
    return null;
  }
  let empty = null;
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const cell = state.grid[r][c];
      if (cell.type !== 'open') continue;
      if (cell.unit && canMerge(cell.unit, item, gamePack)) return { zone: 'grid', r, c };
      if (!cell.unit && !empty) empty = { zone: 'grid', r, c };
    }
  }
  return empty;
}

export function createLocalPlayerController({
  inputSource,
  surface,
  game,
  drag,
  gamePack,
  dispatch,
  present = () => {},
  getTick = () => 0,
  onGesture = () => {},
  actorId = 'local-player',
  side = 'player',
}) {
  const config = gamePack.config;
  const commandFactory = createCommandFactory({
    actorId, side, getTick, getTime: () => game.state.time,
  });
  let activePointerId = null;
  let unsubscribe = null;
  let destroyed = false;

  function submit(type, payload = {}) {
    if (destroyed) return { ok: false, reason: 'controller-destroyed' };
    const command = commandFactory.create(type, payload);
    const result = dispatch(command);
    present(command, result);
    return result;
  }

  function beginDrag(source, x, y) {
    const result = submit('interaction.drag_begin', { source });
    if (result.ok) {
      drag.x = x;
      drag.y = y;
      drag.hover = source;
    }
    return result;
  }

  function handleDown(command) {
    const state = game.state;
    const { x, y } = command;
    surface.focus();

    if (state.title) {
      for (let index = 0; index < config.campaign.stages.length; index++) {
        if (inRect(x, y, titleStageRect(index))) return submit('campaign.select_stage', { stageIndex: index }).ok;
      }
      if (inRect(x, y, UI.resetProgress)) return submit('campaign.reset_progress', { action: 'request' }).ok;
      if (inRect(x, y, UI.start)) return submit('campaign.start_stage', { stageIndex: state.stageIndex }).ok;
      return false;
    }
    if (state.over) {
      if (!inRect(x, y, UI.restart)) return false;
      return submit(state.win ? 'result.resolve' : 'battle.retry').ok;
    }
    if (inRect(x, y, UI.pause)) return submit('battle.set_paused', { paused: state.speed !== 0 }).ok;
    if (state.phase === 'break' && inRect(x, y, UI.callWave)) return submit('battle.start_wave').ok;
    if (inRect(x, y, UI.speed)) {
      const speed = state.speed === 1 ? 2 : state.speed === 2 ? 0 : 1;
      return submit('battle.set_speed', { speed }).ok;
    }
    if (inRect(x, y, UI.shovel)) return submit('item.select_mode', { itemId: 'brush' }).ok;
    if (inRect(x, y, UI.recruit)) {
      drag.mode = null;
      return submit('battle.batch_recruit').ok;
    }

    const location = pointerLocation(x, y, config.benchSize);
    if (drag.mode === 'brush') return submit('item.use', { itemId: 'brush', target: location }).ok;
    if (drag.mode === 'shovel') return submit('item.use', { itemId: 'shovel', target: location }).ok;
    if (location.zone === 'bench') return beginDrag(location, x, y).ok;
    if (location.zone === 'grid') return beginDrag(location, x, y).ok;
    return false;
  }

  function handleDrop(command) {
    if (!drag.item) return false;
    const source = drag.source;
    const expectedSource = drag.expectedSource;
    const target = pointerLocation(command.x, command.y, config.benchSize);
    if (drag.item.kind === 'shovel') {
      if (target.zone === 'grid') {
        return submit('item.use', { itemId: 'shovel', source, target, expectedSource }).ok;
      }
      return submit('item.relocate', { source, target, expectedSource }).ok;
    }
    return submit('unit.drop', { source, target, expectedSource }).ok;
  }

  function handleKey(command) {
    if (command.repeat || command.metaKey || command.ctrlKey || command.altKey) return false;
    const state = game.state;
    const code = command.code;
    if (code === 'Enter' || code === 'Space') {
      if (drag.mode === 'brush') {
        for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
          if (['troop', 'frag'].includes(state.grid[r][c].unit?.kind)) {
            return submit('item.use', { itemId: 'brush', target: { zone: 'grid', r, c } }).ok;
          }
        }
        return false;
      }
      if (drag.item) {
        const target = keyboardDropTarget(state, drag.item, gamePack);
        if (!target) return false;
        if (drag.item.kind === 'shovel') {
          return submit('item.use', {
            itemId: 'shovel', source: drag.source, target, expectedSource: drag.expectedSource,
          }).ok;
        }
        return submit('unit.drop', {
          source: drag.source, target, expectedSource: drag.expectedSource,
        }).ok;
      }
      if (state.title) return submit('campaign.start_stage', { stageIndex: state.stageIndex }).ok;
      if (state.over) return submit(state.win ? 'result.resolve' : 'battle.retry').ok;
      if (state.phase === 'break') return submit('battle.start_wave').ok;
      return false;
    }
    if (/^Digit[1-5]$/.test(code) && state.title) {
      return submit('campaign.select_stage', { stageIndex: Number(code.slice(-1)) - 1 }).ok;
    }
    if (code === 'KeyR' && state.title) return submit('campaign.reset_progress', { action: 'request' }).ok;
    if (code === 'Escape' && state.title) return submit('campaign.reset_progress', { action: 'cancel' }).ok;
    if (code === 'KeyP' && !state.title && !state.over) {
      return submit('battle.set_paused', { paused: state.speed !== 0 }).ok;
    }
    if (code === 'KeyR' && !state.title && !state.over) {
      drag.mode = null;
      return submit('battle.batch_recruit').ok;
    }
    if (code === 'KeyB' && !state.title && !state.over) return submit('item.select_mode', { itemId: 'brush' }).ok;
    if (code === 'KeyX' && !state.title && !state.over) return submit('item.select_mode', { itemId: 'shovel' }).ok;
    if (code === 'Escape' && !state.title && !state.over) return submit('session.quit', { reason: 'keyboard-escape' }).ok;
    if (/^Digit[1-5]$/.test(code) && !state.title && !state.over && !drag.item) {
      const index = Number(code.slice(-1)) - 1;
      const rect = benchRect(index);
      return beginDrag({ zone: 'bench', index }, rect.x + rect.w / 2, rect.y + rect.h / 2).ok;
    }
    return false;
  }

  function onInput(command) {
    if (command.type === 'pointer.begin') {
      if (!command.primary || activePointerId !== null
        || (command.button !== undefined && command.button !== 0)) return false;
      activePointerId = command.pointerId;
      onGesture();
      return handleDown(command);
    }
    if (command.type === 'pointer.move') {
      if (activePointerId === null || command.pointerId !== activePointerId || !drag.item) return false;
      drag.x = command.x;
      drag.y = command.y;
      drag.hover = pointerLocation(command.x, command.y, config.benchSize);
      return true;
    }
    if (command.type === 'pointer.end') {
      if (activePointerId === null || command.pointerId !== activePointerId) return false;
      const handled = handleDrop(command);
      activePointerId = null;
      return handled;
    }
    if (command.type === 'pointer.cancel') {
      if (activePointerId === null) return false;
      if (command.pointerId !== null && command.pointerId !== activePointerId) return false;
      activePointerId = null;
      return submit('interaction.drag_cancel', { reason: command.reason }).ok;
    }
    if (command.type === 'key.press') {
      onGesture();
      return handleKey(command);
    }
    return false;
  }

  function start() {
    if (destroyed || unsubscribe) return false;
    unsubscribe = subscribeGameCommands(inputSource, onInput);
    return true;
  }

  function destroy() {
    if (destroyed) return false;
    activePointerId = null;
    if (drag.item) submit('interaction.drag_cancel', { reason: 'controller-destroy' });
    unsubscribe?.();
    unsubscribe = null;
    destroyed = true;
    return true;
  }

  return Object.freeze({
    controllerApiVersion: CONTROLLER_API_VERSION,
    actorId,
    side,
    start,
    destroy,
    submit,
  });
}
