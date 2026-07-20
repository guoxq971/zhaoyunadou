function hashSeed(value) {
  const source = String(value ?? '0');
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const RANDOM_STREAMS_API_VERSION = '1.0.0';

export function createSeededRandom(seed, restored = null) {
  const seedId = String(seed);
  let state = hashSeed(seed) || 0x6d2b79f5;
  let draws = 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    draws++;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  Object.defineProperties(random, {
    snapshot: {
      value: () => Object.freeze({
        apiVersion: RANDOM_STREAMS_API_VERSION,
        seed: seedId,
        state,
        draws,
      }),
    },
    restore: {
      value(snapshot) {
        if (!snapshot || snapshot.apiVersion !== RANDOM_STREAMS_API_VERSION
          || snapshot.seed !== seedId
          || !Number.isInteger(snapshot.state) || snapshot.state < 0 || snapshot.state > 0xffffffff
          || !Number.isInteger(snapshot.draws) || snapshot.draws < 0) {
          throw new TypeError('[random] incompatible stream snapshot');
        }
        state = snapshot.state >>> 0;
        draws = snapshot.draws;
        return true;
      },
    },
  });
  if (restored) random.restore(restored);
  return Object.freeze(random);
}

// 玩法与表现流使用不同派生 seed，互不消耗序列。
export function createRandomStreams(seed, restored = null) {
  const seedId = String(seed);
  if (restored && (restored.apiVersion !== RANDOM_STREAMS_API_VERSION || restored.seed !== seedId)) {
    throw new TypeError('[random] incompatible streams snapshot');
  }
  const gameplay = createSeededRandom(`${seedId}:gameplay`, restored?.gameplay);
  const presentation = createSeededRandom(`${seedId}:presentation`, restored?.presentation);
  return Object.freeze({
    gameplay,
    presentation,
    snapshot: () => Object.freeze({
      apiVersion: RANDOM_STREAMS_API_VERSION,
      seed: seedId,
      gameplay: gameplay.snapshot(),
      presentation: presentation.snapshot(),
    }),
    restore(snapshot) {
      if (!snapshot || snapshot.apiVersion !== RANDOM_STREAMS_API_VERSION || snapshot.seed !== seedId) {
        throw new TypeError('[random] incompatible streams snapshot');
      }
      gameplay.restore(snapshot.gameplay);
      presentation.restore(snapshot.presentation);
      return true;
    },
  });
}
