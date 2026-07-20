import { gamePackFor } from '../../engine-core/public.js';

let defaultGamePack = null;

// 仅供旧 root renderer 的省略参数签名；新 Skin API 仍必须显式接收 Pack。
export function configureLegacyPresentationGamePack(gamePack) {
  if (!gamePack?.config || !gamePack?.manifests?.theme) {
    throw new TypeError('[presentation] runtime Game Pack is required');
  }
  defaultGamePack = gamePack;
  return gamePack;
}

export function resolveLegacyPresentationGamePack(state = null, explicitGamePack = null) {
  const gamePack = explicitGamePack ?? gamePackFor(state, defaultGamePack);
  if (!gamePack?.config || !gamePack?.manifests?.theme) {
    throw new Error('[presentation] no Game Pack is configured');
  }
  return gamePack;
}
