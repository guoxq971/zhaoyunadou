// 稳定 ID 注册表：Manifest 只保存 ID，具体机制由 JS handler 实现。
export function createRegistry(kind, entries = {}) {
  const values = new Map(Object.entries(entries));

  return Object.freeze({
    kind,
    has(id) {
      return values.has(id);
    },
    get(id) {
      if (!values.has(id)) throw new Error(`[registry:${kind}] unknown id "${id}"`);
      return values.get(id);
    },
    ids() {
      return [...values.keys()];
    },
  });
}
