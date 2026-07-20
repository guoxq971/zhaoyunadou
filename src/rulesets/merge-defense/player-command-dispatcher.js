import {
  composeCommandHandlerMaps,
  publishDomainEventFor,
  setSimulationPaused,
  setSimulationSpeed,
} from '../../engine-core/public.js';
import {
  FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES,
  createFixedRouteCampaignCommandHandlers,
} from '../../systems/match-mode/index.js';
import {
  canMerge,
  createEconomyCommandHandlers,
  itemAtLocation,
  itemSignature,
  isMovableUnit,
} from '../../systems/economy/index.js';
import { createEquipmentCommandHandlers } from '../../systems/equipment-items/index.js';
import { createStageEncounterCommandHandlers } from '../../systems/stage-encounter/index.js';
import {
  createInteractionCommandHandlers,
  resetInteractionState,
} from '../../systems/ui-interaction/index.js';

export { resetInteractionState } from '../../systems/ui-interaction/index.js';

export const PLAYER_COMMAND_TYPES = FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES;

// 集成层把玩法只读 query 注入 UI；UI 本身不导入 Economy 或 ruleset 内部。
export function createMergeDefenseInputQueries({ getState, gamePack } = {}) {
  if (typeof getState !== 'function') throw new TypeError('[merge-defense] getState is required');
  return Object.freeze({
    findBrushTarget() {
      const state = getState();
      for (let row = 0; row < state.grid.length; row++) {
        for (let column = 0; column < state.grid[row].length; column++) {
          if (['troop', 'frag'].includes(state.grid[row][column].unit?.kind)) {
            return { zone: 'grid', r: row, c: column };
          }
        }
      }
      return null;
    },
    findDropTarget(_viewModel, interaction) {
      const state = getState();
      const item = interaction.item;
      if (!item) return null;
      if (item.kind === 'shovel') {
        for (let row = 0; row < state.grid.length; row++) {
          for (let column = 0; column < state.grid[row].length; column++) {
            if (state.grid[row][column].type === 'locked') {
              return { zone: 'grid', r: row, c: column };
            }
          }
        }
        return null;
      }
      let empty = null;
      for (let row = 0; row < state.grid.length; row++) {
        for (let column = 0; column < state.grid[row].length; column++) {
          const cell = state.grid[row][column];
          if (cell.type !== 'open') continue;
          if (cell.unit && canMerge(cell.unit, item, gamePack)) {
            return { zone: 'grid', r: row, c: column };
          }
          if (!cell.unit && !empty) empty = { zone: 'grid', r: row, c: column };
        }
      }
      return empty;
    },
  });
}

// 玩法拥有的数据先压成窄查询结果，再交给 UI Interaction 更新临时交互态。
export function createMergeDefenseInteractionCommandQueries({ getState } = {}) {
  if (typeof getState !== 'function') throw new TypeError('[merge-defense] getState is required');
  return Object.freeze({
    querySource(location) {
      const item = itemAtLocation(getState(), location);
      return {
        item,
        signature: item ? itemSignature(item) : null,
        movable: isMovableUnit(item),
        draggableTool: location?.zone === 'bench' && item?.kind === 'shovel',
      };
    },
    queryItemAvailable(itemId) {
      const state = getState();
      if (itemId === 'brush') return state.brushes > 0;
      if (itemId === 'shovel') return state.shovels > 0;
      return false;
    },
  });
}

export function createMergeDefenseCommandHandlers({ game, drag, gamePack }) {
  const stateNow = () => game.state;
  const invalid = (command, reason, actionId = command.type) => {
    publishDomainEventFor(stateNow(), {
      type: 'command.rejected',
      source: 'foundation-runtime',
      tick: command.tick,
      payload: { commandType: actionId, reason },
    });
    return { ok: false, reason };
  };
  const clearDrag = () => resetInteractionState(drag);
  const interactionQueries = createMergeDefenseInteractionCommandQueries({ getState: stateNow });

  return composeCommandHandlerMaps([
    {
      systemId: 'match-controller',
      handlers: createFixedRouteCampaignCommandHandlers({
        matchMode: game,
        clockControls: {
          setSimulationPaused,
          setSimulationSpeed,
        },
        invalid,
      }),
    },
    {
      systemId: 'ui-interaction',
      handlers: createInteractionCommandHandlers({
        interaction: drag,
        ...interactionQueries,
        invalid,
      }),
    },
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
