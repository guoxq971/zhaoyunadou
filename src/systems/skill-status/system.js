import { resolveStat } from '../attribute/index.js';
import { createSkillExecutionRegistry } from './registry.js';
import { nextSkillEntityId } from './state.js';
import { assertSkillCombatPort, createSafePublisher } from './ports.js';

const SOURCE = 'skill-status';
const finite = (value, field) => {
  if (!Number.isFinite(value)) throw new TypeError(`[skill-status] ${field} must be finite`);
  return value;
};
const safeTick = (tick) => (Number.isInteger(tick) && tick >= 0 ? tick : 0);
const skillsFor = (config) => config?.skills ?? config?.ults ?? {};

function enemyId(combat, enemy) {
  const id = combat.idOf(enemy);
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError('[skill-status] combat.idOf must return a non-empty string');
  }
  return id;
}

function createDragon(skillState, skill, lane) {
  return {
    id: nextSkillEntityId(skillState, 'dragon'),
    skillId: 'dragon',
    lane,
    p: 0,
    speed: finite(skill.effectSpeed, 'dragon speed'),
    life: finite(skill.effectLife, 'dragon life'),
    elapsed: 0,
    hitDistance: finite(skill.hitDistance, 'dragon hit distance'),
    damage: finite(skill.dmg, 'dragon damage'),
    hitEnemyIds: [],
  };
}

export function createSkillStatusSystem({
  combat: combatCandidate,
  publishCue: cueCandidate = null,
  publishEvent: eventCandidate = null,
  onPublisherError = null,
  resolveDamage = ({ base, modifiers, world }) => resolveStat(base, 'damage', modifiers, world),
} = {}) {
  const combat = assertSkillCombatPort(combatCandidate);
  const publishCue = createSafePublisher(cueCandidate, onPublisherError);
  const publishEvent = createSafePublisher(eventCandidate, onPublisherError);

  const cue = (type, tick, payload) => publishCue({
    type, source: SOURCE, tick: safeTick(tick), payload,
  });
  const event = (type, tick, payload) => publishEvent({
    type, source: SOURCE, tick: safeTick(tick), payload,
  });

  function applyStatus(skillState, {
    targetId, statusId, duration, time, tick = 0, sourceId,
  }) {
    if (typeof targetId !== 'string' || targetId.length === 0) {
      throw new TypeError('[skill-status] targetId must be a non-empty string');
    }
    finite(duration, 'status duration');
    finite(time, 'status time');
    const expiresAt = time + duration;
    let status = skillState.statuses.find((entry) => (
      entry.targetId === targetId && entry.statusId === statusId
    ));
    if (status) {
      status.expiresAt = Math.max(status.expiresAt, expiresAt);
      status.sourceId = sourceId;
    } else {
      status = {
        id: nextSkillEntityId(skillState, 'status'),
        statusId,
        targetId,
        sourceId,
        appliedAt: time,
        expiresAt,
      };
      skillState.statuses.push(status);
    }
    event('status.applied', tick, {
      statusId, targetId, sourceId, duration, expiresAt: status.expiresAt,
    });
    return status;
  }

  const handlers = {
    'skill.dragon': (context) => {
      const { skillState, skill, tick = 0 } = context;
      const laneIds = [...new Set(context.laneIds ?? [0])];
      for (const lane of laneIds) {
        const dragon = createDragon(skillState, skill, lane);
        skillState.dragons.push(dragon);
        cue('skill.impact_feedback', tick, {
          skillId: 'dragon', effectId: 'effect.dragon', entityId: dragon.id, lane,
        });
      }
    },
    'skill.rain': ({ world, skill, cellXY, tick = 0, hero }) => {
      cue('skill.impact_feedback', tick, { skillId: 'rain', effectId: 'effect.rain' });
      for (const enemy of combat.listEnemies(world)) {
        combat.damage(world, enemy, skill.dmg, {
          cellXY, source: `hero-${hero.key}-rain`, attackKind: 'skill', skillId: 'rain',
        });
      }
    },
    'skill.shout': ({ world, skillState, skill, cellXY, cx, cy, time, tick = 0, hero }) => {
      cue('skill.impact_feedback', tick, {
        skillId: 'shout', effectId: 'effect.ring', x: cx, y: cy,
      });
      for (const enemy of combat.listEnemies(world)) {
        const targetId = enemyId(combat, enemy);
        applyStatus(skillState, {
          targetId,
          statusId: 'stun',
          duration: skill.stun,
          time,
          tick,
          sourceId: `hero-${hero.key}`,
        });
        combat.damage(world, enemy, skill.dmg, {
          cellXY, source: `hero-${hero.key}-shout`, attackKind: 'skill', skillId: 'shout',
        });
      }
    },
    'skill.slash': ({ world, skill, config, cellXY, cx, cy, tick = 0, hero }) => {
      const radius = skill.range * config.board.cell;
      cue('skill.impact_feedback', tick, {
        skillId: 'slash', effectId: 'effect.ring', x: cx, y: cy, radius,
      });
      for (const enemy of combat.listEnemies(world)) {
        const position = combat.positionOf(world, enemy, cellXY);
        if (Math.hypot(position.x - cx, position.y - cy) > radius) continue;
        cue('skill.impact_feedback', tick, {
          skillId: 'slash', effectId: 'effect.slash',
          enemyId: enemyId(combat, enemy), x: position.x, y: position.y,
        });
        combat.damage(world, enemy, skill.dmg, {
          cellXY, source: `hero-${hero.key}-slash`, attackKind: 'skill', skillId: 'slash',
        });
      }
    },
    'skill.aura': ({ skillState, skill, cx, cy, time, tick = 0, hero }) => {
      skillState.buff = {
        id: 'liubei-aura',
        mult: skill.mult,
        until: time + skill.dur,
      };
      cue('skill.impact_feedback', tick, {
        skillId: 'aura', effectId: 'effect.ring', x: cx, y: cy,
      });
      event('status.applied', tick, {
        statusId: 'aura', targetId: 'player-army', sourceId: `hero-${hero.key}`,
        duration: skill.dur, expiresAt: skillState.buff.until,
      });
    },
  };
  const handlerRegistry = createSkillExecutionRegistry(handlers);

  function damageModifiers(skillState, time) {
    const buff = skillState.buff;
    if (!buff || time >= buff.until) return [];
    return [{
      id: buff.id ?? 'liubei-aura',
      stat: 'damage',
      operation: 'multiply',
      value: buff.mult,
      priority: 20,
    }];
  }

  function castSkill({
    world,
    skillState,
    config,
    hero,
    heroConfig,
    skillId: requestedSkillId,
    cx,
    cy,
    cellXY,
    laneIds = [0],
    time = 0,
    tick = 0,
  }) {
    const skillId = requestedSkillId ?? heroConfig.skillId ?? heroConfig.ult;
    const skill = skillsFor(config)[skillId];
    if (!skill) throw new Error(`[skill-status] unknown skill "${skillId}"`);
    const handlerId = skill.handlerId ?? `skill.${skillId}`;
    skillState.lastHeroCast = hero.key;
    skillState.stats.heroCasts = (skillState.stats.heroCasts ?? 0) + 1;
    cue('skill.cast_feedback', tick, {
      heroId: hero.key, skillId, x: cx, y: cy,
    });
    handlerRegistry.get(handlerId)({
      world, skillState, config, hero, heroConfig, skill, skillId,
      cx, cy, cellXY, laneIds, time, tick,
    });
    event('skill.cast', tick, {
      heroId: hero.key, skillId, handlerId, reason: 'auto-cast',
    });
    return { heroId: hero.key, skillId, handlerId };
  }

  function updateHeroes({
    world,
    skillState,
    config,
    dt,
    cellXY,
    laneIds = [0],
    time = 0,
    tick = 0,
  }) {
    finite(dt, 'dt');
    for (const hero of skillState.heroes) {
      const heroConfig = config.heroes[hero.key];
      if (!heroConfig) throw new Error(`[skill-status] unknown hero "${hero.key}"`);
      const left = cellXY(hero.r, hero.c);
      const right = cellXY(hero.r, hero.c + 1);
      const cx = (left.x + right.x) / 2;
      const cy = left.y;

      // 与旧循环一致：每名英雄先结算平 A，再判断本人的大招。
      hero.cd -= dt;
      if (hero.cd <= 0) {
        const target = combat.findTarget(world, {
          x: cx, y: cy, rangeCells: heroConfig.range, cellXY,
        });
        if (target) {
          hero.cd = heroConfig.cd;
          hero.flash = 0.15;
          const targetId = enemyId(combat, target.enemy);
          cue('skill.impact_feedback', tick, {
            skillId: 'basic-attack', effectId: 'effect.slash', heroId: hero.key,
            enemyId: targetId, x: target.x, y: target.y,
          });
          const amount = resolveDamage({
            base: heroConfig.dmg,
            modifiers: damageModifiers(skillState, time),
            world,
          });
          combat.damage(world, target.enemy, amount, {
            cellXY, source: `hero-${hero.key}-basic`, attackKind: 'hero-basic', heroId: hero.key,
          });
        }
      }
      if (hero.flash > 0) hero.flash -= dt;

      hero.ultCd -= dt;
      if (hero.ultCd <= 0 && combat.listEnemies(world).length > 0) {
        hero.ultCd = heroConfig.ultCd;
        castSkill({
          world, skillState, config, hero, heroConfig, cx, cy, cellXY,
          laneIds, time, tick,
        });
      }
    }
  }

  function resolveDragonHits({ world, skillState, cellXY, tick = 0 }) {
    for (const dragon of skillState.dragons) {
      const alreadyHit = new Set(dragon.hitEnemyIds);
      for (const enemy of combat.listEnemies(world)) {
        if (combat.laneOf(enemy) !== dragon.lane) continue;
        const id = enemyId(combat, enemy);
        if (alreadyHit.has(id)) continue;
        if (Math.abs(combat.progressOf(enemy) - dragon.p) >= dragon.hitDistance) continue;
        dragon.hitEnemyIds.push(id);
        alreadyHit.add(id);
        const position = combat.positionOf(world, enemy, cellXY);
        cue('skill.impact_feedback', tick, {
          skillId: dragon.skillId, effectId: 'effect.ink', entityId: dragon.id,
          enemyId: id, x: position.x, y: position.y,
        });
        combat.damage(world, enemy, dragon.damage, {
          cellXY, source: `skill-dragon-${dragon.id}`,
          attackKind: 'skill', skillId: dragon.skillId,
        });
      }
    }
  }

  function advanceDragons({ skillState, dt, routeLengthForLane, tick = 0 }) {
    finite(dt, 'dt');
    if (typeof routeLengthForLane !== 'function') {
      throw new TypeError('[skill-status] routeLengthForLane must be a function');
    }
    for (let index = skillState.dragons.length - 1; index >= 0; index--) {
      const dragon = skillState.dragons[index];
      dragon.elapsed += dt;
      dragon.p += dragon.speed * dt;
      const routeLength = routeLengthForLane(dragon.lane);
      if (dragon.elapsed >= dragon.life || dragon.p > routeLength + 2) {
        skillState.dragons.splice(index, 1);
        cue('skill.impact_feedback', tick, {
          skillId: dragon.skillId, effectId: 'effect.dragon',
          phase: 'end', entityId: dragon.id,
        });
      }
    }
  }

  function statusRemaining(skillState, targetId, statusId, time) {
    const status = skillState.statuses.find((entry) => (
      entry.targetId === targetId && entry.statusId === statusId
    ));
    return status ? Math.max(0, status.expiresAt - time) : 0;
  }

  function updateStatuses({ skillState, time, tick = 0 }) {
    finite(time, 'status time');
    for (let index = skillState.statuses.length - 1; index >= 0; index--) {
      const status = skillState.statuses[index];
      if (status.expiresAt > time) continue;
      skillState.statuses.splice(index, 1);
      event('status.expired', tick, {
        statusId: status.statusId,
        targetId: status.targetId,
        sourceId: status.sourceId,
        expiredAt: status.expiresAt,
      });
    }
    if (skillState.buff && skillState.buff.until <= time) {
      const buff = skillState.buff;
      skillState.buff = null;
      event('status.expired', tick, {
        statusId: 'aura', targetId: 'player-army', sourceId: buff.id,
        expiredAt: buff.until,
      });
    }
  }

  return Object.freeze({
    handlers: handlerRegistry,
    updateHeroes,
    castSkill,
    resolveDragonHits,
    advanceDragons,
    applyStatus,
    updateStatuses,
    statusRemaining,
    damageModifiers,
  });
}
