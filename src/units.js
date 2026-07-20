// 棋盘兵种:索敌、攻击、农民产馒头、弓箭弹道
import { CONFIG } from './config.js';
import { troopDmg } from './logic.js';
import { enemyXY, damageEnemy } from './enemies.js';
import { addSlash, addText, addInk } from './effects.js';

const buffMult = (state) =>
  state.buff && state.time < state.buff.until ? state.buff.mult : 1;

// 找射程内路径进度最深的敌人。返回 {e, x, y} 或 null
export function findTarget(state, cx, cy, rangeCells, cellXY) {
  const rangePx = rangeCells * CONFIG.board.cell;
  let best = null, bestP = -1;
  for (const e of state.enemies) {
    const pos = enemyXY(state, e, cellXY);
    const d = Math.hypot(pos.x - cx, pos.y - cy);
    if (d <= rangePx && e.p > bestP) { bestP = e.p; best = { e, ...pos }; }
  }
  return best;
}

export function updateUnits(state, dt, cellXY) {
  const mult = buffMult(state);
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[0].length; c++) {
      const u = state.grid[r][c].unit;
      if (!u || u.kind !== 'troop') continue;
      const t = CONFIG.troops[u.type];
      const { x, y } = cellXY(r, c);

      if (u.type === 'nong') { // 农:定时产馒头
        u.cd = (u.cd ?? t.interval) - dt;
        if (u.cd <= 0) {
          u.cd = t.interval;
          const gain = t.produce * u.level;
          state.mantou += gain;
          addText(state, x, y - 14, `+${gain}`, '#b8860b', 0.9);
        }
        continue;
      }

      u.cd = (u.cd ?? 0) - dt;
      if (u.cd > 0) continue;
      const tgt = findTarget(state, x, y, t.range, cellXY);
      if (!tgt) continue;
      u.cd = t.cd;
      u.flash = 0.15; // 渲染层用:攻击瞬间字牌抖动
      const dmg = troopDmg(u.type, u.level) * mult;
      if (t.projectile) {
        state.projectiles.push({ x, y, target: tgt.e, dmg, speed: 380 });
      } else {
        addSlash(state, tgt.x, tgt.y, Math.atan2(tgt.y - y, tgt.x - x));
        damageEnemy(state, tgt.e, dmg, cellXY);
      }
    }
  }
  // 攻击抖动衰减
  for (const row of state.grid) for (const cell of row)
    if (cell.unit?.flash > 0) cell.unit.flash -= dt;
}

export function updateProjectiles(state, dt, cellXY) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const alive = state.enemies.includes(p.target);
    const tp = alive ? enemyXY(state, p.target, cellXY) : { x: p.x, y: p.y - 40 };
    const d = Math.hypot(tp.x - p.x, tp.y - p.y);
    // 本帧行程覆盖剩余距离时直接命中，避免大 dt 下箭矢越过目标后往返振荡。
    const travel = p.speed * dt;
    if (!alive || d <= travel + 8) {
      if (alive) damageEnemy(state, p.target, p.dmg, cellXY);
      else addInk(state, p.x, p.y);
      state.projectiles.splice(i, 1);
      continue;
    }
    p.ang = Math.atan2(tp.y - p.y, tp.x - p.x);
    p.x += Math.cos(p.ang) * travel;
    p.y += Math.sin(p.ang) * travel;
  }
}
