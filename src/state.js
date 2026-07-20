// 对局状态工厂 —— 纯数据,渲染/输入不落这里
import { CONFIG } from './config.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import {
  attachRuntime,
  createFoundationStateSlice,
  createSlicedState,
} from './engine-core/public.js';
import { cellAt, createBoardStateSlice } from './systems/board/index.js';
import {
  createPieceStateSlice,
  ensurePieceIdentity,
} from './systems/piece/index.js';
import { createAttributeStateSlice } from './systems/attribute/index.js';
import { createEconomyStateSlice } from './systems/economy/index.js';
import { createCombatStateSlice } from './systems/combat/index.js';
import { createSkillStatusStateSlice } from './systems/skill-status/index.js';
import { createStageEncounterStateSlice } from './systems/stage-encounter/index.js';
import { createEquipmentItemsStateSlice } from './systems/equipment-items/index.js';
import { createFixedRouteMatchStateSlice } from './systems/match-mode/index.js';
import { createProgressStateSlice } from './systems/progress-save/index.js';
import { createPresentationStateSlice } from './systems/skin-presentation/index.js';

export const STATE_SLICE_KEYS = Object.freeze({
  foundation: Object.freeze(['time', 'speed', 'resumeSpeed']),
  match: Object.freeze(['title', 'resetConfirmUntil', 'resetResult', 'stageIndex', 'stage', 'over', 'win']),
  progress: Object.freeze(['clearedStars', 'saved', 'saveWarning']),
  board: Object.freeze(['grid', 'path', 'paths']),
  economy: Object.freeze(['mantou', 'recruitCount', 'recruitQueue', 'bench']),
  equipmentItems: Object.freeze(['shovels', 'brushes', 'luoyang']),
  skillStatus: Object.freeze(['heroes', 'buff', 'lastHeroUnlocked', 'lastHeroCast']),
  combat: Object.freeze(['enemies', 'projectiles']),
  presentation: Object.freeze(['effects', 'feedback']),
  encounter: Object.freeze(['lives', 'waveTarget', 'wave', 'phase', 'phaseT', 'spawnLeft', 'spawnTotal', 'spawnT']),
});

export const STATE_FACADE_OWNERS = Object.freeze({
  stats: Object.freeze({
    kills: 'combat',
    merges: 'economy',
    recruits: 'economy',
    shovelsUsed: 'equipmentItems',
    brushUses: 'equipmentItems',
    luoyangGenerated: 'equipmentItems',
    heroUnlocks: 'skillStatus',
    heroCasts: 'skillStatus',
    moves: 'board',
    swaps: 'board',
  }),
});

// 保持候选基座 JSON/Object.keys 顺序；这里只描述兼容投影，不保存任何系统初值或规则。
const LEGACY_STATE_KEY_ORDER = Object.freeze([
  'title', 'time', 'resetConfirmUntil', 'resetResult', 'speed', 'resumeSpeed',
  'mantou', 'lives', 'shovels', 'brushes', 'luoyang', 'recruitCount', 'recruitQueue',
  'stageIndex', 'stage', 'waveTarget', 'clearedStars', 'saved', 'saveWarning',
  'grid', 'path', 'paths', 'bench', 'heroes', 'enemies', 'projectiles', 'effects',
  'feedback', 'buff', 'wave', 'phase', 'phaseT', 'spawnLeft', 'spawnTotal', 'spawnT',
  'over', 'win', 'lastHeroUnlocked', 'lastHeroCast', 'stats',
]);

const STATE_OWNER_BY_KEY = new Map(Object.entries(STATE_SLICE_KEYS).flatMap(
  ([sliceId, keys]) => keys.map((key) => [key, sliceId]),
));

function composeSystemSlices(systemSlices) {
  const initialState = {};
  const stats = {};
  for (const [stat, sliceId] of Object.entries(STATE_FACADE_OWNERS.stats)) {
    if (!Object.hasOwn(systemSlices[sliceId]?.stats ?? {}, stat)) {
      throw new Error(`[state] ${sliceId} state factory must initialize stats.${stat}`);
    }
    stats[stat] = systemSlices[sliceId].stats[stat];
  }
  for (const key of LEGACY_STATE_KEY_ORDER) {
    if (key === 'stats') {
      initialState.stats = stats;
      continue;
    }
    const sliceId = STATE_OWNER_BY_KEY.get(key);
    if (!sliceId || !Object.hasOwn(systemSlices[sliceId] ?? {}, key)) {
      throw new Error(`[state] ${sliceId ?? 'unknown'} state factory must initialize ${key}`);
    }
    initialState[key] = systemSlices[sliceId][key];
  }
  const sliceExtensions = {};
  for (const [sliceId, slice] of Object.entries(systemSlices)) {
    const publicKeys = new Set([...(STATE_SLICE_KEYS[sliceId] ?? []), 'stats']);
    const extension = Object.fromEntries(
      Object.entries(slice).filter(([key]) => !publicKeys.has(key)),
    );
    if (Object.keys(extension).length > 0) sliceExtensions[sliceId] = extension;
  }
  return { initialState, sliceExtensions };
}

export function createGame(stageIndex = 0, clearedStars = 0, gamePack = DEFAULT_GAME_PACK, runtime) {
  const effectiveGamePack = gamePack?.config ? gamePack : DEFAULT_GAME_PACK;
  const config = effectiveGamePack.config ?? CONFIG;
  const match = createFixedRouteMatchStateSlice({ stageIndex, gamePack: effectiveGamePack });
  const systemSlices = {
    foundation: createFoundationStateSlice(),
    match,
    progress: createProgressStateSlice({
      clearedStars,
      stageCount: config.campaign.stages.length,
    }),
    board: createBoardStateSlice(effectiveGamePack, match.stage.mapId),
    economy: createEconomyStateSlice({ config, stage: match.stage }),
    equipmentItems: createEquipmentItemsStateSlice({ config }),
    skillStatus: createSkillStatusStateSlice(),
    combat: createCombatStateSlice(),
    presentation: createPresentationStateSlice(),
    encounter: createStageEncounterStateSlice({ config, stage: match.stage }),
  };
  const { initialState, sliceExtensions } = composeSystemSlices(systemSlices);
  const state = createSlicedState(initialState, STATE_SLICE_KEYS, {
    facades: STATE_FACADE_OWNERS,
    privateSlices: {
      pieces: createPieceStateSlice(),
      attributes: createAttributeStateSlice(),
    },
    sliceExtensions,
  });
  state.bench.forEach((piece, index) => {
    if (piece) ensurePieceIdentity(state, piece, { zone: 'bench', index });
  });
  const context = runtime?.gamePack ? runtime : { ...(runtime ?? {}), gamePack: effectiveGamePack };
  return attachRuntime(state, context);
}

export { cellAt };
