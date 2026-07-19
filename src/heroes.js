// 英雄:双格单位持续攻击 + 定时大招
import { CONFIG } from './config.js';
import { findTarget } from './units.js';
import { enemyXY, damageEnemy } from './enemies.js';
import { addSlash, addText, addRing, addDragon, addRain, addInk } from './effects.js';

export function updateHeroes(state, dt, cellXY) {
  const mult = state.buff && state.time < state.buff.until ? state.buff.mult : 1;
  for (const h of state.heroes) {
    const cfg = CONFIG.heroes[h.key];
    const a = cellXY(h.r, h.c), b = cellXY(h.r, h.c + 1);
    const cx = (a.x + b.x) / 2, cy = a.y;

    // 平A
    h.cd -= dt;
    if (h.cd <= 0) {
      const tgt = findTarget(state, cx, cy, cfg.range, cellXY);
      if (tgt) {
        h.cd = cfg.cd;
        h.flash = 0.15;
        addSlash(state, tgt.x, tgt.y, Math.atan2(tgt.y - cy, tgt.x - cx));
        damageEnemy(state, tgt.e, cfg.dmg * mult, cellXY);
      }
    }
    if (h.flash > 0) h.flash -= dt;

    // 大招:有敌人才放
    h.ultCd -= dt;
    if (h.ultCd <= 0 && state.enemies.length > 0) {
      h.ultCd = cfg.ultCd;
      castUlt(state, h, cfg, cx, cy, cellXY);
    }
  }
}

function castUlt(state, h, cfg, cx, cy, cellXY) {
  const U = CONFIG.ults[cfg.ult];
  addText(state, cx, cy - 30, `【${cfg.name}】`, '#8a1f1f', 1.4);
  switch (cfg.ult) {
    case 'dragon': // 赵云:火龙贯路(伤害在 updateDragon 沿途结算)
      addDragon(state);
      break;
    case 'rain': { // 黄忠:全屏箭雨
      addRain(state);
      for (const e of [...state.enemies]) damageEnemy(state, e, U.dmg, cellXY);
      break;
    }
    case 'shout': { // 张飞:震喝眩晕
      addRing(state, cx, cy, '#5a3a1a', 240);
      for (const e of [...state.enemies]) {
        e.stun = Math.max(e.stun, U.stun);
        damageEnemy(state, e, U.dmg, cellXY);
      }
      break;
    }
    case 'slash': { // 关羽:范围横斩
      addRing(state, cx, cy, '#1f5c2e', U.range * CONFIG.board.cell);
      const rPx = U.range * CONFIG.board.cell;
      for (const e of [...state.enemies]) {
        const p = enemyXY(state, e, cellXY);
        if (Math.hypot(p.x - cx, p.y - cy) <= rPx) {
          addSlash(state, p.x, p.y, Math.random() * 6.28);
          damageEnemy(state, e, U.dmg, cellXY);
        }
      }
      break;
    }
    case 'aura': // 刘备:仁德增伤
      addRing(state, cx, cy, '#b8860b', 200);
      state.buff = { mult: U.mult, until: state.time + U.dur };
      break;
  }
}

// 火龙沿路径伤害结算(演出体在 effects 里推进)
export function updateDragonDamage(state, cellXY) {
  const U = CONFIG.ults.dragon;
  for (const f of state.effects) {
    if (f.kind !== 'dragon') continue;
    for (const e of [...state.enemies]) {
      if (f.hit.has(e)) continue;
      if (Math.abs(e.p - f.p) < 1.2) {
        f.hit.add(e);
        addInk(state, ...(() => { const p = enemyXY(state, e, cellXY); return [p.x, p.y]; })(), '#c25a1a');
        damageEnemy(state, e, U.dmg, cellXY);
      }
    }
  }
}
