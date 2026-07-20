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
  EFFECT_LIFECYCLE_REGISTRY,
  PRESENTATION_CUE_TYPES,
  renderGame,
  SKIN_PRESENTATION_API_VERSION,
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
assert.equal(EFFECT_LIFECYCLE_REGISTRY.has('effect.dragon'), true);
assert.equal(consumePresentationCues(state, queue.drain(), DEFAULT_GAME_PACK), 7,
  '未知 Cue 必须被明确忽略');
assert.equal(state.enemies[0].hitFlash, 0.12);
assert.equal(attacker.flash, 0.15);
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
