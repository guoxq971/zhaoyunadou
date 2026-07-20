export function createWebAssetAdapter(scope, surface) {
  const cache = new Map();
  const listeners = new Map();

  function resolvePath(path, baseUrl) {
    return new scope.URL(path, baseUrl).href;
  }

  function loadImage(definition, path) {
    if (cache.has(path)) return cache.get(path);
    const image = surface.createImage();
    if (!image) {
      const unavailable = { image: null, status: 'unavailable', path, definition };
      cache.set(path, unavailable);
      return unavailable;
    }
    const asset = { image, status: 'loading', path, definition };
    const onLoad = () => { asset.status = 'ready'; };
    const onError = () => { asset.status = 'failed'; };
    image.addEventListener?.('load', onLoad);
    image.addEventListener?.('error', onError);
    listeners.set(path, { image, onLoad, onError });
    image.src = path;
    cache.set(path, asset);
    return asset;
  }

  function status(items = [...cache.values()]) {
    const assets = items.map((item) => (typeof item === 'string' ? cache.get(item) : item)).filter(Boolean);
    return {
      ready: assets.every((asset) => asset.status !== 'loading'),
      failed: assets.filter((asset) => ['failed', 'unavailable'].includes(asset.status)).length,
    };
  }

  function destroy() {
    for (const { image, onLoad, onError } of listeners.values()) {
      image.removeEventListener?.('load', onLoad);
      image.removeEventListener?.('error', onError);
    }
    listeners.clear();
    cache.clear();
  }

  return Object.freeze({ resolvePath, loadImage, status, destroy });
}
