function hashSeed(value) {
  const source = String(value ?? '0');
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

// 玩法与表现流使用不同派生 seed，互不消耗序列。
export function createRandomStreams(seed) {
  return Object.freeze({
    gameplay: createSeededRandom(`${String(seed)}:gameplay`),
    presentation: createSeededRandom(`${String(seed)}:presentation`),
  });
}
