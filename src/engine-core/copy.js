// 文案按稳定 ID 解析；占位符替换不执行表达式或 HTML。
export function copyText(gamePack, id, values = {}, fallback) {
  const template = gamePack?.manifests?.copy?.strings?.[id];
  if (typeof template !== 'string') {
    if (fallback !== undefined) return fallback;
    throw new Error(`[copy] unknown id "${id}"`);
  }
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}
