// 兼容门面：Board 负责校验/占用原子提交，Piece 负责身份/升级；合成编排待阶段 D 迁入 Economy。
import {
  classifyTransfer,
  commitAtomicTransfer,
  commitMergeOccupancy,
  inspectTransfer,
  itemAtLocation,
  transferDomainEvent,
} from '../../systems/board/index.js';
import {
  ensurePieceIdentity,
  isMovablePiece,
  pieceSignature,
  pieceUpgradedDomainEvent,
  upgradePiece,
} from '../../systems/piece/index.js';
import { canMerge } from '../../logic.js';
import { publishDomainEventFor } from '../../engine-core/runtime-context.js';

export const isMovableUnit = isMovablePiece;
export const itemSignature = pieceSignature;

const optionsFor = (gamePack) => ({
  canCombine: (target, source) => canMerge(target, source, gamePack),
});

export function classifyUnitTransfer(state, command, gamePack) {
  return classifyTransfer(state, command, optionsFor(gamePack));
}

export function applyUnitTransfer(state, command, gamePack, tick = 0) {
  const plan = inspectTransfer(state, command, optionsFor(gamePack));
  if (!plan.ok) return plan;
  // 手写旧状态可能没有 pieceId；完整校验后、原子提交前统一正规化。
  ensurePieceIdentity(state, plan.sourceItem, command.source);
  if (plan.targetItem) ensurePieceIdentity(state, plan.targetItem, command.target);
  const committed = plan.action === 'merge'
    ? commitMergeOccupancy(plan)
    : commitAtomicTransfer(plan);
  if (!committed.ok) return committed;
  if (plan.action === 'merge') {
    upgradePiece(plan.targetItem);
    state.stats.merges++;
    publishDomainEventFor(state, pieceUpgradedDomainEvent(plan.targetItem, tick));
  } else {
    publishDomainEventFor(state, transferDomainEvent(plan, tick));
  }
  return {
    ok: true,
    reason: 'none',
    action: plan.action,
    source: command.source,
    target: command.target,
    itemKind: plan.sourceItem.kind,
    itemId: plan.sourceItem.type ?? plan.sourceItem.char,
    level: plan.action === 'merge' ? plan.targetItem.level : plan.sourceItem.level ?? 1,
  };
}

export { itemAtLocation };
