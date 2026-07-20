// 事件报告器只组装和派发纯数据；采集器可替换，不参与玩法决策。
export const REQUIRED_EVENT_IDS = Object.freeze([
  'session_start',
  'session_end',
  'stage_start',
  'stage_end',
  'recruit_attempt',
  'recruit_result',
  'deploy',
  'merge',
  'hero_unlock',
  'hero_cast',
  'wave_start',
  'wave_end',
  'enemy_leak',
  'invalid_action',
  'retry',
  'quit',
]);

const EVENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const RESERVED_FIELDS = new Set([
  'eventId',
  'eventVersion',
  'occurredAt',
  'sessionId',
  'gameVersion',
  'rulesetVersion',
  'contentVersion',
  'stage',
  'stageId',
  'stageIndex',
  'wave',
  'sessionTime',
  'resourceSnapshot',
  'stateSnapshot',
]);

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

// Collector 和测试钩子共用这个边界，避免保存可变的 state/payload 引用。
export function immutableSnapshot(value) {
  return deepFreeze(cloneValue(value));
}

function eventDefinitionsFrom(manifest) {
  if (Array.isArray(manifest)) {
    return { definitions: manifest, defaultVersion: undefined, requiredCommonFields: [] };
  }
  if (Array.isArray(manifest?.events)) {
    return {
      definitions: manifest.events,
      defaultVersion: manifest.version ?? manifest.eventVersion,
      requiredCommonFields: manifest.requiredCommonFields ?? [],
    };
  }
  throw new TypeError('[events] manifest must be an array or expose events[]');
}

function normalizedEventVersion(definition, index, defaultVersion) {
  const version = definition.version ?? definition.eventVersion ?? defaultVersion;
  if ((typeof version !== 'string' && typeof version !== 'number') || String(version).trim() === '') {
    throw new Error(`[events] events[${index}].version is required`);
  }
  return String(version);
}

// 启动时一次性验证，运行时不再每帧扫描 Manifest。
export function validateEventManifest(
  manifest,
  { requiredEventIds = REQUIRED_EVENT_IDS } = {},
) {
  const { definitions, defaultVersion, requiredCommonFields } = eventDefinitionsFrom(manifest);
  const byId = Object.create(null);

  if (!Array.isArray(requiredCommonFields)
    || requiredCommonFields.some((field) => typeof field !== 'string' || !field)) {
    throw new Error('[events] requiredCommonFields must contain field names');
  }
  if (new Set(requiredCommonFields).size !== requiredCommonFields.length) {
    throw new Error('[events] requiredCommonFields contains duplicates');
  }

  definitions.forEach((definition, index) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new TypeError(`[events] events[${index}] must be an object`);
    }
    const id = definition.id;
    if (typeof id !== 'string' || !EVENT_ID_PATTERN.test(id)) {
      throw new Error(`[events] events[${index}].id must match ${EVENT_ID_PATTERN}`);
    }
    if (definition.requiredFields !== undefined) {
      if (!Array.isArray(definition.requiredFields)
        || definition.requiredFields.some((field) => typeof field !== 'string' || !field)) {
        throw new Error(`[events] events[${index}].requiredFields must contain field names`);
      }
      if (new Set(definition.requiredFields).size !== definition.requiredFields.length) {
        throw new Error(`[events] events[${index}].requiredFields contains duplicates`);
      }
    }
    if (byId[id]) throw new Error(`[events] duplicate event id "${id}"`);
    byId[id] = immutableSnapshot({
      ...definition,
      id,
      version: normalizedEventVersion(definition, index, defaultVersion),
    });
  });

  for (const id of requiredEventIds) {
    if (!byId[id]) throw new Error(`[events] missing required event "${id}"`);
  }
  return Object.freeze(byId);
}

function requiredVersion(versions, key) {
  const value = versions?.[key];
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new Error(`[events] ${key} is required`);
  }
  return String(value);
}

function defaultSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // 降级 ID 不消耗玩法随机数，避免改变抽取或战斗序列。
  return `session-${Date.now().toString(36)}-${defaultSessionId.next++}`;
}
defaultSessionId.next = 1;

// 通用回退只识别跨品类共有的进度定位；玩法资源由 ruleset 注入 snapshotState 适配器。
export function snapshotGameState(state) {
  const stageIndex = Number.isInteger(state?.stageIndex) ? state.stageIndex : null;
  const stageId = typeof state?.stage?.id === 'string' ? state.stage.id : null;
  return immutableSnapshot({
    stage: stageId ?? (stageIndex === null ? null : stageIndex + 1),
    stageId,
    stageIndex,
    wave: Number.isFinite(Number(state?.wave)) ? Number(state.wave) : null,
    resources: {},
  });
}

function sinkEmitter(sink) {
  if (!sink) return () => undefined;
  if (typeof sink.emit === 'function') return (event) => sink.emit(event);
  if (typeof sink.collect === 'function') return (event) => sink.collect(event);
  throw new TypeError('[events] sink must expose emit(event) or collect(event)');
}

function safeSinkError(callback, error, event) {
  if (typeof callback !== 'function') return;
  try { callback(error, event); } catch { /* 平台故障不得反向中断玩法。 */ }
}

function publicPayload(details) {
  const payload = {};
  for (const [key, value] of Object.entries(details)) {
    if (!RESERVED_FIELDS.has(key) && key !== 'result' && key !== 'reason') payload[key] = value;
  }
  return payload;
}

function validateEmittedEvent(event, definition, requiredCommonFields) {
  const requiredFields = new Set([
    ...requiredCommonFields,
    ...(definition.requiredFields ?? []),
  ]);
  const missing = [...requiredFields].filter((field) => (
    !Object.prototype.hasOwnProperty.call(event, field) || event[field] === undefined
  ));
  if (missing.length > 0) {
    throw new Error(`[events] event "${event.eventId}" missing required fields: ${missing.join(', ')}`);
  }
  if (/^(?:failure|failed|lost|rejected|abandoned)$/.test(event.result) && event.reason === 'none') {
    throw new Error(`[events] event "${event.eventId}" failure reason is required`);
  }
}

export function createEventReporter({
  manifest,
  versions,
  sink = null,
  now = () => Date.now(),
  sessionId = defaultSessionId(),
  snapshotState = snapshotGameState,
  requiredEventIds = REQUIRED_EVENT_IDS,
  onSinkError = null,
} = {}) {
  if (typeof now !== 'function') throw new TypeError('[events] now must be a function');
  if (typeof snapshotState !== 'function') throw new TypeError('[events] snapshotState must be a function');
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('[events] sessionId is required');

  const definitions = validateEventManifest(manifest, { requiredEventIds });
  const { requiredCommonFields } = eventDefinitionsFrom(manifest);
  const normalizedVersions = Object.freeze({
    gameVersion: requiredVersion(versions, 'gameVersion'),
    rulesetVersion: requiredVersion(versions, 'rulesetVersion'),
    contentVersion: requiredVersion(versions, 'contentVersion'),
  });
  const deliver = sinkEmitter(sink);
  const sessionStartedAt = Number(now());

  function emit(eventId, state = null, details = {}) {
    const definition = definitions[eventId];
    if (!definition) throw new Error(`[events] unknown event "${eventId}"`);
    if (!details || typeof details !== 'object' || Array.isArray(details)) {
      throw new TypeError('[events] event details must be an object');
    }

    const occurredAt = Number(now());
    const stateSnapshot = snapshotState(state);
    const eventData = {
      eventId,
      eventVersion: definition.version,
      occurredAt,
      sessionId,
      ...normalizedVersions,
      stage: stateSnapshot?.stage ?? null,
      stageId: stateSnapshot?.stageId ?? null,
      stageIndex: stateSnapshot?.stageIndex ?? null,
      wave: stateSnapshot?.wave ?? null,
      sessionTime: Number.isFinite(occurredAt) && Number.isFinite(sessionStartedAt)
        ? Math.max(0, (occurredAt - sessionStartedAt) / 1000)
        : 0,
      resourceSnapshot: stateSnapshot?.resources ?? {},
      stateSnapshot,
      result: details.result == null ? 'success' : String(details.result),
      reason: details.reason == null ? 'none' : String(details.reason),
      ...publicPayload(details),
    };
    validateEmittedEvent(eventData, definition, requiredCommonFields);
    const event = immutableSnapshot(eventData);

    try {
      const delivered = deliver(event);
      if (delivered && typeof delivered.then === 'function') {
        delivered.catch((error) => safeSinkError(onSinkError, error, event));
      }
      return true;
    } catch (error) {
      safeSinkError(onSinkError, error, event);
      return false;
    }
  }

  return Object.freeze({
    emit,
    sessionId,
    versions: normalizedVersions,
    eventIds: Object.freeze(Object.keys(definitions)),
  });
}
