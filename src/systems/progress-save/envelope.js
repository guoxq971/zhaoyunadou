import { SAVE_ENVELOPE_SCHEMA_VERSION, SAVE_KINDS } from './constants.js';

const SAVE_KIND_SET = new Set(Object.values(SAVE_KINDS));

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

function assertText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`[save-envelope] ${field} must be a non-empty string`);
  }
  return value;
}

function assertJsonValue(value, path = 'payload', seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`[save-envelope] ${path} must be finite`);
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`[save-envelope] ${path} is not JSON serializable`);
  if (seen.has(value)) throw new TypeError(`[save-envelope] ${path} contains a cycle`);
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError(`[save-envelope] ${path} must use plain JSON objects`);
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`, seen));
  } else {
    Object.entries(value).forEach(([key, entry]) => assertJsonValue(entry, `${path}.${key}`, seen));
  }
  seen.delete(value);
}

function assertPayload(kind, payload) {
  if (!isPlainObject(payload)) throw new TypeError('[save-envelope] payload must be an object');
  assertJsonValue(payload);
  if (kind === SAVE_KINDS.PROFILE_PROGRESS) {
    for (const field of ['clearedStars', 'bestWave']) {
      if (!Number.isInteger(payload[field]) || payload[field] < 0) {
        throw new TypeError(`[save-envelope] profile payload.${field} must be a non-negative integer`);
      }
    }
  }
  if (kind === SAVE_KINDS.MATCH_SNAPSHOT && !isPlainObject(payload.state)) {
    throw new TypeError('[save-envelope] match snapshot payload.state must be an object');
  }
  if (kind === SAVE_KINDS.REPLAY && !Array.isArray(payload.commands)) {
    throw new TypeError('[save-envelope] replay payload.commands must be an array');
  }
  return payload;
}

function identityFields(identity) {
  if (!isPlainObject(identity)) throw new TypeError('[save-envelope] identity is required');
  return {
    gameId: assertText(identity.gameId, 'gameId'),
    gameVersion: assertText(identity.gameVersion, 'gameVersion'),
    rulesetVersion: assertText(identity.rulesetVersion, 'rulesetVersion'),
    contentVersion: assertText(identity.contentVersion, 'contentVersion'),
  };
}

function assertCurrentEnvelope(envelope) {
  if (!isPlainObject(envelope)) throw new TypeError('[save-envelope] envelope must be an object');
  if (envelope.schemaVersion !== SAVE_ENVELOPE_SCHEMA_VERSION) {
    throw new TypeError('[save-envelope] unsupported schema version');
  }
  if (!SAVE_KIND_SET.has(envelope.kind)) throw new TypeError('[save-envelope] unsupported kind');
  identityFields(envelope);
  if (!Number.isInteger(envelope.revision) || envelope.revision < 0) {
    throw new TypeError('[save-envelope] revision must be a non-negative integer');
  }
  assertPayload(envelope.kind, envelope.payload);
  assertJsonValue(envelope);
  return envelope;
}

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

export function createSaveEnvelope(kind, payload, { identity, revision = 0 } = {}) {
  if (!SAVE_KIND_SET.has(kind)) throw new TypeError(`[save-envelope] unsupported kind "${kind}"`);
  const envelope = {
    schemaVersion: SAVE_ENVELOPE_SCHEMA_VERSION,
    kind,
    ...identityFields(identity),
    revision,
    payload: cloneJson(assertPayload(kind, payload)),
  };
  return Object.freeze(assertCurrentEnvelope(envelope));
}

export function createProfileProgressEnvelope(profile, options) {
  return createSaveEnvelope(SAVE_KINDS.PROFILE_PROGRESS, profile, options);
}

export function createMatchSnapshotEnvelope(snapshot, options) {
  return createSaveEnvelope(SAVE_KINDS.MATCH_SNAPSHOT, snapshot, options);
}

export function createReplayEnvelope(replay, options) {
  return createSaveEnvelope(SAVE_KINDS.REPLAY, replay, options);
}

export function encodeSaveEnvelope(envelope) {
  return JSON.stringify(assertCurrentEnvelope(envelope));
}

function migrateEnvelope(envelope, migrations) {
  const fromSchemaVersion = envelope?.schemaVersion;
  let current = envelope;
  const visited = new Set();
  for (let step = 0; current?.schemaVersion !== SAVE_ENVELOPE_SCHEMA_VERSION; step++) {
    if (step >= 16 || visited.has(current?.schemaVersion)) {
      return { ok: false, reason: 'migration-cycle' };
    }
    visited.add(current?.schemaVersion);
    const migrate = migrations?.[current?.schemaVersion];
    if (typeof migrate !== 'function') return { ok: false, reason: 'unsupported-schema-version' };
    try {
      const next = migrate(cloneJson(current));
      if (!isPlainObject(next) || next.schemaVersion === current.schemaVersion) {
        return { ok: false, reason: 'invalid-migration-result' };
      }
      current = next;
    } catch {
      return { ok: false, reason: 'migration-failed' };
    }
  }
  return {
    ok: true,
    envelope: current,
    migrated: fromSchemaVersion !== SAVE_ENVELOPE_SCHEMA_VERSION,
    fromSchemaVersion,
  };
}

export function decodeSaveEnvelope(serialized, {
  expectedKind,
  expectedGameId,
  migrations = {},
} = {}) {
  let parsed;
  try {
    parsed = typeof serialized === 'string' ? JSON.parse(serialized) : cloneJson(serialized);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  if (!isPlainObject(parsed)) return { ok: false, reason: 'invalid-envelope' };
  const migrated = migrateEnvelope(parsed, migrations);
  if (!migrated.ok) return migrated;
  try {
    assertCurrentEnvelope(migrated.envelope);
  } catch {
    return { ok: false, reason: 'invalid-envelope' };
  }
  if (expectedKind && migrated.envelope.kind !== expectedKind) {
    return { ok: false, reason: 'kind-mismatch' };
  }
  if (expectedGameId && migrated.envelope.gameId !== expectedGameId) {
    return { ok: false, reason: 'game-id-mismatch' };
  }
  return {
    ok: true,
    envelope: Object.freeze(cloneJson(migrated.envelope)),
    migrated: migrated.migrated,
    fromSchemaVersion: migrated.fromSchemaVersion,
  };
}
