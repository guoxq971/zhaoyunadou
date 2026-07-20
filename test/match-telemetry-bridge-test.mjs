import assert from 'node:assert/strict';
import { deriveTelemetryFromDomainEvent } from '../src/platform-services/public.js';

const event = (type, payload) => ({
  apiVersion: '1.0.0',
  type,
  source: 'match-controller',
  sequence: 1,
  tick: 7,
  payload,
});

assert.deepEqual(deriveTelemetryFromDomainEvent(event('match.started', {
  stageIndex: 1,
  reason: 'player-start',
})), {
  eventId: 'stage_start',
  details: { result: 'started', reason: 'player-start' },
});

assert.deepEqual(deriveTelemetryFromDomainEvent(event('match.retry_requested', {
  stageIndex: 1,
  reason: 'stage-defeat',
})), {
  eventId: 'retry',
  details: { result: 'started', reason: 'stage-defeat' },
});

assert.deepEqual(deriveTelemetryFromDomainEvent(event('match.quit_requested', {
  stageIndex: 1,
  reason: 'keyboard-escape',
})), {
  eventId: 'quit',
  details: { result: 'abandoned', reason: 'keyboard-escape' },
});

for (const [result, expectedResult, expectedReason] of [
  ['victory', 'won', 'waves-cleared'],
  ['defeat', 'lost', 'lives-depleted'],
  ['abandoned', 'abandoned', 'abandoned-reason'],
]) {
  assert.deepEqual(deriveTelemetryFromDomainEvent(event('match.ended', {
    result,
    reason: `${result}-reason`,
    wave: 3,
  })), {
    eventId: 'stage_end',
    details: { result: expectedResult, reason: expectedReason },
  });
}

assert.equal(deriveTelemetryFromDomainEvent(event('match.unknown', {})), null);

console.log('✓ Match DomainEvent 单向派生 TelemetryEvent，统计结果不反向影响玩法');
