// Game Pack、ruleset 注册表与平台适配器只在 composition root 连接。
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { createEventReporter } from './engine-core/events.js';
import { SKILL_REGISTRY } from './rulesets/merge-defense/skill-registry.js';
import { ITEM_REGISTRY } from './rulesets/merge-defense/item-registry.js';
import { EFFECT_LIFECYCLE_REGISTRY } from './rulesets/merge-defense/effect-registry.js';
import {
  ENEMY_PRESENTATION_REGISTRY,
  EFFECT_PRESENTATION_REGISTRY,
  ITEM_PRESENTATION_REGISTRY,
  SCENE_PRESENTATION_REGISTRY,
  TROOP_PRESENTATION_REGISTRY,
  WEAPON_PRESENTATION_REGISTRY,
  createHeroPresentationRegistry,
} from './presentation-pack/presentation-registry.js';
import { createAudioCueRegistry } from './presentation-pack/audio-cue-registry.js';
import { snapshotMergeDefenseState } from './rulesets/merge-defense/event-snapshot.js';

const requireBinding = (registry, id, path) => {
  if (!registry.has(id)) throw new Error(`[game-pack] ${path}: unknown ${registry.kind} id "${id}"`);
};

// Schema 负责形状与文件间引用；这里验证必须由 JS 实现的 ruleset/presentation 注册项。
export function assertRuntimeBindings(gamePack) {
  const { balance, theme, audio, copy, levels } = gamePack.manifests;
  for (const [id, skill] of Object.entries(balance.skills)) {
    requireBinding(SKILL_REGISTRY, skill.handlerId, `balance.skills.${id}.handlerId`);
  }
  for (const [id, item] of Object.entries(balance.items)) {
    requireBinding(ITEM_REGISTRY, item.behaviorId, `balance.items.${id}.behaviorId`);
  }
  for (const [id, rendererId] of Object.entries(theme.renderers.effects)) {
    requireBinding(EFFECT_LIFECYCLE_REGISTRY, id, `theme.renderers.effects.${id}`);
    const presentation = EFFECT_PRESENTATION_REGISTRY.get(id);
    if (presentation.rendererId !== rendererId) {
      throw new Error(`[game-pack] theme.renderers.effects.${id}: unsupported renderer "${rendererId}"`);
    }
  }
  const registryGroups = [
    ['scenes', SCENE_PRESENTATION_REGISTRY],
    ['troops', TROOP_PRESENTATION_REGISTRY],
    ['enemies', ENEMY_PRESENTATION_REGISTRY],
    ['items', ITEM_PRESENTATION_REGISTRY],
  ];
  for (const [group, registry] of registryGroups) {
    for (const [id, rendererId] of Object.entries(theme.renderers[group])) {
      requireBinding(registry, rendererId, `theme.renderers.${group}.${id}`);
    }
  }
  for (const [id, visual] of Object.entries(theme.heroVisuals)) {
    requireBinding(WEAPON_PRESENTATION_REGISTRY, visual.weaponRendererId, `theme.heroVisuals.${id}.weaponRendererId`);
  }
  const cueRegistry = createAudioCueRegistry(audio);
  for (const [eventId, cueId] of Object.entries(audio.eventMap)) {
    requireBinding(cueRegistry, cueId, `audio.eventMap.${eventId}`);
  }
  const requiredCopyIds = new Set([
    'game.title', 'campaign.rank', 'resource.protected.name',
    'battle.camp', 'battle.gate', 'battle.recruit', 'battle.benchFull',
    'battle.pause.title', 'battle.pause.hint', 'battle.wave.label',
    'battle.wave.ready', 'battle.wave.incoming', 'battle.boss.name',
    'battle.boss.incoming', 'battle.danger', 'battle.status.stunned',
    'result.victory', 'result.defeat', 'result.next', 'result.complete', 'result.retry',
    'status.title', 'status.battle', 'status.result',
    ...Object.keys(levels.maps).map((id) => `map.${id}.name`),
    ...levels.stages.map((stage) => `stage.${stage.id}.name`),
  ]);
  for (const id of requiredCopyIds) {
    if (typeof copy.strings?.[id] !== 'string') throw new Error(`[game-pack] copy.strings.${id}: required copy is missing`);
  }
  return true;
}

export function createGameRuntime(
  gamePack = DEFAULT_GAME_PACK,
  { eventSink = null, events = null, now, sessionId, onEventSinkError, host = null, random = null } = {},
) {
  assertRuntimeBindings(gamePack);
  const reporter = events ?? createEventReporter({
    manifest: gamePack.manifests.events,
    versions: gamePack.versions,
    sink: eventSink,
    ...(now ? { now } : {}),
    ...(sessionId ? { sessionId } : {}),
    snapshotState: snapshotMergeDefenseState,
    onSinkError: onEventSinkError,
  });
  return Object.freeze({
    gamePack,
    host,
    random,
    events: reporter,
    registries: Object.freeze({
      skills: SKILL_REGISTRY,
      items: ITEM_REGISTRY,
      effectLifecycles: EFFECT_LIFECYCLE_REGISTRY,
      effectPresentations: EFFECT_PRESENTATION_REGISTRY,
      heroPresentations: createHeroPresentationRegistry(gamePack.manifests.theme),
      audioCues: createAudioCueRegistry(gamePack.manifests.audio),
    }),
  });
}
