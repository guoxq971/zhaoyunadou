// 兼容门面：旧调用方仍得到“抽到铲子同步增加库存”的完整装配行为。
import {
  attemptBatchRecruit as attemptEconomyBatchRecruit,
  attemptRecruit as attemptEconomyRecruit,
} from './systems/economy/index.js';
import { recordRecruitedItem } from './systems/equipment-items/index.js';

export { canStartDrag, restoreDrag } from './systems/economy/index.js';

export const attemptRecruit = (state, random, drag = null) => (
  attemptEconomyRecruit(state, random ?? Math.random, drag, { onItemRecruited: recordRecruitedItem })
);

export const attemptBatchRecruit = (state, random, drag = null) => (
  attemptEconomyBatchRecruit(
    state,
    random ?? Math.random,
    drag,
    { onItemRecruited: recordRecruitedItem },
  )
);
