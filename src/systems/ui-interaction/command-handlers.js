import { resetInteractionState } from './interaction-state.js';

function sourceFields(location) {
  return location?.zone === 'bench'
    ? { from: 'bench', index: location.index, r: null, c: null }
    : { from: 'board', index: null, r: location?.r, c: location?.c };
}

// UI 临时态只消费窄查询结果；玩法对象是否合法仍由拥有它的系统判断。
export function createInteractionCommandHandlers({
  interaction,
  querySource,
  queryItemAvailable,
  invalid,
} = {}) {
  if (!interaction || typeof interaction !== 'object') {
    throw new TypeError('[ui-interaction] interaction is required');
  }
  if (typeof querySource !== 'function' || typeof queryItemAvailable !== 'function') {
    throw new TypeError('[ui-interaction] gameplay queries are required');
  }
  if (typeof invalid !== 'function') throw new TypeError('[ui-interaction] invalid is required');

  return Object.freeze({
    'interaction.drag_begin'(command) {
      if (interaction.item) return invalid(command, 'drag-active');
      const source = querySource(command.payload.source);
      if (!source?.item) return invalid(command, 'source-empty');
      if (!source.movable && !source.draggableTool) {
        return invalid(command, 'source-not-movable');
      }
      interaction.item = source.item;
      interaction.source = command.payload.source;
      interaction.expectedSource = source.signature;
      Object.assign(interaction, sourceFields(command.payload.source));
      return {
        ok: true,
        reason: 'none',
        source: command.payload.source,
        itemKind: source.item.kind,
      };
    },
    'interaction.drag_cancel'() {
      const active = Boolean(interaction.item);
      resetInteractionState(interaction);
      return { ok: true, reason: 'none', active };
    },
    'item.select_mode'(command) {
      const itemId = command.payload.itemId ?? null;
      if (itemId === null) {
        interaction.mode = null;
        return { ok: true, reason: 'none', itemId: null };
      }
      if (!['brush', 'shovel'].includes(itemId)) return invalid(command, 'unknown-item');
      if (!queryItemAvailable(itemId)) return invalid(command, 'tool-unavailable');
      interaction.mode = interaction.mode === itemId ? null : itemId;
      return { ok: true, reason: 'none', itemId: interaction.mode };
    },
  });
}
