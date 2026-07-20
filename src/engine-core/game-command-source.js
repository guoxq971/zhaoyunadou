// 兼容旧入口：这里产出的是 InputIntent，不是会修改玩法状态的 GameCommand。
// 删除条件：所有调用方改由 engine-core/public.js 的 InputIntent API 导入。
export { gameCommandFromInput, subscribeGameCommands } from './input-intent.js';
