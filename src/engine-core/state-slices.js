const slicedStates = new WeakMap();

// 顶层 getter/setter 是旧调用方的兼容投影；真实可变值只存在命名切片中。
export function createSlicedState(initialState, ownership, { facades = {}, privateSlices = {} } = {}) {
  if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
    throw new TypeError('[state-slices] initialState must be an object');
  }
  if (!ownership || typeof ownership !== 'object' || Array.isArray(ownership)) {
    throw new TypeError('[state-slices] ownership must be an object');
  }
  const ownerByKey = new Map();
  const facadeKeys = new Set(Object.keys(facades));
  const slices = Object.create(null);
  for (const [sliceId, keys] of Object.entries(ownership)) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new TypeError(`[state-slices] ${sliceId} must own at least one state key`);
    }
    const slice = {};
    for (const key of keys) {
      if (ownerByKey.has(key)) throw new Error(`[state-slices] duplicate state key "${key}"`);
      if (!Object.hasOwn(initialState, key)) throw new Error(`[state-slices] missing initial state key "${key}"`);
      if (facadeKeys.has(key)) throw new Error(`[state-slices] facade key "${key}" cannot have a direct owner`);
      ownerByKey.set(key, sliceId);
      slice[key] = initialState[key];
    }
    slices[sliceId] = slice;
  }
  for (const [sliceId, slice] of Object.entries(privateSlices)) {
    if (slices[sliceId]) throw new Error(`[state-slices] duplicate state slice "${sliceId}"`);
    if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
      throw new TypeError(`[state-slices] private slice "${sliceId}" must be an object`);
    }
    slices[sliceId] = slice;
  }
  for (const key of Object.keys(initialState)) {
    if (!ownerByKey.has(key) && !facadeKeys.has(key)) {
      throw new Error(`[state-slices] state key "${key}" has no owner`);
    }
  }

  const state = {};
  for (const key of Object.keys(initialState)) {
    if (facadeKeys.has(key)) continue;
    const sliceId = ownerByKey.get(key);
    Object.defineProperty(state, key, {
      enumerable: true,
      configurable: true,
      get: () => slices[sliceId][key],
      set: (value) => { slices[sliceId][key] = value; },
    });
  }
  for (const [facadeKey, childOwners] of Object.entries(facades)) {
    const initialFacade = initialState[facadeKey];
    if (!initialFacade || typeof initialFacade !== 'object' || Array.isArray(initialFacade)) {
      throw new TypeError(`[state-slices] facade "${facadeKey}" must map an object`);
    }
    const facade = {};
    for (const childKey of Object.keys(initialFacade)) {
      const sliceId = childOwners[childKey];
      if (!slices[sliceId]) throw new Error(`[state-slices] facade "${facadeKey}.${childKey}" has unknown owner`);
      slices[sliceId][facadeKey] ??= {};
      slices[sliceId][facadeKey][childKey] = initialFacade[childKey];
      Object.defineProperty(facade, childKey, {
        enumerable: true,
        configurable: true,
        get: () => slices[sliceId][facadeKey][childKey],
        set: (value) => { slices[sliceId][facadeKey][childKey] = value; },
      });
    }
    for (const childKey of Object.keys(childOwners)) {
      if (!Object.hasOwn(initialFacade, childKey)) {
        throw new Error(`[state-slices] facade owner declared for missing key "${facadeKey}.${childKey}"`);
      }
    }
    Object.defineProperty(state, facadeKey, {
      enumerable: true,
      configurable: true,
      get: () => facade,
    });
  }
  Object.freeze(slices);
  slicedStates.set(state, slices);
  return state;
}

export function getStateSlice(state, sliceId) {
  const slice = slicedStates.get(state)?.[sliceId];
  if (!slice) throw new Error(`[state-slices] unknown state slice "${sliceId}"`);
  return slice;
}

export function hasStateSlices(state) {
  return slicedStates.has(state);
}
