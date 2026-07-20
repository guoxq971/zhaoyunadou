import { copyText } from '../../engine-core/public.js';
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

export function createGameViewModel(state) {
  return Object.freeze({
    screen: state.title ? 'title' : state.over ? 'result' : 'battle',
    stageIndex: state.stageIndex,
    wave: state.wave,
    lives: state.lives,
    mantou: state.mantou,
    grid: state.grid,
    bench: state.bench,
    heroes: state.heroes,
    enemies: state.enemies,
  });
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
  for (const cue of cues ?? []) if (presentSkillCue(state, cue, gamePack)) consumed++;
  return consumed;
}
