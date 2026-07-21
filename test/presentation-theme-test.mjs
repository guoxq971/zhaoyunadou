import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import {
  PRESENTATION_THEME_API_VERSION,
  createPresentationThemeController,
} from '../src/systems/skin-presentation/index.js';

const DEFAULT_THEME_ID = 'theme.ink-board-default';
const CLOUD_THEME_ID = 'theme.cloud-arena-2-5d';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { values.set(key, String(value)); return true; },
    removeItem(key) { values.delete(key); return true; },
    values,
  };
}

assert.equal(PRESENTATION_THEME_API_VERSION, '1.0.0');
assert.equal(DEFAULT_GAME_PACK.manifests.theme.themeCatalog.defaultThemeId, DEFAULT_THEME_ID);
assert.ok(DEFAULT_GAME_PACK.manifests.theme.themeCatalog.options[CLOUD_THEME_ID]);

{
  const storage = memoryStorage();
  const controller = createPresentationThemeController({ gamePack: DEFAULT_GAME_PACK, storage });
  assert.deepEqual(controller.getSnapshot(), {
    activeThemeId: DEFAULT_THEME_ID,
    defaultThemeId: DEFAULT_THEME_ID,
    options: [
      { id: DEFAULT_THEME_ID, labelCopyId: 'title.theme.ink' },
      { id: CLOUD_THEME_ID, labelCopyId: 'title.theme.cloud' },
    ],
  });
  assert.equal(controller.getGamePack(), DEFAULT_GAME_PACK,
    '默认水墨主题必须复用原 Game Pack，避免默认画面产生隐式差异');
  assert.deepEqual(controller.select(CLOUD_THEME_ID), {
    ok: true, activeThemeId: CLOUD_THEME_ID, persisted: true,
  });
  assert.equal(storage.values.get('zyad_presentation_theme'), CLOUD_THEME_ID);
  const themedPack = controller.getGamePack();
  assert.notEqual(themedPack, DEFAULT_GAME_PACK);
  assert.equal(themedPack.config, DEFAULT_GAME_PACK.config, '主题切换不得重新编译或改写玩法配置');
  assert.equal(themedPack.manifests.balance, DEFAULT_GAME_PACK.manifests.balance);
  assert.equal(themedPack.manifests.theme.activeThemeId, CLOUD_THEME_ID);
  assert.equal(themedPack.manifests.theme.activeTheme.pieceRendererId, 'piece.calligraphy-only');
  assert.equal(themedPack.manifests.theme.colors.boardSurface, '#d9d1bd');
  assert.equal(DEFAULT_GAME_PACK.manifests.theme.activeThemeId, undefined,
    '派生主题不得污染默认 Game Pack');
  assert.deepEqual(controller.select('theme.missing'), {
    ok: false, reason: 'unknown-presentation-theme', activeThemeId: CLOUD_THEME_ID,
  });
}

{
  const storage = memoryStorage({ zyad_presentation_theme: CLOUD_THEME_ID });
  const controller = createPresentationThemeController({ gamePack: DEFAULT_GAME_PACK, storage });
  assert.equal(controller.getSnapshot().activeThemeId, CLOUD_THEME_ID,
    '合法表现偏好应从独立键恢复');
}

{
  const storage = memoryStorage({ zyad_presentation_theme: 'theme.corrupted' });
  const controller = createPresentationThemeController({ gamePack: DEFAULT_GAME_PACK, storage });
  assert.equal(controller.getSnapshot().activeThemeId, DEFAULT_THEME_ID,
    '损坏或旧主题 ID 必须安全回落默认主题');
}

{
  const controller = createPresentationThemeController({
    gamePack: DEFAULT_GAME_PACK,
    storage: {
      getItem() { throw new Error('read blocked'); },
      setItem() { throw new Error('write blocked'); },
    },
  });
  assert.equal(controller.getSnapshot().activeThemeId, DEFAULT_THEME_ID);
  assert.deepEqual(controller.select(CLOUD_THEME_ID), {
    ok: true, activeThemeId: CLOUD_THEME_ID, persisted: false,
  }, '持久化失败时本次会话仍应完成主题切换');
}

console.log('✓ 表现主题注册、独立持久化、损坏降级与玩法隔离');
