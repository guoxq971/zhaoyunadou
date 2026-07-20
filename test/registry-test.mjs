import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { SKILL_REGISTRY } from '../src/rulesets/merge-defense/skill-registry.js';
import { ITEM_REGISTRY } from '../src/rulesets/merge-defense/item-registry.js';
import { EFFECT_LIFECYCLE_REGISTRY } from '../src/rulesets/merge-defense/effect-registry.js';
import {
  EFFECT_PRESENTATION_REGISTRY,
  createHeroPresentationRegistry,
} from '../src/presentation-pack/presentation-registry.js';
import { createAudioCueRegistry } from '../src/presentation-pack/audio-cue-registry.js';
import { assertRuntimeBindings } from '../src/runtime.js';

const { balance, theme, audio } = DEFAULT_GAME_PACK.manifests;
const heroPresentations = createHeroPresentationRegistry(theme);

for (const [id, skill] of Object.entries(balance.skills)) {
  assert.equal(SKILL_REGISTRY.has(skill.handlerId), true, `技能 ${id} handler 必须注册`);
}
for (const [id, item] of Object.entries(balance.items)) {
  assert.equal(ITEM_REGISTRY.has(item.behaviorId), true, `道具 ${id} behavior 必须注册`);
}
for (const [id, rendererId] of Object.entries(theme.renderers.effects)) {
  assert.equal(EFFECT_LIFECYCLE_REGISTRY.has(id), true, `效果 ${id} 生命周期必须注册`);
  assert.equal(EFFECT_PRESENTATION_REGISTRY.get(id).rendererId, rendererId, `效果 ${id} 表现绑定必须一致`);
}
for (const [id, hero] of Object.entries(balance.heroes)) {
  const presentation = heroPresentations.get(hero.renderId);
  assert.equal(presentation.weaponRendererId, theme.heroVisuals[hero.renderId].weaponRendererId, `英雄 ${id} 武器表现必须一致`);
}

const cueRegistry = createAudioCueRegistry(audio);
for (const cueId of Object.values(audio.eventMap)) assert.equal(cueRegistry.has(cueId), true);
assert.throws(() => SKILL_REGISTRY.get('skill.not-found'), /unknown id/);

{
  const manifests = structuredClone(DEFAULT_GAME_PACK.manifests);
  manifests.balance.skills.dragon.handlerId = 'skill.not-found';
  assert.throws(
    () => assertRuntimeBindings({ ...DEFAULT_GAME_PACK, manifests }),
    /balance\.skills\.dragon\.handlerId.*unknown skill id/,
  );
}

{
  const manifests = structuredClone(DEFAULT_GAME_PACK.manifests);
  delete manifests.copy.strings['map.julu.name'];
  assert.throws(
    () => assertRuntimeBindings({ ...DEFAULT_GAME_PACK, manifests }),
    /copy\.strings\.map\.julu\.name.*required copy is missing/,
  );
}

console.log('✓ 技能、道具、效果、英雄表现与音频 Cue 稳定 ID 注册表');
