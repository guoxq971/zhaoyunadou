import {
  immutableData,
} from '../../engine-core/public.js';

export const CONTENT_PACK_API_VERSION = '1.0.0';

// Content Pack 定义只包含可序列化 Manifest；路径、规则编译器和具体 Pack 选择留在装配根。
export function defineContentPack(manifests) {
  if (!manifests || typeof manifests !== 'object' || Array.isArray(manifests)) {
    throw new TypeError('[content-pack] manifests object is required');
  }
  const immutableManifests = immutableData(manifests);
  return Object.freeze({
    apiVersion: CONTENT_PACK_API_VERSION,
    manifests: immutableManifests,
  });
}
