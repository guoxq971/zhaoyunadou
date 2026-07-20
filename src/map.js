// 旧地图入口只保留测试/兼容调用；生产状态工厂直接使用 Board 公共入口。
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { buildBoard } from './systems/board/index.js';

export function buildMap(gamePack = DEFAULT_GAME_PACK, mapId) {
  return buildBoard(gamePack, mapId);
}
