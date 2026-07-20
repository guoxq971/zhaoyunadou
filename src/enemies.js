// 波次生成 + 敌人沿路径移动 + 到达扣命
import { CONFIG } from './config.js';
import { addInk, addText } from './effects.js';

// 每波兵种构成
function pickType(state, wave, idx, total) {
  if (wave === state.waveTarget && idx === total - 1) return state.stage.finalEnemy;
  if (wave % 5 === 0 && idx === total - 1) return 'elite';
  const plan = state.stage.enemyPlan ?? { fastFromWave: 4, tankFromWave: 7 };
  if (wave >= plan.fastFromWave && idx % 5 === 3) return 'fast';
  if (wave >= plan.tankFromWave && idx % 6 === 4) return 'tank';
  return 'normal';
}

// 新状态使用 paths；旧存档/单元测试仍可只提供 path。
function availablePaths(state) {
  if (Array.isArray(state.paths) && state.paths.length > 0) return state.paths;
  return Array.isArray(state.path) ? [state.path] : [];
}

function pathForEnemy(state, enemy) {
  const paths = availablePaths(state);
  return paths[enemy?.lane ?? 0] ?? paths[0] ?? [];
}

export function spawnEnemy(state, type, idx = state.enemies.length) {
  const E = CONFIG.enemy, t = E.types[type];
  const hp = Math.round(E.baseHp * Math.pow(E.hpGrowth, state.wave - 1) * t.hpMul * state.stage.enemyHpMul);
  const pathCount = Math.max(1, availablePaths(state).length);
  state.enemies.push({
    type, wave: state.wave, hp, maxHp: hp,
    lane: ((idx % pathCount) + pathCount) % pathCount, // 同波敌军按序上下路交替。
    p: 0,                       // 路径进度(格),浮点
    speed: E.baseSpeed * t.spdMul,
    stun: 0, bob: Math.random() * 6.28,
    spawnedAt: state.time,
  });
}

export function updateWaves(state, dt) {
  const W = CONFIG.waves;
  if (state.phase === 'break') {
    if (state.phaseT === null) return;
    state.phaseT -= dt;
    if (state.phaseT <= 0) {
      state.wave++;
      state.phase = 'wave';
      state.spawnLeft = W.size(state.wave);
      state.spawnTotal = state.spawnLeft;
      state.spawnT = 0;
    }
    return;
  }
  // wave 阶段:按间隔出兵
  if (state.spawnLeft > 0) {
    state.spawnT -= dt;
    if (state.spawnT <= 0) {
      const idx = state.spawnTotal - state.spawnLeft;
      spawnEnemy(state, pickType(state, state.wave, idx, state.spawnTotal), idx);
      state.spawnLeft--;
      state.spawnT = W.spawnInterval;
    }
  } else if (state.enemies.length === 0) {
    // 本波清空
    state.mantou += W.waveBonus(state.wave);
    addText(state, 210, 400, `第${state.wave}波克复 +${W.waveBonus(state.wave)}馒头`, '#8a6d3b', 1.6);
    if (state.wave >= state.waveTarget) { state.over = true; state.win = true; return; }
    state.phase = 'break';
    state.phaseT = W.breakTime;
  }
}

export function updateEnemies(state, dt, cellXY) {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const path = pathForEnemy(state, e);
    const endP = path.length - 1;
    if (endP < 0) continue;
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    e.p += e.speed * dt;
    e.bob += dt * 8;
    if (e.p >= endP) {
      state.enemies.splice(i, 1);
      state.lives = Math.max(0, state.lives - 1);
      const { x, y } = cellXY(path[endP].r, path[endP].c);
      addInk(state, x, y, '#a02020');
      addText(state, x, y - 20, '-1❤', '#c03030', 1.2);
      if (state.lives <= 0) { state.over = true; state.win = false; }
    }
  }
}

// 敌人当前像素坐标(供渲染与索敌)
export function enemyXY(state, e, cellXY) {
  const path = pathForEnemy(state, e);
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return cellXY(path[0].r, path[0].c);
  const i = Math.max(0, Math.min(Math.floor(e.p), path.length - 2));
  const f = Math.max(0, Math.min(e.p - i, 1));
  const a = path[i], b = path[i + 1];
  const pa = cellXY(a.r, a.c), pb = cellXY(b.r, b.c);
  return { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f + Math.sin(e.bob) * 2 };
}

export function damageEnemy(state, e, dmg, cellXY) {
  e.hp -= dmg;
  e.hitFlash = 0.12;
  const { x, y } = enemyXY(state, e, cellXY);
  addText(state, x + (Math.random() * 16 - 8), y - 18, String(Math.round(dmg)), '#222', 0.7);
  addInk(state, x, y, '#1a1a1a');
  if (e.hp <= 0) {
    addText(state, x, y - 28, '破', '#a02020', 1.15);
    const idx = state.enemies.indexOf(e);
    if (idx >= 0) state.enemies.splice(idx, 1);
    state.stats.kills++;
    state.mantou += CONFIG.waves.killReward(e.wave);
  }
}
