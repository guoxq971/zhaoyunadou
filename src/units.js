// 兼容门面：攻击/弹道交由 Combat，农民产出交由 Economy。
import { CONFIG } from './config.js';
import { addInk, addSlash, addText } from './effects.js';
import { copyText, gamePackFor, randomFor, runtimeFor } from './engine-core/public.js';
import {
  enemyGameplayXY,
  findTarget as selectTarget,
  updateProjectiles as resolveProjectiles,
  updateUnits as resolveUnitAttacks,
} from './systems/combat/index.js';
import { updateProducerIncome } from './systems/economy/index.js';
import { ensureEnemyIdentity } from './enemies.js';
import {
  publishSystemDomainEvent,
  pumpSystemDomainEvents,
} from './rulesets/merge-defense/domain-event-runtime.js';

const packFor = (state) => gamePackFor(state) ?? { config: CONFIG };
const tickFor = (state) => runtimeFor(state)?.currentTick?.() ?? 0;

export function findTarget(state, cx, cy, rangeCells, cellXY) {
  return selectTarget(state, cx, cy, rangeCells, cellXY, {
    cellSize: packFor(state).config.board.cell,
  });
}

function locateAttacker(state, attackerId) {
  for (let row = 0; row < state.grid.length; row++) for (let column = 0; column < state.grid[row].length; column++) {
    const piece = state.grid[row][column].unit;
    if (piece?.pieceId === attackerId || attackerId === `legacy-piece-${row}-${column}`) return piece;
  }
  return null;
}

function combatPresentation(state, event, positions, gamePack) {
  if (event.type === 'combat.attack_resolved') {
    const point = positions.get(event.payload.enemyId) ?? { x: 0, y: 0 };
    const target = state.enemies.find(({ enemyId }) => enemyId === event.payload.enemyId);
    if (target) target.hitFlash = 0.12;
    const attacker = locateAttacker(state, event.payload.attackerId);
    if (attacker) attacker.flash = 0.15;
    if (event.payload.attackKind === 'direct') addSlash(state, point.x, point.y, 0);
    addText(state, point.x + (randomFor(state, 'presentation')() * 16 - 8), point.y - 18,
      String(Math.round(event.payload.damage)), '#222', 0.7);
    addInk(state, point.x, point.y, '#1a1a1a');
  } else if (event.type === 'combat.enemy_defeated') {
    const point = positions.get(event.payload.enemyId) ?? { x: 0, y: 0 };
    const color = gamePack?.manifests?.theme?.colors?.cinnabarPrimary ?? '#a02020';
    addText(state, point.x, point.y - 28,
      copyText(gamePack, 'battle.enemy.defeated', {}, '破'), color, 1.35,
      { life: 0.82, feedbackId: 'enemy-defeated' });
  }
}

function eventPublisher(state, cellXY, gamePack) {
  const positions = new Map(state.enemies.map((enemy) => {
    ensureEnemyIdentity(state, enemy);
    return [enemy.enemyId, enemyGameplayXY(state, enemy, cellXY)];
  }));
  return (definition) => {
    const event = publishSystemDomainEvent(state, definition, gamePack);
    combatPresentation(state, event, positions, gamePack);
    return event;
  };
}

export function updateUnits(state, dt, cellXY) {
  const gamePack = packFor(state);
  for (const enemy of state.enemies) ensureEnemyIdentity(state, enemy);
  for (const gain of updateProducerIncome(state, dt, cellXY, gamePack.config)) {
    addText(state, gain.x, gain.y - 14, `+${gain.amount}`, '#b8860b', 0.9);
  }
  const result = resolveUnitAttacks(state, dt, cellXY, {
    config: gamePack.config,
    tick: tickFor(state),
    publish: eventPublisher(state, cellXY, gamePack),
    modifiers: state.buff && state.time < state.buff.until
      ? [{
        id: 'liubei-aura', stat: 'damage', operation: 'multiply',
        value: state.buff.mult, priority: 20,
      }]
      : [],
  });
  for (const row of state.grid) for (const cell of row) {
    if (cell.unit?.flash > 0) cell.unit.flash -= dt;
  }
  pumpSystemDomainEvents(state, gamePack);
  return result;
}

export function updateProjectiles(state, dt, cellXY) {
  const gamePack = packFor(state);
  for (const enemy of state.enemies) ensureEnemyIdentity(state, enemy);
  const result = resolveProjectiles(state, dt, cellXY, {
    tick: tickFor(state),
    publish: eventPublisher(state, cellXY, gamePack),
  });
  pumpSystemDomainEvents(state, gamePack);
  return result;
}
