import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createDomainEventQueue, createPresentationCueQueue } from '../src/engine-core/public.js';
import {
  SKILL_COMBAT_PORT_API_VERSION,
  SKILL_COMBAT_PORT_METHODS,
  SKILL_HANDLER_IDS,
  SKILL_HANDLER_REGISTRY,
  SKILL_STATUS_API_VERSION,
  createSkillExecutionRegistry,
  createSkillStatusState,
  createSkillStatusSystem,
  snapshotSkillStatus,
} from '../src/systems/skill-status/index.js';

const cellXY = (r, c) => ({ x: c * 40, y: r * 40 });

function createHarness(enemies = []) {
  const operations = [];
  const cues = [];
  const events = [];
  const world = { enemies };
  const combat = {
    listEnemies: (current) => [...current.enemies],
    findTarget: (current, { x, y, rangeCells }) => {
      const enemy = current.enemies.find((candidate) => {
        const point = combat.positionOf(current, candidate);
        return Math.hypot(point.x - x, point.y - y) <= rangeCells * CONFIG.board.cell;
      });
      if (!enemy) return null;
      return { enemy, ...combat.positionOf(current, enemy) };
    },
    positionOf: (_current, enemy) => ({ x: enemy.x ?? 0, y: enemy.y ?? 0 }),
    damage: (current, enemy, amount, metadata) => {
      operations.push(`damage:${metadata.source}:${amount}`);
      enemy.hp -= amount;
      if (enemy.hp <= 0) current.enemies.splice(current.enemies.indexOf(enemy), 1);
      return { defeated: enemy.hp <= 0 };
    },
    idOf: (enemy) => enemy.id,
    laneOf: (enemy) => enemy.lane,
    progressOf: (enemy) => enemy.p,
  };
  const system = createSkillStatusSystem({
    combat,
    publishCue: (cue) => { cues.push(cue); operations.push(`cue:${cue.type}`); },
    publishEvent: (event) => { events.push(event); operations.push(`event:${event.type}`); },
  });
  return { combat, cues, events, operations, system, world };
}

assert.equal(SKILL_STATUS_API_VERSION, '1.0.0');
assert.equal(SKILL_COMBAT_PORT_API_VERSION, '1.0.0');
assert.deepEqual(SKILL_HANDLER_REGISTRY.ids(), SKILL_HANDLER_IDS);
assert.throws(
  () => createSkillExecutionRegistry({}),
  /missing execution handler "skill\.dragon"/,
  '执行系统不能遗漏 Manifest 可引用的稳定 handler',
);
assert.deepEqual(SKILL_COMBAT_PORT_METHODS, [
  'listEnemies', 'findTarget', 'positionOf', 'damage', 'idOf', 'laneOf', 'progressOf',
]);
assert.throws(
  () => createSkillStatusSystem({ combat: {} }),
  /combat\.listEnemies must be a function/,
  '缺失 Combat Port 时必须在装配期明确失败',
);

{
  const state = createSkillStatusState({
    heroes: [{ key: 'zhaoyun', r: 1, c: 1, cd: 0, ultCd: 0, flash: 0 }],
  });
  const enemy = { id: 'enemy-1', lane: 0, p: 0, x: 80, y: 40, hp: 1_000 };
  const harness = createHarness([enemy]);
  harness.system.updateHeroes({
    world: harness.world,
    skillState: state,
    config: CONFIG,
    dt: 0.1,
    time: 1,
    tick: 7,
    cellXY,
    laneIds: [0, 1],
  });

  assert.equal(enemy.hp, 964, '英雄平 A 仍使用原始 36 点伤害');
  assert.equal(state.heroes[0].cd, CONFIG.heroes.zhaoyun.cd);
  assert.equal(state.heroes[0].ultCd, CONFIG.heroes.zhaoyun.ultCd);
  assert.equal(state.lastHeroCast, 'zhaoyun');
  assert.equal(state.stats.heroCasts, 1);
  assert.deepEqual(state.dragons.map(({ lane }) => lane), [0, 1], '赵云必须生成双路火龙');
  assert.ok(harness.operations.indexOf('damage:hero-zhaoyun-basic:36')
    < harness.operations.indexOf('event:skill.cast'), '同一英雄必须先平 A 再释放大招');
  assert.ok(harness.cues.some(({ type, payload }) => (
    type === 'skill.cast_feedback' && payload.skillId === 'dragon'
  )));
  assert.ok(harness.events.some(({ type, tick }) => type === 'skill.cast' && tick === 7));
}

{
  const enemy0 = { id: 'enemy-top', lane: 0, p: 0.8, hp: 1_000 };
  const enemy1 = { id: 'enemy-bottom', lane: 1, p: 0.8, hp: 1_000 };
  const tooFar = { id: 'enemy-far', lane: 0, p: 1.5, hp: 1_000 };
  const harness = createHarness([enemy0, enemy1, tooFar]);
  const state = createSkillStatusState();
  harness.system.castSkill({
    world: harness.world,
    skillState: state,
    config: CONFIG,
    hero: { key: 'zhaoyun' },
    heroConfig: CONFIG.heroes.zhaoyun,
    skillId: 'dragon',
    cx: 0,
    cy: 0,
    time: 0,
    tick: 1,
    laneIds: [0, 1],
    cellXY,
  });

  const encoded = JSON.stringify(state.dragons);
  assert.doesNotThrow(() => JSON.parse(encoded));
  assert.ok(!encoded.includes('{}'), '命中记录不得使用 Set 或敌人对象引用');
  assert.deepEqual(state.dragons.map(({ speed, life, hitDistance, damage }) => (
    [speed, life, hitDistance, damage]
  )), [[14, 5, 1.2, 90], [14, 5, 1.2, 90]]);

  harness.system.resolveDragonHits({ world: harness.world, skillState: state, tick: 2, cellXY });
  assert.deepEqual([enemy0.hp, enemy1.hp, tooFar.hp], [910, 910, 1_000]);
  assert.deepEqual(state.dragons.map(({ hitEnemyIds }) => hitEnemyIds), [
    ['enemy-top'],
    ['enemy-bottom'],
  ]);

  harness.system.resolveDragonHits({ world: harness.world, skillState: state, tick: 3, cellXY });
  assert.deepEqual([enemy0.hp, enemy1.hp], [910, 910], '同一条龙不能重复命中同一敌人');
  harness.system.advanceDragons({
    skillState: state,
    dt: 0.1,
    tick: 3,
    routeLengthForLane: () => 20,
  });
  assert.ok(Math.abs(state.dragons[0].p - 1.4) < 1e-9, '火龙必须在旧 p 命中结算后再推进');
  harness.system.resolveDragonHits({ world: harness.world, skillState: state, tick: 4, cellXY });
  assert.equal(tooFar.hp, 910);
}

{
  const enemy = { id: 'enemy-status', lane: 0, p: 0, x: 0, y: 0, hp: 1_000 };
  const harness = createHarness([enemy]);
  const state = createSkillStatusState();

  harness.system.castSkill({
    world: harness.world, skillState: state, config: CONFIG,
    hero: { key: 'zhangfei' }, heroConfig: CONFIG.heroes.zhangfei,
    skillId: 'shout', cx: 0, cy: 0, time: 10, tick: 10, laneIds: [0], cellXY,
  });
  assert.equal(enemy.hp, 980, '张飞大招必须保持 20 点伤害');
  assert.equal(harness.system.statusRemaining(state, 'enemy-status', 'stun', 10), 2.5);

  harness.system.castSkill({
    world: harness.world, skillState: state, config: CONFIG,
    hero: { key: 'liubei' }, heroConfig: CONFIG.heroes.liubei,
    skillId: 'aura', cx: 0, cy: 0, time: 10, tick: 11, laneIds: [0], cellXY,
  });
  assert.deepEqual(state.buff, { id: 'liubei-aura', mult: 1.5, until: 18 });
  assert.deepEqual(harness.system.damageModifiers(state, 12), [{
    id: 'liubei-aura', stat: 'damage', operation: 'multiply', value: 1.5, priority: 20,
  }]);
  assert.deepEqual(harness.system.damageModifiers(state, 18), []);

  harness.system.updateStatuses({ skillState: state, time: 12.6, tick: 12 });
  assert.equal(harness.system.statusRemaining(state, 'enemy-status', 'stun', 12.6), 0);
  assert.ok(harness.events.some(({ type }) => type === 'status.applied'));
  assert.ok(harness.events.some(({ type }) => type === 'status.expired'));
}

{
  const near = { id: 'near', lane: 0, p: 0, x: 100, y: 0, hp: 1_000 };
  const far = { id: 'far', lane: 0, p: 0, x: 131, y: 0, hp: 1_000 };
  const harness = createHarness([near, far]);
  const state = createSkillStatusState();
  harness.system.castSkill({
    world: harness.world, skillState: state, config: CONFIG,
    hero: { key: 'guanyu' }, heroConfig: CONFIG.heroes.guanyu,
    skillId: 'slash', cx: 0, cy: 0, time: 0, tick: 1, laneIds: [0], cellXY,
  });
  assert.equal(near.hp, 870, '关羽大招保持 3 格范围和 130 伤害');
  assert.equal(far.hp, 1_000);

  harness.system.castSkill({
    world: harness.world, skillState: state, config: CONFIG,
    hero: { key: 'huangzhong' }, heroConfig: CONFIG.heroes.huangzhong,
    skillId: 'rain', cx: 0, cy: 0, time: 0, tick: 2, laneIds: [0], cellXY,
  });
  assert.equal(near.hp, 815, '黄忠箭雨保持全体 55 伤害');
  assert.equal(far.hp, 945);
}

{
  const enemy = { id: 'publisher-isolation', lane: 0, p: 0, x: 0, y: 0, hp: 1_000 };
  const harness = createHarness([enemy]);
  const isolated = createSkillStatusSystem({
    combat: harness.combat,
    publishCue: () => { throw new Error('presentation unavailable'); },
    publishEvent: () => { throw new Error('observer unavailable'); },
  });
  const state = createSkillStatusState();
  assert.doesNotThrow(() => isolated.castSkill({
    world: harness.world, skillState: state, config: CONFIG,
    hero: { key: 'huangzhong' }, heroConfig: CONFIG.heroes.huangzhong,
    skillId: 'rain', cx: 0, cy: 0, time: 0, tick: 1, laneIds: [0], cellXY,
  }));
  assert.equal(enemy.hp, 945, '表现/观察者失败不得中断玩法伤害');
}

{
  const enemy = { id: 'queue-contract', lane: 0, p: 0, x: 0, y: 0, hp: 1_000 };
  const harness = createHarness([enemy]);
  const domainEvents = createDomainEventQueue();
  const presentationCues = createPresentationCueQueue();
  const system = createSkillStatusSystem({
    combat: harness.combat,
    publishCue: presentationCues,
    publishEvent: domainEvents,
  });
  const state = createSkillStatusState();
  system.castSkill({
    world: harness.world, skillState: state, config: CONFIG,
    hero: { key: 'huangzhong' }, heroConfig: CONFIG.heroes.huangzhong,
    skillId: 'rain', cx: 0, cy: 0, time: 0, tick: 9, laneIds: [0], cellXY,
  });
  assert.equal(domainEvents.peek().at(-1).protocol, 'domain-event');
  assert.equal(presentationCues.peek().at(-1).protocol, 'presentation-cue');
  assert.deepEqual(JSON.parse(JSON.stringify(snapshotSkillStatus(state))), state);
}

console.log('✓ Skill/Status 稳定协议、五英雄语义、可序列化双龙与状态生命周期');
