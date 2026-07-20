import { createDomainEventDispatcher } from '../../engine-core/public.js';
import { consumeEconomyDomainEvents } from '../../systems/economy/index.js';
import { consumeStageEncounterDomainEvents } from '../../systems/stage-encounter/index.js';

export function createMergeDefenseDomainEventDispatcher() {
  return createDomainEventDispatcher([
    {
      systemId: 'economy-formation',
      handlers: {
        'combat.enemy_defeated': (event, state, context) => (
          consumeEconomyDomainEvents(state, [event], context.gamePack)
        ),
        'encounter.wave_completed': (event, state, context) => (
          consumeEconomyDomainEvents(state, [event], context.gamePack)
        ),
      },
    },
    {
      systemId: 'stage-encounter',
      handlers: {
        'combat.enemy_leaked': (event, state, context) => consumeStageEncounterDomainEvents(
          state,
          [event],
          { publishDomainEvent: (_state, definition) => context.publish(definition) },
        ),
      },
    },
    {
      systemId: 'match-controller',
      handlers: {
        'encounter.completed'(event, state, context) {
          state.over = true;
          state.win = event.payload.result === 'victory';
          context.publish({
            type: 'match.ended', source: 'match-controller', tick: event.tick,
            payload: {
              result: event.payload.result,
              reason: event.payload.reason,
              wave: event.payload.wave,
            },
          });
          return state.win;
        },
      },
    },
  ]);
}
