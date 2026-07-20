// 兼容门面：旧模块仍可读取 CONFIG，但数据唯一来源已经是默认 Game Pack。
// 新增内容应写入 games/zhaoyun-adou 的 Manifest，不再在核心代码追加题材配置。
import { DEFAULT_GAME_PACK } from './game-pack.js';

export const CONFIG = DEFAULT_GAME_PACK.config;
