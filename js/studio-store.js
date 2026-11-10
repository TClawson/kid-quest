// Where the recording studio keeps a kid's mixes and takes: on this tablet only (IndexedDB),
// since a recording is big and private. Each kid has MIX_SLOTS saved mixes and one draft (the
// mix on the desk, slot 'draft'). A take is the kid's own recording: one channel of sound as
// 16-bit numbers, with its sample rate. Without IndexedDB (a private window) everything is
// kept in memory until the page closes, so the studio still works.

import { MIX_SLOTS, cleanMix, takesIn } from './studiorules.js';

const DB = 'kidquest-studio';
const memory = { mixes: new Map(), takes: new Map() };
let opening = null;

/** Sound as numbers from -1 to 1, to 16-bit numbers for keeping. */
export function floatToPcm(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767);
  return out;
}

/** And back. */
export function pcmToFloat(pcm) {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) out[i] = pcm[i] / 32767;
  return out;
}

/** The database, opened once; null when there is none to open. */
function open() {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    let req;
    try {
      req = globalThis.indexedDB.open(DB, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore('mixes');
      req.result.createObjectStore('takes').createIndex('kid', 'kid');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return opening;
}

/** Run one request on a store; resolves with its result (undefined when it fails). */
async function run(store, mode, work) {
  const db = await open();
  if (!db) return work(null);
  return new Promise((resolve) => {
    let result;
    try {
      const tx = db.transaction(store, mode);
      const req = work(tx.objectStore(store));
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

const mixKey = (kid, slot) => `${kid}|${slot}`;

/** A kid's draft and saved mixes: { draft: mix|null, slots: [mix|null × MIX_SLOTS] }, tidied. */
export async function loadMixes(kid) {
  const read = async (slot) => {
    const row = await run('mixes', 'readonly', (s) => (s ? s.get(mixKey(kid, slot)) : memory.mixes.get(mixKey(kid, slot))));
    return row?.mix ? cleanMix(row.mix) : null;
  };
  const slots = [];
  for (let i = 0; i < MIX_SLOTS; i += 1) slots.push(await read(i));
  return { draft: await read('draft'), slots };
}

/** Keep a mix in a slot (0 to MIX_SLOTS - 1, or 'draft'). */
export function saveMix(kid, slot, mix) {
  const row = { kid, slot, mix, at: Date.now() };
  return run('mixes', 'readwrite', (s) => (s ? s.put(row, mixKey(kid, slot)) : void memory.mixes.set(mixKey(kid, slot), row)));
}

/** Empty a slot. */
export function deleteMix(kid, slot) {
  return run('mixes', 'readwrite', (s) => (s ? s.delete(mixKey(kid, slot)) : void memory.mixes.delete(mixKey(kid, slot))));
}

/** Keep a take (samples from -1 to 1 at `rate`); resolves with its id. */
export async function saveTake(kid, samples, rate) {
  const id = `take-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const row = { id, kid, rate, pcm: floatToPcm(samples), at: Date.now() };
  await run('takes', 'readwrite', (s) => (s ? s.put(row, id) : void memory.takes.set(id, row)));
  return id;
}

/** A take's sound: { rate, samples } or null when it is gone. */
export async function loadTake(id) {
  const row = await run('takes', 'readonly', (s) => (s ? s.get(id) : memory.takes.get(id)));
  return row?.pcm ? { rate: row.rate, samples: pcmToFloat(row.pcm) } : null;
}

/**
 * Throw away a kid's takes that no mix uses any more (not the draft's, not a saved mix's).
 * Returns how many went.
 */
export async function sweepTakes(kid) {
  const { draft, slots } = await loadMixes(kid);
  const keep = new Set([draft, ...slots].filter(Boolean).flatMap(takesIn));
  const ids = await run('takes', 'readonly', (s) => (s ? s.index('kid').getAllKeys(kid) : [...memory.takes.values()].filter((t) => t.kid === kid).map((t) => t.id)));
  const gone = (ids || []).filter((id) => !keep.has(id));
  for (const id of gone) await run('takes', 'readwrite', (s) => (s ? s.delete(id) : void memory.takes.delete(id)));
  return gone.length;
}
