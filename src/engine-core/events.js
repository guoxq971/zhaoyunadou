// 旧入口仅为兼容既有调用方；Telemetry 的真实实现属于 platform-services。
// 删除条件：生产与测试调用方全部改由 platform-services/public.js 导入。
export {
  REQUIRED_EVENT_IDS,
  createTelemetryReporter as createEventReporter,
  immutableSnapshot,
  snapshotGameState,
  validateEventManifest,
} from '../platform-services/public.js';
