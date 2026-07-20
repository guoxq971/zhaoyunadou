import { classifyUnitTransfer, recruitCost } from '../../systems/economy/index.js';
import { routePosition } from '../../systems/board/index.js';
import { createGameViewModel, createSemanticLayout } from '../../systems/ui-interaction/index.js';

const layouts = new WeakMap();
function layoutFor(gamePack) {
  if (!layouts.has(gamePack)) layouts.set(gamePack, createSemanticLayout(gamePack.config));
  return layouts.get(gamePack);
}

function recruitPreview(state, gamePack) {
  const free = state.bench.filter((item) => item === null).length;
  let remaining = state.mantou;
  let count = 0;
  let cost = 0;
  while (count < free) {
    const next = recruitCost(state.recruitCount + count, gamePack);
    if (remaining < next) break;
    remaining -= next;
    cost += next;
    count++;
  }
  return { free, count, cost };
}

// Composition query：规则只提供可放置性与经济预览，UI 构建只读 VM，Skin 只消费 VM。
export function createMergeDefenseViewModel(state, interaction, gamePack) {
  const layout = layoutFor(gamePack);
  return createGameViewModel(state, interaction, {
    stageCount: gamePack.config.campaign.stages.length,
    benchSize: gamePack.config.benchSize,
    previewTransfer: (payload) => classifyUnitTransfer(state, payload, gamePack),
    recruitPreview: recruitPreview(state, gamePack),
    enemyPosition: (enemy) => routePosition(state, enemy, layout.cellXY),
  });
}
