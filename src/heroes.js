// 兼容门面：英雄冷却、状态和技能实体交由 Skill/Status，表现通过 Cue 消费。
import { CONFIG } from './config.js';
import {
  createPresentationCueQueue,
  gamePackFor,
  presentationCuesFor,
  runtimeFor,
} from './engine-core/public.js';
import { damageEnemy, enemyGameplayXY, ensureEnemyIdentity } from './enemies.js';
import { findTarget } from './units.js';
import { activeEnemyById, listEnemyViews } from './systems/combat/index.js';
import {
  createSkillStatusSystem,
  skillStatusStateFor,
} from './systems/skill-status/index.js';
import { consumePresentationCues } from './systems/skin-presentation/index.js';
import {
  publishSystemDomainEvent,
  pumpSystemDomainEvents,
} from './rulesets/merge-defense/domain-event-runtime.js';

const systems = new WeakMap();
const localCueQueues = new WeakMap();
const packFor = (state) => gamePackFor(state) ?? { config: CONFIG };
const tickFor = (state) => runtimeFor(state)?.currentTick?.() ?? 0;

function cueQueueFor(state) {
  const runtimeQueue = presentationCuesFor(state);
  if (runtimeQueue) return runtimeQueue;
  if (!localCueQueues.has(state)) localCueQueues.set(state, createPresentationCueQueue());
  return localCueQueues.get(state);
}

function combatPort(state) {
  return {
    listEnemyViews: (world) => listEnemyViews(world),
    findTargetView: (world, { x, y, rangeCells, cellXY }) => {
      const target = findTarget(world, x, y, rangeCells, cellXY);
      if (!target) return null;
      return {
        enemyId: ensureEnemyIdentity(state, target.e),
        type: target.e.type,
        wave: target.e.wave,
        lane: target.e.lane ?? 0,
        progress: target.e.p,
        hp: target.e.hp,
        maxHp: target.e.maxHp,
        x: target.x,
        y: target.y,
      };
    },
    positionOf: (world, targetId, cellXY) => {
      const enemy = activeEnemyById(world, targetId);
      return enemy ? enemyGameplayXY(world, enemy, cellXY) : { x: 0, y: 0 };
    },
    damageById: (world, targetId, amount, metadata) => {
      const enemy = activeEnemyById(world, targetId);
      if (!enemy) return { ok: false, reason: 'enemy-not-active' };
      return damageEnemy(
      world,
      enemy,
      amount,
      metadata.cellXY,
      { attackerId: metadata.source, attackKind: metadata.attackKind },
      );
    },
  };
}

function systemFor(state) {
  let system = systems.get(state);
  if (system) return system;
  const gamePack = packFor(state);
  system = createSkillStatusSystem({
    combat: combatPort(state),
    publishCue: cueQueueFor(state),
    publishEvent: (definition) => publishSystemDomainEvent(state, definition, gamePack),
  });
  systems.set(state, system);
  return system;
}

function flushPresentation(state) {
  const gamePack = packFor(state);
  const cues = cueQueueFor(state).drain();
  consumePresentationCues(state, cues, gamePack);
  return cues;
}

export function updateHeroes(state, dt, cellXY) {
  const gamePack = packFor(state);
  for (const enemy of state.enemies) ensureEnemyIdentity(state, enemy);
  const skillState = skillStatusStateFor(state);
  const system = systemFor(state);
  system.updateStatuses({ skillState, time: state.time, tick: tickFor(state) });
  const result = system.updateHeroes({
    world: state,
    skillState,
    config: gamePack.config,
    dt,
    cellXY,
    laneIds: (state.paths?.length ? state.paths : [state.path]).map((_path, lane) => lane),
    time: state.time,
    tick: tickFor(state),
  });
  pumpSystemDomainEvents(state, gamePack);
  flushPresentation(state);
  return result;
}

// 火龙在旧 p 位置先命中；推进只能由 advanceSkillEntities 在弹道结算后调用。
export function updateDragonDamage(state, cellXY) {
  const gamePack = packFor(state);
  const skillState = skillStatusStateFor(state);
  const result = systemFor(state).resolveDragonHits({
    world: state,
    skillState,
    cellXY,
    tick: tickFor(state),
  });
  pumpSystemDomainEvents(state, gamePack);
  flushPresentation(state);
  return result;
}

export function advanceSkillEntities(state, dt) {
  const skillState = skillStatusStateFor(state);
  const result = systemFor(state).advanceDragons({
    skillState,
    dt,
    tick: tickFor(state),
    routeLengthForLane: (lane) => (state.paths?.[lane] ?? state.path ?? []).length,
  });
  flushPresentation(state);
  return result;
}
