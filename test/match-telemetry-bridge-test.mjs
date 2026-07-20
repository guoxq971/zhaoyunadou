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

assert.equal(deriveTelemetryFromDomainEvent(event('encounter.wave_completed', {
  wave: 2, reward: 10, reason: 'enemies-cleared',
})), null, 'Encounter 预结算事实不得在 Economy 加款前提前上报 wave_end');
assert.deepEqual(deriveTelemetryFromDomainEvent(event('economy.reward_granted', {
  amount: 10, reason: 'wave-completed', wave: 2, sourceEventSequence: 9,
})), {
  eventId: 'wave_end',
  details: { result: 'cleared', reason: 'enemies-cleared', wave: 2, reward: 10 },
});

assert.deepEqual(deriveTelemetryFromDomainEvent(event('economy.recruit_attempted', {
  cost: 16, recruitIndex: 0,
})), {
  eventId: 'recruit_attempt',
  details: { result: 'attempted', reason: 'none', cost: 16, recruitIndex: 0 },
});
assert.deepEqual(deriveTelemetryFromDomainEvent(event('economy.recruit_completed', {
  ok: true, reason: 'none', cost: 16, itemKind: 'troop', itemId: 'dao', slot: 4,
})), {
  eventId: 'recruit_result',
  details: {
    result: 'success', reason: 'none', cost: 16, itemKind: 'troop', itemId: 'dao', slot: 4,
  },
});
assert.deepEqual(deriveTelemetryFromDomainEvent(event('formation.merged', {
  pieceId: 'piece-2', itemKind: 'troop', itemId: 'dao', level: 2,
  cell: { r: 4, c: 4 },
})), {
  eventId: 'merge',
  details: {
    result: 'success', reason: 'none', unitId: 'dao', itemKind: 'troop', level: 2,
    cell: { r: 4, c: 4 }, pieceId: 'piece-2',
  },
});
assert.deepEqual(deriveTelemetryFromDomainEvent(event('formation.hero_unlocked', {
  heroId: 'zhaoyun', r: 4, c: 4, level: 1,
})), {
  eventId: 'hero_unlock',
  details: { result: 'success', reason: 'pair-completed', heroId: 'zhaoyun' },
});
assert.deepEqual(deriveTelemetryFromDomainEvent(event('board.piece_moved', {
  pieceId: 'piece-1', itemKind: 'troop', itemId: 'dao',
  source: { zone: 'bench', index: 0 }, target: { zone: 'grid', r: 4, c: 4 },
})), {
  eventId: 'deploy',
  details: {
    result: 'success', reason: 'none', unitId: 'dao', itemKind: 'troop',
    action: 'move', cell: { r: 4, c: 4 }, source: 'bench', pieceId: 'piece-1',
  },
});
assert.equal(deriveTelemetryFromDomainEvent(event('item.used', {
  itemId: 'shovel', r: 3, c: 4, source: 'bench',
})).details.source, 'bench');
assert.equal(deriveTelemetryFromDomainEvent(event('item.used', {
  itemId: 'shovel', r: 3, c: 4, source: 'shovel-mode',
})).details.source, 'shovel-mode',
'道具模式和营栏拖拽必须保留各自真实 Telemetry source');

assert.equal(
  deriveTelemetryFromDomainEvent(event('combat.enemy_leaked', {
    enemyId: 'enemy-1', enemyType: 'normal', wave: 2, lane: 0,
  })),
  null,
  'Combat 只报告抵达营门的事实，不得在 Encounter 扣命前推导对外统计',
);
assert.deepEqual(deriveTelemetryFromDomainEvent(event('encounter.enemy_leak_resolved', {
  enemyId: 'enemy-2', enemyType: 'fast', wave: 2, lane: 1,
  livesBefore: 4, livesRemaining: 3,
})), {
  eventId: 'enemy_leak',
  details: {
    result: 'life-lost', reason: 'reached-gate', enemyId: 'fast',
    laneId: '1', livesBefore: 4, livesRemaining: 3,
  },
});

console.log('✓ Match/Economy/Board DomainEvent 单向派生 TelemetryEvent，统计结果不反向影响玩法');
