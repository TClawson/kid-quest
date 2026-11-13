// The Note-o-Matic's ears at work away from the screen (a module Worker), so the studio keeps
// drawing while a take is listened to. listener.js does the listening.
//
// In:  { samples: Float32Array (transferred), rate, clicks: [{ at, hz }], taught (a taught piano or null) }
// Out: { progress } now and then (about 20 a run), then { notes: [{ midi, on, off, vel }] }
//      or { error: message }.
// The studio stops it with worker.terminate().

import { listen } from './listener.js';

const STEPS = 20; // progress messages a run, at most

self.onmessage = (e) => {
  const { samples, rate, clicks, taught } = e.data || {};
  let told = -1;
  const progress = (f) => {
    const step = Math.floor(Math.max(0, Math.min(1, f)) * STEPS);
    if (step <= told) return;
    told = step;
    self.postMessage({ progress: step / STEPS });
  };
  try {
    const notes = listen(samples, rate, { clicks: Array.isArray(clicks) ? clicks : [], progress, taught: taught || null });
    self.postMessage({ notes });
  } catch (err) {
    self.postMessage({ error: String(err?.message || err) });
  }
};
