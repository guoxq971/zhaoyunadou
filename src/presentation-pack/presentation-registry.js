import { createRegistry } from '../engine-core/public.js';

const heroRegistryCache = new WeakMap();

// 英雄 ID 不在表现代码中枚举；新增英雄只需引用已有 renderer/weapon ID。
export function createHeroPresentationRegistry(themeManifest) {
  if (heroRegistryCache.has(themeManifest)) return heroRegistryCache.get(themeManifest);
  const entries = Object.fromEntries(Object.entries(themeManifest?.heroVisuals ?? {}).map(([id, visual]) => [
    id,
    Object.freeze({ rendererId: 'hero-card', weaponRendererId: visual.weaponRendererId }),
  ]));
  const registry = createRegistry('hero-presentation', entries);
  if (themeManifest && typeof themeManifest === 'object') heroRegistryCache.set(themeManifest, registry);
  return registry;
}

export const EFFECT_PRESENTATION_REGISTRY = createRegistry('effect-presentation', {
  'effect.ink': Object.freeze({ rendererId: 'effect.ink-splash' }),
  'effect.text': Object.freeze({ rendererId: 'effect.floating-text' }),
  'effect.slash': Object.freeze({ rendererId: 'effect.ink-slash' }),
  'effect.ring': Object.freeze({ rendererId: 'effect.expanding-ring' }),
  'effect.dragon': Object.freeze({ rendererId: 'effect.flame-dragon' }),
  'effect.rain': Object.freeze({ rendererId: 'effect.arrow-rain' }),
});

export const WEAPON_PRESENTATION_REGISTRY = createRegistry('weapon-presentation', {
  'weapon.double-swords': Object.freeze({}),
  'weapon.guandao': Object.freeze({}),
  'weapon.serpent-spear': Object.freeze({}),
  'weapon.spear': Object.freeze({}),
  'weapon.bow': Object.freeze({}),
});

export const SCENE_PRESENTATION_REGISTRY = createRegistry('scene-presentation', {
  'scene.ink-warm-title': Object.freeze({}),
  'scene.ink-warm-battle': Object.freeze({}),
  'scene.ink-warm-result': Object.freeze({}),
});

export const TROOP_PRESENTATION_REGISTRY = createRegistry('troop-presentation', {
  'card.ink-troop': Object.freeze({}),
});

export const ENEMY_PRESENTATION_REGISTRY = createRegistry('enemy-presentation', {
  'enemy.ink-normal': Object.freeze({}),
  'enemy.ink-fast': Object.freeze({}),
  'enemy.ink-tank': Object.freeze({}),
  'enemy.ink-elite': Object.freeze({}),
  'enemy.ink-boss': Object.freeze({}),
});

export const ITEM_PRESENTATION_REGISTRY = createRegistry('item-presentation', {
  'item.atlas-shovel': Object.freeze({}),
  'item.atlas-brush': Object.freeze({}),
});

export function createEffectRendererRegistry(handlers) {
  return createRegistry('effect-renderer', handlers);
}
