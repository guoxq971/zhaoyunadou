// 对局道具：洛阳铲被动产出普通铲子；普通铲子仍由玩家拖拽使用。
import { addText } from './effects.js';

export function addShovelToBench(state) {
  const slot = state.bench.findIndex((item) => item === null);
  if (slot < 0) return { ok: false, reason: 'bench-full' };
  state.bench[slot] = { kind: 'shovel' };
  state.shovels++;
  return { ok: true, slot };
}

export function updateLuoyangShovel(state, dt) {
  const tool = state.luoyang;
  if (!tool?.enabled || dt <= 0) return null;
  tool.elapsed += dt;
  if (tool.elapsed < tool.interval) return null;

  const result = addShovelToBench(state);
  if (!result.ok) {
    // 营栏满时保留已完成的计时，空出格后立即补发，不吞掉产物。
    tool.elapsed = tool.interval;
    tool.pending = true;
    return result;
  }
  tool.elapsed -= tool.interval;
  tool.pending = false;
  tool.generated++;
  state.stats.luoyangGenerated = (state.stats.luoyangGenerated ?? 0) + 1;
  addText(state, 210, 560, '洛阳铲产出普通铲 ×1', '#a56a18', 1.1);
  return { ...result, generated: tool.generated };
}
