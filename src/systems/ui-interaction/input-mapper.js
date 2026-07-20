import { setInteractionMode, setPointerFeedback } from './interaction-state.js';

function pointerLocation(layout, x, y, benchSize) {
  const cell = layout.boardCell(x, y);
  if (cell) return { zone: 'grid', r: cell.r, c: cell.c };
  for (let index = 0; index < benchSize; index++) {
    if (layout.inRect(x, y, layout.benchRect(index))) return { zone: 'bench', index };
  }
  return { zone: 'outside' };
}

export function createLocalInputMapper({
  surface,
  layout,
  interaction,
  getViewModel,
  submit,
  queries = {},
  onGesture = () => {},
} = {}) {
  if (!layout || typeof layout.boardCell !== 'function') throw new TypeError('[ui-input] layout is required');
  if (!interaction || typeof interaction !== 'object') throw new TypeError('[ui-input] interaction is required');
  if (typeof getViewModel !== 'function') throw new TypeError('[ui-input] getViewModel is required');
  if (typeof submit !== 'function') throw new TypeError('[ui-input] submit is required');
  let activePointerId = null;

  const submitOk = (type, payload = {}) => Boolean(submit(type, payload)?.ok);

  function beginDrag(source, x, y) {
    const ok = submitOk('interaction.drag_begin', { source });
    if (ok) setPointerFeedback(interaction, { x, y, hover: source });
    return ok;
  }

  function handleDown(intent) {
    const view = getViewModel();
    const { x, y } = intent;
    surface?.focus?.();
    if (view.title) {
      for (let index = 0; index < view.stageCount; index++) {
        if (layout.inRect(x, y, layout.titleStageRect(index))) {
          return submitOk('campaign.select_stage', { stageIndex: index });
        }
      }
      if (layout.inRect(x, y, layout.ui.resetProgress)) {
        return submitOk('campaign.reset_progress', { action: 'request' });
      }
      if (layout.inRect(x, y, layout.ui.start)) {
        return submitOk('campaign.start_stage', { stageIndex: view.stageIndex });
      }
      return false;
    }
    if (view.over) {
      if (!layout.inRect(x, y, layout.ui.restart)) return false;
      return submitOk(view.win ? 'result.resolve' : 'battle.retry');
    }
    if (layout.inRect(x, y, layout.ui.pause)) {
      return submitOk('battle.set_paused', { paused: view.speed !== 0 });
    }
    if (view.phase === 'break' && layout.inRect(x, y, layout.ui.callWave)) {
      return submitOk('battle.start_wave');
    }
    if (layout.inRect(x, y, layout.ui.speed)) {
      const speed = view.speed === 1 ? 2 : view.speed === 2 ? 0 : 1;
      return submitOk('battle.set_speed', { speed });
    }
    if (layout.inRect(x, y, layout.ui.shovel)) {
      return submitOk('item.select_mode', { itemId: 'brush' });
    }
    if (layout.inRect(x, y, layout.ui.recruit)) {
      setInteractionMode(interaction, null);
      return submitOk('battle.batch_recruit');
    }

    const location = pointerLocation(layout, x, y, view.benchSize);
    if (interaction.mode === 'brush') return submitOk('item.use', { itemId: 'brush', target: location });
    if (interaction.mode === 'shovel') return submitOk('item.use', { itemId: 'shovel', target: location });
    if (location.zone === 'bench' || location.zone === 'grid') return beginDrag(location, x, y);
    return false;
  }

  function handleDrop(intent) {
    if (!interaction.item) return false;
    const source = interaction.source;
    const expectedSource = interaction.expectedSource;
    const target = pointerLocation(layout, intent.x, intent.y, getViewModel().benchSize);
    if (interaction.item.kind === 'shovel') {
      if (target.zone === 'grid') {
        return submitOk('item.use', { itemId: 'shovel', source, target, expectedSource });
      }
      return submitOk('item.relocate', { source, target, expectedSource });
    }
    return submitOk('unit.drop', { source, target, expectedSource });
  }

  function handleKey(intent) {
    if (intent.repeat || intent.metaKey || intent.ctrlKey || intent.altKey) return false;
    const view = getViewModel();
    const code = intent.code;
    const inBattle = !view.title && !view.over;
    if (code === 'Enter' || code === 'Space') {
      if (interaction.mode === 'brush') {
        const target = queries.findBrushTarget?.(view, interaction) ?? null;
        return target ? submitOk('item.use', { itemId: 'brush', target }) : false;
      }
      if (interaction.item) {
        const target = queries.findDropTarget?.(view, interaction) ?? null;
        if (!target) return false;
        if (interaction.item.kind === 'shovel') {
          return submitOk('item.use', {
            itemId: 'shovel',
            source: interaction.source,
            target,
            expectedSource: interaction.expectedSource,
          });
        }
        return submitOk('unit.drop', {
          source: interaction.source,
          target,
          expectedSource: interaction.expectedSource,
        });
      }
      if (view.title) return submitOk('campaign.start_stage', { stageIndex: view.stageIndex });
      if (view.over) return submitOk(view.win ? 'result.resolve' : 'battle.retry');
      if (view.phase === 'break') return submitOk('battle.start_wave');
      return false;
    }
    if (/^Digit[1-5]$/.test(code) && view.title) {
      return submitOk('campaign.select_stage', { stageIndex: Number(code.slice(-1)) - 1 });
    }
    if (code === 'KeyR' && view.title) return submitOk('campaign.reset_progress', { action: 'request' });
    if (code === 'Escape' && view.title) return submitOk('campaign.reset_progress', { action: 'cancel' });
    if (code === 'KeyP' && inBattle) {
      return submitOk('battle.set_paused', { paused: view.speed !== 0 });
    }
    if (code === 'KeyR' && inBattle) {
      setInteractionMode(interaction, null);
      return submitOk('battle.batch_recruit');
    }
    if (code === 'KeyB' && inBattle) return submitOk('item.select_mode', { itemId: 'brush' });
    if (code === 'KeyX' && inBattle) return submitOk('item.select_mode', { itemId: 'shovel' });
    if (code === 'Escape' && inBattle) return submitOk('session.quit', { reason: 'keyboard-escape' });
    if (/^Digit[1-5]$/.test(code) && inBattle && !interaction.item) {
      const index = Number(code.slice(-1)) - 1;
      const rect = layout.benchRect(index);
      return beginDrag({ zone: 'bench', index }, rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    return false;
  }

  function handle(intent) {
    if (intent.type === 'pointer.begin') {
      if (!intent.primary || activePointerId !== null
        || (intent.button !== undefined && intent.button !== 0)) return false;
      activePointerId = intent.pointerId;
      onGesture();
      return handleDown(intent);
    }
    if (intent.type === 'pointer.move') {
      if (activePointerId === null || intent.pointerId !== activePointerId || !interaction.item) return false;
      setPointerFeedback(interaction, {
        x: intent.x,
        y: intent.y,
        hover: pointerLocation(layout, intent.x, intent.y, getViewModel().benchSize),
      });
      return true;
    }
    if (intent.type === 'pointer.end') {
      if (activePointerId === null || intent.pointerId !== activePointerId) return false;
      const handled = handleDrop(intent);
      activePointerId = null;
      return handled;
    }
    if (intent.type === 'pointer.cancel') {
      if (activePointerId === null) return false;
      if (intent.pointerId !== null && intent.pointerId !== activePointerId) return false;
      activePointerId = null;
      return submitOk('interaction.drag_cancel', { reason: intent.reason });
    }
    if (intent.type === 'key.press') {
      onGesture();
      return handleKey(intent);
    }
    return false;
  }

  function cancel(reason = 'binding-destroy') {
    activePointerId = null;
    return interaction.item ? submitOk('interaction.drag_cancel', { reason }) : false;
  }

  return Object.freeze({ handle, cancel });
}

export { pointerLocation };
