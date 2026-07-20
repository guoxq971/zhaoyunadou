import { createDomainEventQueue, runtimeFor } from '../../engine-core/public.js';
import { createMergeDefenseDomainEventDispatcher } from './domain-event-router.js';

const fallbacks = new WeakMap();

function fallbackFor(state, gamePack) {
  let fallback = fallbacks.get(state);
  if (!fallback) {
    const queue = createDomainEventQueue();
    const dispatcher = createMergeDefenseDomainEventDispatcher();
    fallback = { queue, dispatcher, gamePack };
    fallbacks.set(state, fallback);
  }
  return fallback;
}

export function publishSystemDomainEvent(state, definition, gamePack) {
  const runtime = runtimeFor(state);
  if (runtime?.publishDomainEvent) return runtime.publishDomainEvent(definition, state);
  return fallbackFor(state, gamePack).queue.publish(definition);
}

export function pumpSystemDomainEvents(state, gamePack) {
  const runtime = runtimeFor(state);
  if (runtime?.pumpDomainEvents) return runtime.pumpDomainEvents(state);
  const fallback = fallbackFor(state, gamePack);
  return fallback.dispatcher.pump(fallback.queue, state, {
    gamePack: gamePack ?? fallback.gamePack,
    publish: (definition) => fallback.queue.publish(definition),
  });
}
