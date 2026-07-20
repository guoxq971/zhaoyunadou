// 兼容门面：旧调用路径保留到阶段 G，新代码使用 equipment-items 公共入口。
export {
  insertGeneratedShovel as addShovelToBench,
  updateLuoyangShovel,
} from './systems/equipment-items/index.js';
