import { e2eStorageNamespace } from '../../storage.js';

export function createWebStorage(scope) {
  let backend = null;
  try { backend = scope.localStorage ?? null; } catch { backend = null; }
  return {
    get persistent() { return Boolean(backend); },
    scope: e2eStorageNamespace(scope.location?.search ?? ''),
    getItem(key) { return backend?.getItem(key) ?? null; },
    setItem(key, value) {
      if (!backend) return false;
      backend.setItem(key, String(value));
      return true;
    },
    removeItem(key) {
      if (!backend) return false;
      backend.removeItem(key);
      return true;
    },
  };
}
