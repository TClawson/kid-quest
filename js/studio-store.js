// Where the recording studio keeps a kid's mixes, takes, Note-o-Matic tunes and composing desk songs: on this tablet only (IndexedDB),
// since a recording is big and private. Each kid has MIX_SLOTS saved mixes and one draft (the
// mix on the desk, slot 'draft'). A take is the kid's own recording: one channel of sound as
// 16-bit numbers, with its sample rate. Without IndexedDB (a private window) everything is
// kept in memory until the page closes, so the studio still works.

import { MIX_SLOTS, cleanMix, takesIn } from './studiorules.js';
import { TUNE_SLOTS, cleanTune } from './tunerules.js';
import { SONG_SLOTS, cleanSong } from './composerules.js';

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

/**
 * Run one request on a store and resolve with its result. A write that fails (a full tablet)
 * rejects, so nobody is told it was kept. A read that fails resolves undefined, unless
 * `strict`: then it rejects too.
 */
async function run(store, mode, work, strict = mode === 'readwrite') {
  const db = await open();
  if (!db) return work(null);
  return new Promise((resolve, reject) => {
    let result;
    const fail = (e) => (strict ? reject(e || new Error('not kept')) : resolve(undefined));
    try {
      const tx = db.transaction(store, mode);
      const req = work(tx.objectStore(store));
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error);
    } catch (e) {
      fail(e);
    }
  });
}

const mixKey = (kid, slot) => `${kid}|${slot}`;

/** A kid's draft and saved mixes: { draft: mix|null, slots: [mix|null × MIX_SLOTS] }, tidied. */
export async function loadMixes(kid, strict = false) {
  const read = async (slot) => {
    const row = await run('mixes', 'readonly', (s) => (s ? s.get(mixKey(kid, slot)) : memory.mixes.get(mixKey(kid, slot))), strict);
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

// The Note-o-Matic's tunes (tunerules.js) sit with the mixes, under keys of their own.
const tuneKey = (kid, slot) => `${kid}|tune|${slot}`;

/** A kid's tune shelf: [tune|null × TUNE_SLOTS], tidied. */
export async function loadTunes(kid) {
  const shelf = [];
  for (let i = 0; i < TUNE_SLOTS; i += 1) {
    const row = await run('mixes', 'readonly', (s) => (s ? s.get(tuneKey(kid, i)) : memory.mixes.get(tuneKey(kid, i))));
    shelf.push(row?.tune ? cleanTune(row.tune) : null);
  }
  return shelf;
}

/** Keep a tune in a slot (0 to TUNE_SLOTS - 1). Rejects when it couldn't be kept. */
export function saveTune(kid, slot, tune) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= TUNE_SLOTS) return Promise.reject(new Error('no such slot'));
  const row = { kid, slot, tune, at: Date.now() };
  return run('mixes', 'readwrite', (s) => (s ? s.put(row, tuneKey(kid, slot)) : void memory.mixes.set(tuneKey(kid, slot), row)));
}

/** Empty a tune slot. */
export function deleteTune(kid, slot) {
  return run('mixes', 'readwrite', (s) => (s ? s.delete(tuneKey(kid, slot)) : void memory.mixes.delete(tuneKey(kid, slot))));
}

// The composing desk's songs (composerules.js) sit there too, with the desk's draft (the song
// on the desk, slot 'draft').
const songKey = (kid, slot) => `${kid}|song|${slot}`;

/** A kid's songs: { draft: song|null, shelf: [song|null × SONG_SLOTS] }, tidied. */
export async function loadSongs(kid) {
  const read = async (slot) => {
    const row = await run('mixes', 'readonly', (s) => (s ? s.get(songKey(kid, slot)) : memory.mixes.get(songKey(kid, slot))));
    return row?.song ? cleanSong(row.song) : null;
  };
  const shelf = [];
  for (let i = 0; i < SONG_SLOTS; i += 1) shelf.push(await read(i));
  return { draft: await read('draft'), shelf };
}

/** Keep a song in a slot (0 to SONG_SLOTS - 1, or 'draft'). Rejects when it couldn't be kept. */
export function saveSong(kid, slot, song) {
  if (slot !== 'draft' && (!Number.isInteger(slot) || slot < 0 || slot >= SONG_SLOTS)) return Promise.reject(new Error('no such slot'));
  const row = { kid, slot, song, at: Date.now() };
  return run('mixes', 'readwrite', (s) => (s ? s.put(row, songKey(kid, slot)) : void memory.mixes.set(songKey(kid, slot), row)));
}

/** Empty a song slot. */
export function deleteSong(kid, slot) {
  return run('mixes', 'readwrite', (s) => (s ? s.delete(songKey(kid, slot)) : void memory.mixes.delete(songKey(kid, slot))));
}

/**
 * Keep a take (samples from -1 to 1 at `rate`, with `lead` seconds of sound before its beat);
 * resolves with its id, or rejects when it couldn't be kept.
 */
export async function saveTake(kid, samples, rate, lead = 0) {
  const id = `take-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const row = { id, kid, rate, lead, pcm: floatToPcm(samples), at: Date.now() };
  await run('takes', 'readwrite', (s) => (s ? s.put(row, id) : void memory.takes.set(id, row)));
  return id;
}

/** A take's sound: { rate, samples, lead } or null when it is gone. Old takes have no lead. */
export async function loadTake(id) {
  const row = await run('takes', 'readonly', (s) => (s ? s.get(id) : memory.takes.get(id)));
  return row?.pcm ? { rate: row.rate, samples: pcmToFloat(row.pcm), lead: Number.isFinite(row.lead) ? row.lead : 0 } : null;
}

export const TAKE_GRACE = 5 * 60 * 1000; // a take this young is never swept (it may be on its way to a mix)

/**
 * Throw away a kid's takes that no mix uses any more (not the draft's, not a saved mix's,
 * not one in `keep`, and none younger than five minutes). When the mixes can't be read, it
 * keeps everything. Returns how many went.
 */
export async function sweepTakes(kid, { keep = [], now = Date.now() } = {}) {
  const { draft, slots } = await loadMixes(kid, true);
  const used = new Set([...keep, ...[draft, ...slots].filter(Boolean).flatMap(takesIn)]);
  // each take's id and age, one row at a time (a take is big)
  const rows = [];
  await run('takes', 'readonly', (s) => {
    if (!s) { for (const t of memory.takes.values()) if (t.kid === kid) rows.push({ id: t.id, at: t.at }); return undefined; }
    const req = s.index('kid').openCursor(kid);
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      rows.push({ id: c.primaryKey, at: c.value.at });
      c.continue();
    };
    return undefined;
  }, true);
  const gone = rows.filter((r) => !used.has(r.id) && !(now - (Number(r.at) || 0) < TAKE_GRACE)).map((r) => r.id);
  for (const id of gone) await run('takes', 'readwrite', (s) => (s ? s.delete(id) : void memory.takes.delete(id)));
  return gone.length;
}
