// 英雄:双格单位持续攻击 + 定时大招
import { CONFIG } from './config.js';
import { findTarget } from './units.js';
import { enemyXY, damageEnemy } from './enemies.js';
import { addSlash, addText, addInk } from './effects.js';
import { eventsFor, gamePackFor, registryFor } from './engine-core/runtime-context.js';
import { SKILL_REGISTRY } from './rulesets/merge-defense/skill-registry.js';
import { copyText } from './engine-core/copy.js';
import { addConfiguredFeedback } from './presentation-pack/feedback-effect.js';
import { resolveStat } from './systems/attribute/index.js';

export function updateHeroes(state, dt, cellXY) {
  const config = gamePackFor(state)?.config ?? CONFIG;
  const modifiers = state.buff && state.time < state.buff.until
    ? [{ id: 'liubei-aura', stat: 'damage', operation: 'multiply', value: state.buff.mult, priority: 20 }]
    : [];
  for (const h of state.heroes) {
    const cfg = config.heroes[h.key];
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
        damageEnemy(state, tgt.e, resolveStat(cfg.dmg, 'damage', modifiers, state), cellXY);
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
  const config = gamePackFor(state)?.config ?? CONFIG;
  const skillId = cfg.skillId ?? cfg.ult;
  const U = config.ults[skillId] ?? config.ults[cfg.ult];
  const handlerId = U.handlerId ?? `skill.${skillId}`;
  state.lastHeroCast = h.key;
  if (state.stats) state.stats.heroCasts = (state.stats.heroCasts ?? 0) + 1;
  const gamePack = gamePackFor(state);
  const feedback = gamePack?.manifests?.theme?.feedback?.hero_cast;
  const heroColor = feedback?.color ?? '#d8a61f';
  addConfiguredFeedback(state, feedback, {
    x: cx, y: cy, maxR: 72, life: 0.56, feedbackId: 'hero-cast-onset',
  });
  addText(state, cx, cy - 30, copyText(gamePack, 'battle.hero.cast', { heroName: cfg.name }, `【${cfg.name}】`), heroColor, 1.55, {
    life: 0.72, feedbackId: 'hero-cast-title',
  });
  const registry = registryFor(state, 'skills', SKILL_REGISTRY);
  registry.get(handlerId)({ state, hero: h, heroConfig: cfg, skill: U, cx, cy, cellXY, board: config.board });
  eventsFor(state)?.emit('hero_cast', state, {
    result: 'success', reason: 'auto-cast', heroId: h.key, skillId,
  });
}

// 火龙沿路径伤害结算(演出体在 effects 里推进)
export function updateDragonDamage(state, cellXY) {
  const config = gamePackFor(state)?.config ?? CONFIG;
  const U = config.ults.dragon;
  for (const f of state.effects) {
    if (f.kind !== 'dragon') continue;
    for (const e of [...state.enemies]) {
      // 每条火龙只结算自己所在路线，避免双路线敌人受到重复伤害。
      if ((e.lane ?? 0) !== (f.lane ?? 0)) continue;
      if (f.hit.has(e)) continue;
      if (Math.abs(e.p - f.p) < (f.hitDistance ?? U.hitDistance ?? 1.2)) {
        f.hit.add(e);
        addInk(state, ...(() => { const p = enemyXY(state, e, cellXY); return [p.x, p.y]; })(), '#c25a1a');
        damageEnemy(state, e, U.dmg, cellXY);
      }
    }
  }
}
