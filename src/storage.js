// localStorage 可能因隐私策略或配额抛错；内存影子保证本次会话仍可游玩。
export function createSafeStorage(primary) {
  const memory = new Map();
  let persistent = Boolean(primary);
  return {
    get persistent() { return persistent; },
    getItem(key) {
      // 一旦持久层读写失败，本会话以较新的内存影子为准，避免旧值覆盖新进度。
      if (!persistent) return memory.get(key) ?? null;
      try {
        const value = primary?.getItem(key) ?? null;
        if (value !== null) memory.set(key, String(value));
        return value ?? memory.get(key) ?? null;
      } catch {
        persistent = false;
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(key, String(value));
      try {
        if (!primary) return false;
        primary.setItem(key, String(value));
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
  };
}

export function browserStorage(scope = globalThis) {
  try { return scope.localStorage ?? null; } catch { return null; }
}
