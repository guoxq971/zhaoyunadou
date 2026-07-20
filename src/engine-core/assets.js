// Core 只管 Manifest 索引与缓存；路径和图片实例由 Host Adapter 提供。
export function createAssetLoader({ manifest, baseUrl, adapter = null } = {}) {
  const definitions = new Map((manifest?.assets ?? []).map((asset) => [asset.id, asset]));
  const loaded = new Map();

  function loadImage(id) {
    if (loaded.has(id)) return loaded.get(id);
    const definition = definitions.get(id);
    if (!definition) throw new Error(`[assets] unknown asset "${id}"`);
    if (definition.type !== 'image') throw new Error(`[assets] asset "${id}" is not an image`);
    let path = definition.path;
    let asset = null;
    try {
      path = adapter?.resolvePath?.(definition.path, baseUrl) ?? definition.path;
      asset = adapter?.loadImage?.(definition, path) ?? null;
    } catch {
      asset = null;
    }
    const result = asset ?? { image: null, status: 'unavailable', path, definition };
    loaded.set(id, result);
    return result;
  }

  function status(ids = [...loaded.keys()]) {
    const assets = ids.map((id) => loaded.get(id)).filter(Boolean);
    if (typeof adapter?.status === 'function') {
      try { return adapter.status(assets); } catch { /* 退回可观测的无图状态 */ }
    }
    return {
      ready: assets.every((asset) => asset.status !== 'loading'),
      failed: assets.filter((asset) => ['failed', 'unavailable'].includes(asset.status)).length,
    };
  }

  return Object.freeze({ loadImage, status, has: (id) => definitions.has(id) });
}
