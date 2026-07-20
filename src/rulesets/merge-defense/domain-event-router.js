import { createDomainEventDispatcher } from '../../engine-core/public.js';
import { consumeEconomyDomainEvents } from '../../systems/economy/index.js';
import { consumeFixedRouteCampaignDomainEvents } from '../../systems/match-mode/index.js';
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
        'encounter.completed': (event, state, context) => (
          consumeFixedRouteCampaignDomainEvents(state, [event], {
            publishDomainEvent: (_state, definition) => context.publish(definition),
          })
        ),
      },
    },
  ]);
}
