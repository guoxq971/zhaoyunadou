const requirePositiveInteger = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new TypeError(`[stage-encounter] ${label} must be a positive integer`);
  }
  return number;
};

// 敌人构成仍保留旧规则的判定顺序：关卡终将 > 每 5 波精英 > 快兵 > 坦兵 > 普通兵。
export function pickEnemyType(stage, wave, index, total) {
  if (!stage || typeof stage !== 'object') throw new TypeError('[stage-encounter] stage is required');
  const safeWave = requirePositiveInteger(wave, 'wave');
  const safeTotal = requirePositiveInteger(total, 'total');
  const safeIndex = Number(index);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= safeTotal) {
    throw new RangeError('[stage-encounter] index must address the wave formation');
  }
  const finalWave = Number(stage.waveTarget ?? stage.waveCount);
  if (safeWave === finalWave && safeIndex === safeTotal - 1) return stage.finalEnemy;
  if (safeWave % 5 === 0 && safeIndex === safeTotal - 1) return 'elite';
  const plan = stage.enemyPlan ?? { fastFromWave: 4, tankFromWave: 7 };
  if (safeWave >= plan.fastFromWave && safeIndex % 5 === 3) return 'fast';
  if (safeWave >= plan.tankFromWave && safeIndex % 6 === 4) return 'tank';
  return 'normal';
}

// Encounter 只构造可序列化的敌人初始定义；身份、存活列表和表现浮动由 Combat/Presentation 拥有。
export function createEnemySpawnDefinition({
  gamePack,
  stage,
  wave,
  type,
  index,
  laneCount,
  spawnedAt,
  enemyId,
}) {
  const enemy = gamePack?.config?.enemy;
  if (!enemy) throw new TypeError('[stage-encounter] gamePack.config.enemy is required');
  if (!stage || typeof stage !== 'object') throw new TypeError('[stage-encounter] stage is required');
  const typeConfig = enemy.types?.[type];
  if (!typeConfig) throw new RangeError(`[stage-encounter] unknown enemy type "${type}"`);
  const safeWave = requirePositiveInteger(wave, 'wave');
  const safeIndex = Number(index);
  if (!Number.isInteger(safeIndex) || safeIndex < 0) {
    throw new TypeError('[stage-encounter] index must be a non-negative integer');
  }
  const lanes = requirePositiveInteger(laneCount, 'laneCount');
  const elapsed = Number(spawnedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError('[stage-encounter] spawnedAt must be a non-negative finite number');
  }
  if (typeof enemyId !== 'string' || !/^enemy-[1-9]\d*$/.test(enemyId)) {
    throw new TypeError('[stage-encounter] enemyId must be a stable encounter identity');
  }
  const hp = Math.round(
    enemy.baseHp
      * Math.pow(enemy.hpGrowth, safeWave - 1)
      * typeConfig.hpMul
      * stage.enemyHpMul,
  );
  return {
    enemyId,
    type,
    wave: safeWave,
    hp,
    maxHp: hp,
    lane: ((safeIndex % lanes) + lanes) % lanes,
    p: 0,
    speed: enemy.baseSpeed * typeConfig.spdMul,
    stun: 0,
    spawnedAt: elapsed,
  };
}
