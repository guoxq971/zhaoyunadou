export const PRESENTATION_THEME_API_VERSION = '1.0.0';

function catalogFor(gamePack) {
  const catalog = gamePack?.manifests?.theme?.themeCatalog;
  if (!catalog?.defaultThemeId || !catalog?.options?.[catalog.defaultThemeId]) {
    throw new Error('[presentation-theme] valid themeCatalog is required');
  }
  return catalog;
}

function themeSnapshot(catalog, activeThemeId) {
  return Object.freeze({
    activeThemeId,
    defaultThemeId: catalog.defaultThemeId,
    options: Object.freeze(Object.entries(catalog.options).map(([id, option]) => Object.freeze({
      id,
      labelCopyId: option.labelCopyId,
    }))),
  });
}

function deriveGamePack(gamePack, id, option) {
  const baseTheme = gamePack.manifests.theme;
  const theme = Object.freeze({
    ...baseTheme,
    colors: Object.freeze({ ...baseTheme.colors, ...(option.colorOverrides ?? {}) }),
    activeThemeId: id,
    activeTheme: option,
  });
  return Object.freeze({
    ...gamePack,
    manifests: Object.freeze({ ...gamePack.manifests, theme }),
  });
}

// 主题是本地表现偏好：不进入 GameCommand、玩法状态、回放或旧存档。
export function createPresentationThemeController({ gamePack, storage = null } = {}) {
  const catalog = catalogFor(gamePack);
  const cache = new Map([[catalog.defaultThemeId, gamePack]]);
  let activeThemeId = catalog.defaultThemeId;
  try {
    const saved = storage?.getItem?.(catalog.storageKey);
    if (saved && Object.hasOwn(catalog.options, saved)) activeThemeId = saved;
  } catch { /* 存储降级不影响本次会话使用默认主题 */ }

  function getGamePack() {
    if (!cache.has(activeThemeId)) {
      cache.set(activeThemeId, deriveGamePack(
        gamePack,
        activeThemeId,
        catalog.options[activeThemeId],
      ));
    }
    return cache.get(activeThemeId);
  }

  function select(themeId) {
    if (!Object.hasOwn(catalog.options, themeId)) {
      return Object.freeze({
        ok: false,
        reason: 'unknown-presentation-theme',
        activeThemeId,
      });
    }
    activeThemeId = themeId;
    let persisted = false;
    try { persisted = storage?.setItem?.(catalog.storageKey, themeId) === true; } catch { /* 会话切换仍生效 */ }
    return Object.freeze({ ok: true, activeThemeId, persisted });
  }

  function selectNext() {
    const ids = Object.keys(catalog.options);
    const index = ids.indexOf(activeThemeId);
    return select(ids[(index + 1) % ids.length]);
  }

  return Object.freeze({
    getGamePack,
    getSnapshot: () => themeSnapshot(catalog, activeThemeId),
    select,
    selectNext,
  });
}
