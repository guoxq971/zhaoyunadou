import { assertSerializableData, assertStableId, immutableData } from './serializable-data.js';

export const PRESENTATION_CUE_API_VERSION = '1.0.0';
export const PRESENTATION_CUE_PROTOCOL = 'presentation-cue';

export function createPresentationCueQueue({ limit = 256, initialSequence = 0 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('[presentation-cue] limit must be positive');
  const cues = [];
  let sequence = initialSequence;
  let dropped = 0;

  function publish({ type, source, tick, payload = {} } = {}) {
    assertStableId(type, 'type');
    assertStableId(source, 'source');
    if (!Number.isInteger(tick) || tick < 0) throw new TypeError('[presentation-cue] tick must be a non-negative integer');
    assertSerializableData(payload);
    const cue = immutableData({
      apiVersion: PRESENTATION_CUE_API_VERSION,
      protocol: PRESENTATION_CUE_PROTOCOL,
      type,
      source,
      sequence: ++sequence,
      tick,
      payload,
    });
    cues.push(cue);
    if (cues.length > limit) {
      cues.splice(0, cues.length - limit);
      dropped++;
    }
    return cue;
  }

  const snapshot = () => Object.freeze([...cues]);
  return Object.freeze({
    publish,
    peek: snapshot,
    drain() { const drained = snapshot(); cues.length = 0; return drained; },
    clear() { cues.length = 0; },
    get size() { return cues.length; },
    get sequence() { return sequence; },
    get dropped() { return dropped; },
  });
}
