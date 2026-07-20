import { createRegistry } from '../../engine-core/registry.js';

export const EFFECT_IDS = Object.freeze({
  ink: 'ink',
  text: 'text',
  slash: 'slash',
  ring: 'ring',
  dragon: 'dragon',
  rain: 'rain',
});

export const EFFECT_LIFECYCLE_REGISTRY = createRegistry('effect-lifecycle', {
  'effect.ink': (effect, dt) => {
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;
    effect.vy += 40 * dt;
  },
  'effect.text': (effect, dt) => {
    effect.y -= 26 * dt;
  },
  'effect.slash': () => {},
  'effect.ring': () => {},
  'effect.rain': () => {},
  'effect.dragon': (effect, dt, state) => {
    const paths = Array.isArray(state.paths) && state.paths.length > 0 ? state.paths : [state.path];
    const path = paths[effect.lane ?? 0] ?? paths[0] ?? [];
    effect.p += effect.speed * dt;
    if (effect.p > path.length + 2) effect.t = effect.life;
  },
});
