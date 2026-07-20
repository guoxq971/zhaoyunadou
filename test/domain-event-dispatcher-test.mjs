import assert from 'node:assert/strict';
import { createDomainEventDispatcher, createDomainEventQueue } from '../src/engine-core/public.js';

const queue = createDomainEventQueue();
const trace = [];
const dispatcher = createDomainEventDispatcher([
  {
    systemId: 'economy-formation',
    handlers: {
      'combat.enemy_defeated'(event) {
        trace.push(`economy:${event.payload.enemyId}`);
        queue.publish({
          type: 'economy.reward_granted', source: 'economy-formation', tick: event.tick,
          payload: { amount: 3 },
        });
      },
    },
  },
  {
    systemId: 'skin-presentation',
    handlers: {
      'combat.enemy_defeated'(event) { trace.push(`presentation:${event.payload.enemyId}`); },
      'economy.reward_granted'(event) { trace.push(`reward:${event.payload.amount}`); },
    },
  },
]);

queue.publish({
  type: 'combat.enemy_defeated', source: 'combat', tick: 7,
  payload: { enemyId: 'enemy-1' },
});
const result = dispatcher.pump(queue, {});
assert.deepEqual(trace, ['economy:enemy-1', 'presentation:enemy-1', 'reward:3']);
assert.equal(result.processed, 2, '同步派生事件必须在同一次 pump 中按序处理');
assert.equal(result.deliveries.length, 3, '同一事件不得被首个消费者独占');
assert.equal(queue.size, 0);

assert.throws(() => createDomainEventDispatcher([
  { systemId: 'combat', handlers: {} },
  { systemId: 'combat', handlers: {} },
]), /duplicate consumer/);

const looping = createDomainEventQueue();
const bounded = createDomainEventDispatcher([{
  systemId: 'combat',
  handlers: {
    'combat.loop'(event) {
      looping.publish({ type: 'combat.loop', source: 'combat', tick: event.tick, payload: {} });
    },
  },
}], { maxEventsPerPump: 3 });
looping.publish({ type: 'combat.loop', source: 'combat', tick: 0, payload: {} });
assert.throws(() => bounded.pump(looping, {}), /pump limit exceeded/);

console.log('✓ DomainEvent 多消费者顺序、派生事件与环上限');
