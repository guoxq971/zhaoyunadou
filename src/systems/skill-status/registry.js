import { createRegistry } from '../../engine-core/public.js';

// Manifest 绑定只需要稳定 ID 目录；真正玩法 handler 在创建 Skill/Status 系统时注入。
export const SKILL_HANDLER_IDS = Object.freeze([
  'skill.dragon',
  'skill.rain',
  'skill.shout',
  'skill.slash',
  'skill.aura',
]);

export const SKILL_HANDLER_REGISTRY = createRegistry('skill', Object.fromEntries(
  SKILL_HANDLER_IDS.map((id) => [id, Object.freeze({ id })]),
));

export function createSkillExecutionRegistry(handlers) {
  for (const id of SKILL_HANDLER_IDS) {
    if (typeof handlers[id] !== 'function') {
      throw new TypeError(`[skill-status] missing execution handler "${id}"`);
    }
  }
  for (const id of Object.keys(handlers)) {
    if (!SKILL_HANDLER_REGISTRY.has(id)) {
      throw new TypeError(`[skill-status] unknown execution handler "${id}"`);
    }
  }
  return createRegistry('skill', handlers);
}
