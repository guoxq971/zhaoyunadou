// 水墨粒子 / 飘字 / 弹道 / 技能演出(数据 + 更新;绘制在 render.js)
import { EFFECT_IDS, EFFECT_LIFECYCLE_REGISTRY } from './rulesets/merge-defense/effect-registry.js';
import { randomFor } from './engine-core/runtime-context.js';

const effect = (kind, values) => ({ kind, effectId: `effect.${kind}`, ...values });

export function addInk(state, x, y, color = '#1a1a1a') {
  const random = randomFor(state, 'presentation');
  for (let i = 0; i < 4; i++) {
    state.effects.push(effect(EFFECT_IDS.ink, {
      x: x + random() * 14 - 7, y: y + random() * 14 - 7,
      r: 2 + random() * 5, vx: random() * 30 - 15, vy: random() * 30 - 20,
      life: 0.5 + random() * 0.3, t: 0, color,
    }));
  }
}

export function addText(state, x, y, text, color = '#222', scale = 1, options = {}) {
  state.effects.push(effect(EFFECT_IDS.text, {
    x, y, text, color, scale,
    life: options.life ?? 1.0,
    t: -(options.delay ?? 0),
    feedbackId: options.feedbackId,
  }));
}

export function addSlash(state, x, y, ang) {
  state.effects.push(effect(EFFECT_IDS.slash, { x, y, ang, life: 0.22, t: 0 }));
}

export function addRing(state, x, y, color, maxR = 60, options = {}) {
  state.effects.push(effect(EFFECT_IDS.ring, {
    x, y, color, maxR,
    life: options.life ?? 0.5,
    t: -(options.delay ?? 0),
    feedbackId: options.feedbackId,
  }));
}

// 火龙：每个演出体只沿指定 lane 推进，伤害仍在 heroes.js 结算。
export function addDragon(state, lane = 0, options = {}) {
  state.effects.push(effect(EFFECT_IDS.dragon, {
    lane,
    p: 0,
    speed: options.speed ?? 14,
    life: options.life ?? 5,
    hitDistance: options.hitDistance ?? 1.2,
    t: 0,
    hit: new Set(),
  }));
}

export function addRain(state) {
  state.effects.push(effect(EFFECT_IDS.rain, { life: 0.8, t: 0 }));
}

export function updateEffects(state, dt) {
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const f = state.effects[i];
    const previousT = f.t;
    f.t += dt;
    // 延迟表现尚未出现时保持静止；跨过 0 的帧只消费实际可见时长。
    if (f.t < 0) continue;
    const activeDt = previousT < 0 ? f.t : dt;
    const lifecycle = EFFECT_LIFECYCLE_REGISTRY.get(f.effectId ?? `effect.${f.kind}`);
    lifecycle(f, activeDt, state);
    if (f.t >= f.life) state.effects.splice(i, 1);
  }
}
