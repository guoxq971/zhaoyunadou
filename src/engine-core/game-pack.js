const REQUIRED_MANIFESTS = Object.freeze([
  'game', 'balance', 'levels', 'copy', 'theme', 'assets', 'audio', 'events',
]);

function requireManifests(manifests) {
  for (const name of REQUIRED_MANIFESTS) {
    const manifest = manifests?.[name];
    if (!manifest || typeof manifest !== 'object') {
      throw new Error(`[game-pack] missing ${name} manifest`);
    }
  }
}

// engine-core 只负责组合和版本快照；品类公式由调用方传入的 ruleset compiler 解释。
export function createGamePack(manifests, { baseUrl = null, compileRuleset } = {}) {
  requireManifests(manifests);
  const { game, levels } = manifests;
  if (!game.id || !game.gameVersion || !game.ruleset?.version || !game.contentVersion) {
    throw new Error('[game-pack] game id and game/ruleset/content versions are required');
  }
  if (!Array.isArray(levels.stages) || levels.stages.length === 0) {
    throw new Error('[game-pack] levels.stages must contain at least one stage');
  }
  if (typeof compileRuleset !== 'function') {
    throw new TypeError('[game-pack] compileRuleset(manifests) is required');
  }

  const config = compileRuleset(manifests);
  if (!config || typeof config !== 'object') {
    throw new TypeError('[game-pack] ruleset compiler must return a config object');
  }
  return Object.freeze({
    id: game.id,
    baseUrl,
    versions: Object.freeze({
      gameVersion: game.gameVersion,
      rulesetVersion: game.ruleset.version,
      contentVersion: game.contentVersion,
      presentationVersion: game.presentationVersion,
    }),
    manifests: Object.freeze({ ...manifests }),
    config: Object.freeze(config),
  });
}
