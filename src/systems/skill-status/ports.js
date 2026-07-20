export const SKILL_COMBAT_PORT_API_VERSION = '1.0.0';

// Combat 仅暴露窄查询/结算端口；Skill 不持有敌人对象，也不读取 Combat 内部状态。
export const SKILL_COMBAT_PORT_METHODS = Object.freeze([
  'listEnemies',
  'findTarget',
  'positionOf',
  'damage',
  'idOf',
  'laneOf',
  'progressOf',
]);

export function assertSkillCombatPort(combat) {
  if (!combat || typeof combat !== 'object') {
    throw new TypeError('[skill-status] combat port is required');
  }
  for (const method of SKILL_COMBAT_PORT_METHODS) {
    if (typeof combat[method] !== 'function') {
      throw new TypeError(`[skill-status] combat.${method} must be a function`);
    }
  }
  return combat;
}

function publisherFunction(publisher) {
  if (typeof publisher === 'function') return publisher;
  if (publisher && typeof publisher.publish === 'function') return publisher.publish.bind(publisher);
  return null;
}

// 表现层或事件观察者失败不能反向中断确定性玩法。
export function createSafePublisher(publisher, onError = null) {
  const publish = publisherFunction(publisher);
  if (!publish) return () => undefined;
  return (message) => {
    try { return publish(message); }
    catch (error) {
      try { onError?.(error, message); }
      catch { /* observer errors are isolated */ }
      return undefined;
    }
  };
}
