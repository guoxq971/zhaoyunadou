import { createRegistry } from '../engine-core/public.js';

export function createAudioCueRegistry(audioManifest) {
  const entries = {};
  const cues = audioManifest?.cues ?? {};
  if (Array.isArray(cues)) {
    for (const cue of cues) entries[cue.id] = Object.freeze({ ...cue });
  } else {
    for (const [id, cue] of Object.entries(cues)) entries[id] = Object.freeze({ id, ...cue });
  }
  return createRegistry('audio-cue', entries);
}
