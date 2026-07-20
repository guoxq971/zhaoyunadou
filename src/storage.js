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
    removeItem(key) {
      memory.delete(key);
      try {
        if (!primary) return false;
        primary.removeItem(key);
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
  };
}

// 自动化测试可按运行号加前缀，确保同一 origin 下也不会读写玩家的正常存档。
export function createScopedStorage(storage, namespace = '') {
  const prefix = namespace ? `${String(namespace)}:` : '';
  const keyFor = (key) => `${prefix}${key}`;
  return {
    get persistent() { return storage?.persistent !== false; },
    scope: namespace || 'normal',
    getItem(key) { return storage?.getItem(keyFor(key)) ?? null; },
    setItem(key, value) { return storage?.setItem(keyFor(key), value) ?? false; },
    removeItem(key) { return storage?.removeItem(keyFor(key)) ?? false; },
  };
}

// 只要出现 e2e 参数就必须与玩家存档隔离；即使参数为空或全是中文也不能回落 normal。
export function e2eStorageNamespace(search = '') {
  const params = new URLSearchParams(search);
  if (!params.has('e2e')) return '';
  const raw = params.get('e2e') || '';
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  if (safe) return `zyad-e2e-${safe}`;
  if (!raw) return 'zyad-e2e-anonymous';
  let hash = 2166136261;
  for (const char of raw) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `zyad-e2e-run-${(hash >>> 0).toString(16)}`;
}

export function browserStorage(scope = globalThis) {
  try { return scope.localStorage ?? null; } catch { return null; }
}
