// 运行时依赖放在 WeakMap，而不是可序列化 state 上，避免破坏存档和测试状态形状。
const runtimes = new WeakMap();

export function attachRuntime(state, runtime) {
  if (!state || typeof state !== 'object') throw new TypeError('state must be an object');
  runtimes.set(state, runtime ?? Object.freeze({}));
  return state;
}

export function runtimeFor(state) {
  return state && typeof state === 'object' ? runtimes.get(state) : undefined;
}

export function gamePackFor(state, fallback) {
  return runtimeFor(state)?.gamePack ?? fallback;
}

export function eventsFor(state) {
  return runtimeFor(state)?.events;
}

export function telemetryFor(state) {
  return runtimeFor(state)?.telemetry ?? runtimeFor(state)?.events;
}

export function domainEventsFor(state) {
  return runtimeFor(state)?.domainEvents;
}

export function presentationCuesFor(state) {
  return runtimeFor(state)?.presentationCues;
}

export function publishDomainEventFor(state, definition) {
  return runtimeFor(state)?.publishDomainEvent?.(definition, state)
    ?? runtimeFor(state)?.domainEvents?.publish?.(definition);
}

export function registryFor(state, name, fallback) {
  return runtimeFor(state)?.registries?.[name] ?? fallback;
}

export function hostFor(state) {
  return runtimeFor(state)?.host;
}

const deterministicFallbackRandom = () => 0.5;

export function randomFor(state, stream = 'gameplay', fallback = deterministicFallbackRandom) {
  return runtimeFor(state)?.random?.[stream] ?? fallback;
}
