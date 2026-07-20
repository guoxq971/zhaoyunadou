import { getStateSlice } from '../../engine-core/public.js';
import { snapshotAttributeRuntimeState } from '../../systems/attribute/index.js';
import { snapshotCombatRuntimeState } from '../../systems/combat/index.js';
import { snapshotEconomyRuntimeState } from '../../systems/economy/index.js';
import { snapshotPieceRuntimeState } from '../../systems/piece/index.js';
import {
  snapshotSkillStatus,
  statusRemainingForState,
} from '../../systems/skill-status/index.js';

function unitSnapshot(unit) {
  if (!unit) return null;
  const identity = {
    pieceId: unit.pieceId ?? null,
    revision: unit.revision ?? 0,
    location: unit.location ? { ...unit.location } : null,
  };
  if (unit.kind === 'troop') return {
    kind: 'troop', type: unit.type, level: unit.level ?? 1,
    cd: unit.cd === undefined ? null : rounded(unit.cd),
    ...identity,
  };
  if (unit.kind === 'frag') return { kind: 'frag', char: unit.char, level: unit.level ?? 1, ...identity };
  if (unit.kind === 'hero') return {
    kind: 'hero', key: unit.key, part: unit.part, level: unit.level ?? 1,
    ...identity,
  };
  return { kind: unit.kind, ...identity };
}

const rounded = (value) => Number.isFinite(value) ? Number(value.toFixed(6)) : value;

// 这是关键玩法状态摘要；排除纯表现粒子，但保留会造成伤害的龙、弹道与敌军状态。
export function snapshotMergeDefenseCommandState(state) {
  const skillStatus = snapshotSkillStatus(getStateSlice(state, 'skillStatus'));
  const encounter = getStateSlice(state, 'encounter');
  const dragons = skillStatus.dragons.length > 0
    ? skillStatus.dragons
    : state.effects.filter((effect) => effect.kind === 'dragon').map((effect) => ({
      lane: effect.lane ?? 0, p: rounded(effect.p), t: rounded(effect.t),
      speed: rounded(effect.speed), life: rounded(effect.life),
      hitDistance: rounded(effect.hitDistance),
      hit: [...(effect.hit ?? [])]
        .map((enemy) => state.enemies.indexOf(enemy))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b),
    }));
  return {
    stageIndex: state.stageIndex,
    clearedStars: state.clearedStars,
    title: state.title,
    over: state.over,
    win: state.win,
    saved: Boolean(state.saved),
    resetConfirmUntil: rounded(state.resetConfirmUntil ?? 0),
    time: rounded(state.time),
    speed: state.speed,
    resumeSpeed: state.resumeSpeed ?? 1,
    mantou: state.mantou,
    lives: state.lives,
    shovels: state.shovels,
    brushes: state.brushes,
    recruitCount: state.recruitCount,
    recruitQueue: [...(state.recruitQueue ?? [])],
    wave: state.wave,
    waveTarget: state.waveTarget,
    phase: state.phase,
    phaseT: state.phaseT === null ? null : rounded(state.phaseT),
    spawnLeft: state.spawnLeft,
    spawnTotal: state.spawnTotal ?? 0,
    spawnT: rounded(state.spawnT),
    luoyang: {
      enabled: Boolean(state.luoyang?.enabled),
      elapsed: rounded(state.luoyang?.elapsed ?? 0),
      interval: rounded(state.luoyang?.interval ?? 0),
      generated: state.luoyang?.generated ?? 0,
      pending: Boolean(state.luoyang?.pending),
    },
    buff: state.buff ? { mult: state.buff.mult, until: rounded(state.buff.until) } : null,
    bench: state.bench.map(unitSnapshot),
    grid: state.grid.map((row) => row.map((cell) => ({
      type: cell.type,
      unit: unitSnapshot(cell.unit),
    }))),
    heroes: state.heroes.map((hero) => ({
      key: hero.key, r: hero.r, c: hero.c, level: hero.level,
      cd: rounded(hero.cd), ultCd: rounded(hero.ultCd),
    })),
    enemies: state.enemies.map((enemy) => ({
      enemyId: enemy.enemyId ?? null,
      type: enemy.type, wave: enemy.wave, lane: enemy.lane ?? 0,
      hp: rounded(enemy.hp), p: rounded(enemy.p), speed: rounded(enemy.speed),
      stun: rounded(statusRemainingForState(
        state,
        enemy.enemyId,
        'stun',
        state.time,
      )),
    })),
    projectiles: state.projectiles.map((projectile) => ({
      projectileId: projectile.projectileId ?? null,
      x: rounded(projectile.x), y: rounded(projectile.y),
      dmg: projectile.damage ?? projectile.dmg, speed: projectile.speed,
      targetEnemyId: projectile.targetEnemyId ?? projectile.target?.enemyId ?? null,
    })),
    dragons,
    statuses: skillStatus.statuses,
    nextSkillEntitySequence: skillStatus.nextEntitySequence,
    pieceRuntime: snapshotPieceRuntimeState(state),
    attributeRuntime: snapshotAttributeRuntimeState(state),
    combatRuntime: snapshotCombatRuntimeState(state),
    economyRuntime: snapshotEconomyRuntimeState(state),
    encounterRuntime: {
      nextEnemySequence: encounter.nextEnemySequence ?? 0,
      completed: Boolean(encounter.completed),
      result: encounter.result ?? null,
    },
    stats: { ...state.stats },
  };
}
