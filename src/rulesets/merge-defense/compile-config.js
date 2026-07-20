const finite = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`[merge-defense] ${label} must be finite`);
  return number;
};

const linearFormula = (spec, label) => {
  if (!spec || typeof spec !== 'object') throw new Error(`[merge-defense] missing ${label}`);
  const base = finite(spec.base, `${label}.base`);
  const perWave = finite(spec.perWave ?? spec.linear ?? 0, `${label}.perWave`);
  const quadratic = finite(spec.quadratic ?? 0, `${label}.quadratic`);
  return (index) => base + perWave * index + quadratic * index * index;
};

const steppedFormula = (spec, label) => {
  if (!spec || typeof spec !== 'object') throw new Error(`[merge-defense] missing ${label}`);
  const base = finite(spec.base, `${label}.base`);
  const step = finite(spec.step ?? 0, `${label}.step`);
  const stepEvery = finite(spec.stepEvery ?? 1, `${label}.stepEvery`);
  if (stepEvery <= 0) throw new Error(`[merge-defense] ${label}.stepEvery must be > 0`);
  return (value) => base + Math.floor(value / stepEvery) * step;
};

// 将品类规则数据编译为既有运行时代码读取的兼容视图；规则公式不下沉到 engine-core。
export function compileMergeDefenseConfig(manifests) {
  const { game, balance, levels, copy } = manifests;
  const initial = game.initialResources;
  for (const itemId of ['shovel', 'brush', 'luoyang-shovel']) {
    if (!balance.items?.[itemId]) {
      throw new Error(`[merge-defense] required item "${itemId}" is missing`);
    }
  }
  return {
    canvas: { ...game.canvas },
    board: { ...game.board },
    benchSize: game.benchSize,
    starterUnits: [...game.starterUnits],
    startMantou: initial.mantou,
    startLives: initial.lives,
    startShovels: initial.shovels,
    startBrushes: initial.brushes,
    luoyangShovel: { interval: balance.items['luoyang-shovel'].interval },
    campaign: {
      rank: copy.rank ?? copy.strings?.['campaign.rank'],
      storageKey: game.storage.progressKey,
      stages: levels.stages.map((stage) => ({ ...stage })),
    },
    recruitCost: linearFormula(balance.recruitCost, 'balance.recruitCost'),
    gachaWeights: balance.gachaWeights.map((entry) => ({ ...entry })),
    gachaPairing: { ...balance.gachaPairing },
    troops: structuredClone(balance.troops),
    levelMult: balance.levelMult,
    maxLevel: balance.maxLevel,
    heroes: Object.fromEntries(Object.entries(balance.heroes).map(([id, hero]) => [
      id,
      { ...structuredClone(hero), ult: hero.ult ?? hero.skillId },
    ])),
    ults: structuredClone(balance.skills),
    enemy: structuredClone(balance.enemy),
    waves: {
      size: linearFormula(balance.waves.size, 'balance.waves.size'),
      spawnInterval: balance.waves.spawnInterval,
      breakTime: balance.waves.breakTime,
      killReward: steppedFormula(balance.waves.killReward, 'balance.waves.killReward'),
      waveBonus: linearFormula(balance.waves.waveBonus, 'balance.waves.waveBonus'),
    },
  };
}
