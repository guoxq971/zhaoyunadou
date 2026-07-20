// 兼容门面：生产实现位于 systems/ui-interaction；旧 renderer 与测试保留原导出名。
import { CONFIG } from './config.js';
import { createSemanticLayout } from './systems/ui-interaction/index.js';

const layout = createSemanticLayout(CONFIG);

export const B = layout.board;
export const UI = layout.ui;
export const boardWidth = layout.boardWidth;
export const boardHeight = layout.boardHeight;
export const cellXY = layout.cellXY;
export const benchRect = layout.benchRect;
export const toolRect = layout.toolRect;
export const titleStageRect = layout.titleStageRect;
export const boardCell = layout.boardCell;
export const inRect = layout.inRect;
