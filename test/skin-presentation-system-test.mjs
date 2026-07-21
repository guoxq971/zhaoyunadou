import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPresentationCueQueue } from '../src/engine-core/public.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { snapshotMergeDefenseCommandState } from '../src/rulesets/merge-defense/command-state.js';
import { createGame } from '../src/state.js';
import {
  consumePresentationCues,
  createLocalCommandFeedback,
  createSafeAudioAdapter,
  advanceEnemyPresentationFeedback,
  advancePresentationFeedback,
  dragonBirthPose,
  EFFECT_LIFECYCLE_REGISTRY,
  font,
  presentationFeedbackSnapshot,
  PRESENTATION_CUE_TYPES,
  renderGame,
  setEnemyBobPhase,
  SKIN_PRESENTATION_API_VERSION,
  updateEffects,
} from '../src/systems/skin-presentation/index.js';

const state = createGame(0, 0, DEFAULT_GAME_PACK);
state.title = false;
state.enemies.push({
  enemyId: 'enemy-test', type: 'normal', wave: 1, lane: 0,
  hp: 10, maxHp: 10, p: 1, speed: 1, stun: 0,
});
const attacker = state.bench.find((piece) => piece?.kind === 'troop');
const attackerCell = state.grid.flat().find((cell) => cell.type === 'open' && !cell.unit);
attackerCell.unit = attacker;
state.bench[state.bench.indexOf(attacker)] = null;
const before = snapshotMergeDefenseCommandState(state);
const queue = createPresentationCueQueue();
const publish = (type, payload) => queue.publish({
  type,
  source: 'skin-test',
  tick: 3,
  payload,
});

publish(PRESENTATION_CUE_TYPES.unitAttackStarted, {
  attackerId: attacker.pieceId, duration: 0.15,
});
publish(PRESENTATION_CUE_TYPES.combatAttack, {
  enemyId: 'enemy-test', attackerId: attacker.pieceId,
  attackKind: 'direct', damage: 12, x: 120, y: 160,
});
publish(PRESENTATION_CUE_TYPES.enemyDefeated, { enemyId: 'enemy-test', x: 120, y: 160 });
publish(PRESENTATION_CUE_TYPES.enemyLeaked, { enemyId: 'enemy-test', x: 80, y: 90 });
publish(PRESENTATION_CUE_TYPES.waveCompleted, { wave: 1, reward: 7 });
publish(PRESENTATION_CUE_TYPES.producerIncome, { pieceId: attacker.pieceId, amount: 2, x: 140, y: 180 });
publish(PRESENTATION_CUE_TYPES.itemGenerated, { itemId: 'shovel', slot: 4, generated: 1 });
publish(PRESENTATION_CUE_TYPES.projectileMissed, { projectileId: 'projectile-test', x: 200, y: 220 });
publish('presentation.unknown', {});

assert.equal(SKIN_PRESENTATION_API_VERSION, '1.0.0');
assert.equal(typeof renderGame, 'function');
assert.equal(typeof createSafeAudioAdapter, 'function');
assert.equal(typeof createLocalCommandFeedback, 'function');
const alternateFontPack = {
  manifests: { theme: { fontFamily: '"Test Theme Font",serif' } },
};
assert.equal(font(18, true, alternateFontPack), 'bold 18px "Test Theme Font",serif',
  'Renderer 字体必须由 Theme Manifest 驱动，而不是绑定默认题材字体');
assert.equal(EFFECT_LIFECYCLE_REGISTRY.has('effect.dragon'), true);
assert.equal(consumePresentationCues(state, queue.drain(), DEFAULT_GAME_PACK), 8,
  '未知 Cue 必须被明确忽略');
assert.equal(state.enemies[0].hitFlash, undefined, 'Skin 不得回写 Combat 实体');
assert.equal(attacker.flash, undefined, 'Skin 不得回写 Piece 实体');
assert.deepEqual(presentationFeedbackSnapshot(state), {
  enemyBobPhases: {},
  enemyHitFlashes: { 'enemy-test': 0.12 },
  pieceHitFlashes: { [attacker.pieceId]: 0.15 },
});
advancePresentationFeedback(state, 0.05);
assert.equal(presentationFeedbackSnapshot(state).enemyHitFlashes['enemy-test'], 0.07);
advanceEnemyPresentationFeedback(state, 0, []);
assert.deepEqual(presentationFeedbackSnapshot(state).enemyBobPhases, {});
assert.deepEqual(presentationFeedbackSnapshot(state).enemyHitFlashes, {},
  '敌人离场后必须清理表现反馈，避免缓存随累计出怪数增长');
assert.ok(state.effects.some(({ kind }) => kind === 'slash'));
assert.ok(state.effects.some(({ kind, text }) => kind === 'text' && text === '12'));
assert.ok(state.effects.some(({ feedbackId, text }) => feedbackId === 'enemy-defeated' && text === '破'));
assert.ok(state.effects.some(({ kind, text }) => kind === 'text' && text === '-1❤'));
assert.ok(state.effects.some(({ kind, text }) => kind === 'text' && text.includes('第1波克复')));
assert.ok(state.effects.some(({ kind, text }) => kind === 'text' && text === '+2'));
assert.ok(state.effects.some(({ kind, text }) => kind === 'text' && text.includes('洛阳铲产出普通铲')),
  '必须恢复候选基座原有的洛阳铲产出反馈');
assert.deepEqual(snapshotMergeDefenseCommandState(state), before,
  'PresentationCue 只能改表现切片和短暂闪白，不得改玩法哈希');

{
  const randomState = createGame(0, 0, DEFAULT_GAME_PACK, {
    gamePack: DEFAULT_GAME_PACK,
    random: { presentation: () => 0.25 },
  });
  setEnemyBobPhase(randomState, 'enemy-visual-y', 1);
  const randomCue = createPresentationCueQueue();
  randomCue.publish({
    type: 'skill.impact_feedback', source: 'skill-status', tick: 1,
    payload: {
      skillId: 'slash', effectId: 'effect.slash', enemyId: 'enemy-visual-y', x: 50, y: 60,
    },
  });
  consumePresentationCues(randomState, randomCue.drain(), DEFAULT_GAME_PACK);
  assert.equal(randomState.effects.at(-1).ang, 1.57,
    '关羽命中刀光必须继续消费一次表现随机并保持 random * 6.28');
  assert.equal(randomState.effects.at(-1).y, 60 + Math.sin(1) * 2,
    '技能只传玩法坐标，Skin 必须按 enemyId 叠加同帧 bob 视觉偏移');
}

{
  const birthState = createGame(0, 0, DEFAULT_GAME_PACK);
  birthState.title = false;
  const birthQueue = createPresentationCueQueue();
  birthQueue.publish({
    type: 'skill.cast_feedback', source: 'skill-status', tick: 8,
    payload: { heroId: 'zhaoyun', skillId: 'dragon', x: 210, y: 380 },
  });
  for (const lane of [0, 1]) {
    birthQueue.publish({
      type: 'skill.impact_feedback', source: 'skill-status', tick: 8,
      payload: {
        heroId: 'zhaoyun', skillId: 'dragon', effectId: 'effect.dragon',
        entityId: `dragon-${lane}`, castId: 'zhaoyun:8', lane,
        originX: 210, originY: 380,
      },
    });
  }
  consumePresentationCues(birthState, birthQueue.drain(), DEFAULT_GAME_PACK);
  const dragons = birthState.effects.filter(({ kind }) => kind === 'dragon');
  assert.equal(dragons.length, 2);
  assert.deepEqual(dragons.map(({ heroId, castId, originX, originY }) => (
    { heroId, castId, originX, originY }
  )), [
    { heroId: 'zhaoyun', castId: 'zhaoyun:8', originX: 210, originY: 380 },
    { heroId: 'zhaoyun', castId: 'zhaoyun:8', originX: 210, originY: 380 },
  ], '两条表现火龙必须从同一个赵云火种出生');
  assert.ok(birthState.effects.some(({ feedbackId, text }) => (
    feedbackId === 'hero-cast-title' && text === '赵云 · 火龙破阵'
  )), '赵云施法必须显示带技能名的来源文案');

  const dragonTokens = DEFAULT_GAME_PACK.manifests.theme.presentation.dragonSkill;
  const startTop = dragonBirthPose(dragons[0], {
    x: 120, y: 120, angle: 0,
  }, dragonTokens);
  const startBottom = dragonBirthPose(dragons[1], {
    x: 300, y: 560, angle: 0,
  }, dragonTokens);
  assert.deepEqual([startTop.x, startTop.y, startBottom.x, startBottom.y], [210, 380, 210, 380],
    '出生首帧双龙必须重合在赵云身上');
  assert.equal(startTop.scale, dragonTokens.startScale);
  assert.equal(startTop.bodyProgress, 0);

  updateEffects(birthState, dragonTokens.birthSeconds / 2);
  const middleTop = dragonBirthPose(dragons[0], {
    x: 120, y: 120, angle: 0,
  }, dragonTokens);
  const middleBottom = dragonBirthPose(dragons[1], {
    x: 300, y: 560, angle: 0,
  }, dragonTokens);
  assert.ok(middleTop.scale > startTop.scale && middleTop.scale < 1,
    '幼龙离开赵云时必须从小到大成长');
  assert.ok(middleTop.bodyProgress > 0 && middleTop.bodyProgress < 1);
  assert.notEqual(middleTop.y, middleBottom.y, '双路幼龙必须从同一火种向上下路线分开');

  updateEffects(birthState, dragonTokens.birthSeconds / 2);
  const fullTop = dragonBirthPose(dragons[0], {
    x: 120, y: 120, angle: 0.4,
  }, dragonTokens);
  assert.deepEqual(
    { x: fullTop.x, y: fullTop.y, scale: fullTop.scale, bodyProgress: fullTop.bodyProgress },
    { x: 120, y: 120, scale: 1, bodyProgress: 1 },
    '出生结束后必须无缝接回真实路线位置和完整龙身',
  );
}

const skinSources = await Promise.all([
  '../src/systems/skin-presentation/index.js',
  '../src/systems/skin-presentation/effect-lifecycle.js',
  '../src/presentation-pack/board-interaction-overlay.js',
  '../src/render-battle-controls.js',
  '../src/render-enemies.js',
].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
for (const source of skinSources) {
  assert.doesNotMatch(source, /classifyUnitTransfer|canMerge|rulesets\/merge-defense\/unit-placement|\.\/enemies\.js/,
    'Skin 不得反向查询玩法合法性或敌人规则门面');
}

console.log('✓ Skin/Presentation Cue 隔离、战斗反馈与洛阳铲兼容表现');
