import assert from 'node:assert/strict';
import { createGameClock } from '../src/game-clock.js';

let now = 1_000;
const clock = createGameClock(() => now);

now += 33;
assert.ok(Math.abs(clock.next(1, false) - 0.033) < 1e-9);

now += 30 * 60 * 1_000;
assert.equal(clock.next(2, true), 0, '后台隐藏 30 分钟不可推进战斗');

now += 16;
assert.ok(Math.abs(clock.next(2, false) - 0.032) < 1e-9, '恢复首帧只推进真实短帧');

now -= 100;
assert.equal(clock.next(1, false), 0, '系统时钟倒退不可产生负 dt');

console.log('✓ 后台冻结、恢复首帧与时钟倒退保护');
