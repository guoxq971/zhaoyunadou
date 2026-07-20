import { copyText, randomFor } from '../../engine-core/public.js';
import {
  addDragon,
  addInk,
  addRain,
  addRing,
  addSlash,
  addText,
} from '../../effects.js';
import { addConfiguredFeedback } from '../../presentation-pack/feedback-effect.js';

export const SKIN_PRESENTATION_API_VERSION = '1.0.0';

export const PRESENTATION_CUE_TYPES = Object.freeze({
  combatAttack: 'combat.attack_feedback',
  enemyDefeated: 'combat.enemy_defeated_feedback',
  enemyLeaked: 'combat.enemy_leaked_feedback',
  waveCompleted: 'encounter.wave_completed_feedback',
  producerIncome: 'economy.producer_income_feedback',
  itemGenerated: 'equipment.item_generated_feedback',
  projectileMissed: 'combat.projectile_missed_feedback',
});

function locatePiece(state, pieceId) {
  if (!pieceId) return null;
  for (let row = 0; row < (state.grid?.length ?? 0); row++) {
    for (let column = 0; column < state.grid[row].length; column++) {
      const piece = state.grid[row][column].unit;
      if (piece?.pieceId === pieceId || pieceId === `legacy-piece-${row}-${column}`) return piece;
    }
  }
  return null;
}

function presentBattleCue(state, cue, gamePack) {
  const payload = cue.payload;
  if (cue.type === PRESENTATION_CUE_TYPES.combatAttack) {
    const target = state.enemies?.find(({ enemyId }) => enemyId === payload.enemyId);
    if (target) target.hitFlash = 0.12;
    const attacker = locatePiece(state, payload.attackerId);
    if (attacker) attacker.flash = 0.15;
    if (payload.attackKind === 'direct') addSlash(state, payload.x, payload.y, payload.angle ?? 0);
    addText(
      state,
      payload.x + (randomFor(state, 'presentation')() * 16 - 8),
      payload.y - 18,
      String(Math.round(payload.damage)),
      '#222',
      0.7,
    );
    addInk(state, payload.x, payload.y, '#1a1a1a');
    return true;
  }
  if (cue.type === PRESENTATION_CUE_TYPES.enemyDefeated) {
    const color = gamePack?.manifests?.theme?.colors?.cinnabarPrimary ?? '#a02020';
    addText(
      state,
      payload.x,
      payload.y - 28,
      copyText(gamePack, 'battle.enemy.defeated', {}, '破'),
      color,
      1.35,
      { life: 0.82, feedbackId: 'enemy-defeated' },
    );
    return true;
  }
  if (cue.type === PRESENTATION_CUE_TYPES.enemyLeaked) {
    addInk(state, payload.x, payload.y, '#a02020');
    addText(
      state,
      payload.x,
      payload.y - 20,
      copyText(gamePack, 'battle.enemy.leak', {}, '-1❤'),
      '#c03030',
      1.2,
    );
    return true;
  }
  if (cue.type === PRESENTATION_CUE_TYPES.waveCompleted) {
    addText(
      state,
      210,
      400,
      copyText(gamePack, 'battle.wave.cleared', {
        wave: payload.wave,
        reward: payload.reward,
      }, `第${payload.wave}波克复 +${payload.reward}馒头`),
      '#8a6d3b',
      1.6,
    );
    return true;
  }
  if (cue.type === PRESENTATION_CUE_TYPES.producerIncome) {
    addText(state, payload.x, payload.y - 14, `+${payload.amount}`, '#b8860b', 0.9);
    return true;
  }
  if (cue.type === PRESENTATION_CUE_TYPES.itemGenerated) {
    addText(
      state,
      210,
      560,
      copyText(gamePack, 'battle.shovel.generated', {}, '洛阳铲产出普通铲 ×1'),
      '#a56a18',
      1.1,
    );
    return true;
  }
  if (cue.type === PRESENTATION_CUE_TYPES.projectileMissed) {
    addInk(state, payload.x, payload.y);
    return true;
  }
  return false;
}

function presentSkillCue(state, cue, gamePack) {
  const payload = cue.payload;
  if (cue.type === 'skill.cast_feedback') {
    const feedback = gamePack.manifests.theme.feedback?.hero_cast;
    const hero = gamePack.config.heroes[payload.heroId];
    addConfiguredFeedback(state, feedback, {
      x: payload.x, y: payload.y, maxR: 72, life: 0.56, feedbackId: 'hero-cast-onset',
    });
    addText(state, payload.x, payload.y - 30,
      copyText(gamePack, 'battle.hero.cast', { heroName: hero?.name }, `【${hero?.name ?? payload.heroId}】`),
      feedback?.color ?? '#d8a61f', 1.55,
      { life: 0.72, feedbackId: 'hero-cast-title' });
    return true;
  }
  if (cue.type !== 'skill.impact_feedback') return false;
  const { effectId, skillId } = payload;
  if (effectId === 'effect.dragon' && payload.phase !== 'end') {
    const skill = gamePack.config.ults.dragon;
    addDragon(state, payload.lane, {
      entityId: payload.entityId,
      speed: skill.effectSpeed,
      life: skill.effectLife,
      hitDistance: skill.hitDistance,
    });
  } else if (effectId === 'effect.rain') addRain(state);
  else if (effectId === 'effect.slash') addSlash(state, payload.x, payload.y, payload.angle ?? 0);
  else if (effectId === 'effect.ink') {
    addInk(state, payload.x, payload.y, '#c25a1a');
    const dragon = state.effects.find((effect) => (
      effect.kind === 'dragon' && effect.entityId === payload.entityId
    ));
    dragon?.hit?.add(payload.enemyId);
  }
  else if (effectId === 'effect.ring') {
    const colors = { shout: '#5a3a1a', slash: '#1f5c2e', aura: '#b8860b' };
    addRing(state, payload.x, payload.y, colors[skillId] ?? '#b8860b', payload.radius ?? 200);
  }
  return true;
}

export function consumePresentationCues(state, cues, gamePack) {
  let consumed = 0;
  for (const cue of cues ?? []) {
    if (presentSkillCue(state, cue, gamePack) || presentBattleCue(state, cue, gamePack)) consumed++;
  }
  return consumed;
}

// 表现系统的唯一公开入口；根目录文件在物理搬迁前仍是同一系统的实现文件。
export { createGameViewModel } from '../ui-interaction/index.js';
export { createSafeAudioAdapter } from '../../audio.js';
export {
  addDragon,
  addInk,
  addRain,
  addRing,
  addSlash,
  addText,
  updateEffects,
} from '../../effects.js';
export {
  assetsFor,
  getAssetStatus,
  presentationTokens,
  releasePresentationResources,
  themeColors,
} from '../../render-theme.js';
export { render as renderGame } from '../../render.js';
export { createLocalCommandFeedback } from '../../presentation-pack/local-command-feedback.js';
export { createAudioCueRegistry } from '../../presentation-pack/audio-cue-registry.js';
export {
  EFFECT_PRESENTATION_REGISTRY,
  ENEMY_PRESENTATION_REGISTRY,
  ITEM_PRESENTATION_REGISTRY,
  SCENE_PRESENTATION_REGISTRY,
  TROOP_PRESENTATION_REGISTRY,
  WEAPON_PRESENTATION_REGISTRY,
  createEffectRendererRegistry,
  createHeroPresentationRegistry,
} from '../../presentation-pack/presentation-registry.js';
export { EFFECT_LIFECYCLE_REGISTRY } from './effect-lifecycle.js';
