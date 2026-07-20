// 兼容门面：稳定技能 ID 与执行注册均由 Skill/Status 系统拥有。
// 删除条件：阶段 G 的 runtime/Game Pack 校验直接导入系统公共入口后移除。
export { SKILL_HANDLER_REGISTRY as SKILL_REGISTRY } from '../../systems/skill-status/index.js';
