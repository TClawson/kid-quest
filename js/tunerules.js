// The Note-o-Matic's tunes: what the robot heard a kid play, in the reading the kid picked,
// kept on the tablet (studio-store.js) on a shelf of TUNE_SLOTS. Pure rules, no screen.
//
// A tune is { v: 1, id, made (ms), reading: 'heard'|'tidy'|'band', bpm, meter (3|4), key,
// beats, parts: [{ role: 'tune'|'band', notes: [{ at, len, midi }] (steps: eighths at bpm),
// beats, follows }], voice (a studiokit voice the tune part plays in), shift (semitones) }.

import { READINGS } from './notomatic.js';
import { VOICES } from './studiokit.js';
import { LOWEST, HIGHEST, MOST_SHIFT } from './remix.js';
import { BPM_RANGE, MOST_NOTES, NOTES_VOICE, READING_VOICES, mostNotesBeats, validKey } from './studiorules.js';

export const TUNE_SLOTS = 6;
/** A tune keeps its own speed, slow playing too (notomatic.js tuneReadings hears 40 and up). */
export const TUNE_BPM = [40, 170];
/** How much Slower and Faster change a tune's speed on the robot's screen (beats a minute). */
export const TUNE_STEP = 6;

/**
 * A tune's speed one step slower (d -1) or faster (d 1), kept inside TUNE_BPM. The steps sit
 * on the speed the robot `found` and every TUNE_STEP from it, so the kid can always get back
 * to it; from an end of TUNE_BPM (a speed off those steps) a tap goes to the nearest step the
 * other way.
 */
export function stepSpeed(bpm, d, found = bpm) {
  const b = Math.round(bpm);
  const f = Math.round(found);
  const s = Math.sign(d);
  const k = s > 0 ? Math.floor((b - f) / TUNE_STEP) + 1 : s < 0 ? Math.ceil((b - f) / TUNE_STEP) - 1 : (b - f) / TUNE_STEP;
  const to = s ? f + k * TUNE_STEP : b;
  return Math.max(TUNE_BPM[0], Math.min(TUNE_BPM[1], to));
}
const READING_IDS = READINGS.map((r) => r.id);

/** The voice a reading's tune starts in. */
export const startVoice = (readingId) => READING_VOICES[readingId]?.tune || NOTES_VOICE;

/** A reading's name for a kid ("Tidied"). */
export const readingName = (readingId) => READINGS.find((r) => r.id === readingId)?.name || 'Tune';

/** Lowest and highest note of a tune's parts (null when there are none). */
export function tuneSpan(parts) {
  let low = Infinity; let high = -Infinity;
  for (const p of parts || []) for (const n of p.notes || []) { low = Math.min(low, n.midi); high = Math.max(high, n.midi); }
  return Number.isFinite(low) ? { low, high } : null;
}

/** Whether the tune part (parts[0]) can be moved by `shift` semitones and still play every note. */
export function shiftFits(parts, shift) {
  const span = tuneSpan(parts?.slice(0, 1));
  return Math.abs(shift) <= MOST_SHIFT && (!span || (span.low + shift >= LOWEST && span.high + shift <= HIGHEST));
}

const cleanPart = (p, most) => {
  if (!p || typeof p !== 'object' || (p.role !== 'tune' && p.role !== 'band') || !Array.isArray(p.notes)) return null;
  // how long it is: as stored, or else as long as its notes (steps are eighths: two a beat)
  let given = p.beats === null || p.beats === undefined || p.beats === '' ? NaN : Number(p.beats);
  if (!Number.isFinite(given) || given <= 0) {
    given = 0;
    for (const n of p.notes.slice(0, MOST_NOTES)) {
      if (n && Number.isFinite(n.at) && n.at >= 0 && Number.isFinite(n.len) && n.len > 0) given = Math.max(given, Math.ceil((n.at + n.len) / 2));
    }
  }
  const beats = Math.max(1, Math.min(most, Math.ceil(given)));
  const end = 2 * beats;
  const notes = [];
  for (const n of p.notes.slice(0, MOST_NOTES)) {
    if (!n || typeof n !== 'object') continue;
    const { at, len, midi } = n;
    if (!Number.isFinite(at) || at < 0 || at >= end || !Number.isFinite(len) || len <= 0) continue;
    if (!Number.isInteger(midi) || midi < LOWEST || midi > HIGHEST) continue;
    notes.push({ at, len: Math.min(len, end), midi });
  }
  if (!notes.length) return null;
  const part = { role: p.role, notes, beats };
  if (p.follows === true) part.follows = true;
  return part;
};

/**
 * Tidy a tune read back from storage (or about to be kept): the right shape, known reading,
 * speed and voice, notes inside the tune and the playable range, no longer than a notes clip
 * may be. Returns null when there is nothing to repair it from (no tune part with notes).
 */
export function cleanTune(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.parts)) return null;
  const meter = raw.meter === 3 ? 3 : 4;
  const most = mostNotesBeats(meter);
  const tune = cleanPart(raw.parts[0], most);
  if (!tune || tune.role !== 'tune') return null;
  const reading = READING_IDS.includes(raw.reading) ? raw.reading : 'tidy';
  const parts = [tune];
  if (reading === 'band') {
    const band = cleanPart(raw.parts[1], most);
    if (band && band.role === 'band') parts.push(band);
  }
  const voice = typeof raw.voice === 'string' && Object.hasOwn(VOICES, raw.voice) ? raw.voice : startVoice(reading);
  let shift = Number.isFinite(raw.shift) ? 12 * Math.round(raw.shift / 12) : 0;
  if (!shiftFits(parts, shift)) shift = 0;
  return {
    v: 1,
    id: typeof raw.id === 'string' && raw.id && raw.id.length <= 40 ? raw.id : newTuneId(),
    made: Number.isFinite(raw.made) && raw.made > 0 ? Math.round(raw.made) : 0,
    reading: parts.length > 1 ? 'band' : reading === 'band' ? 'tidy' : reading,
    bpm: Math.max(TUNE_BPM[0], Math.min(TUNE_BPM[1], Math.round(Number(raw.bpm) || 100))),
    meter,
    key: validKey(raw.key) ? raw.key : null,
    beats: Math.max(...parts.map((p) => p.beats)),
    parts,
    voice,
    shift,
  };
}

export const newTuneId = () => `tune-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * A tune from what the robot read (notomatic.js tuneReadings) and the reading the kid picked,
 * played in `voice` moved by `shift`. Null when that reading has nothing in it.
 */
export function makeTune(result, readingId, { voice = startVoice(readingId), shift = 0, now = Date.now() } = {}) {
  const parts = result?.[readingId];
  if (!Array.isArray(parts) || !parts.length) return null;
  return cleanTune({
    v: 1, id: newTuneId(), made: now, reading: readingId, bpm: result.bpm, meter: result.meter, key: result.key,
    parts: parts.map((p) => ({ role: p.role, notes: p.notes, beats: p.beats, follows: p.follows })), voice, shift,
  });
}

// (forMix: a kept tune as a studio mix can hold it; it lives with the mix's rules)
export { forMix } from './studiorules.js';

/** How long a tune plays, in whole seconds (at least 1). */
export const tuneSeconds = (tune) => Math.max(1, Math.round((tune.beats * 60) / tune.bpm));

/** A tune's name on the shelf, by its slot: "Tune 2". */
export const tuneName = (slot) => `Tune ${slot + 1}`;

/** What is said under its name: "Tidied, 8 seconds". */
export function tuneAbout(tune) {
  const s = tuneSeconds(tune);
  return `${readingName(tune.reading)}, ${s} second${s === 1 ? '' : 's'}`;
}

/** The first empty slot of a shelf (an array of tunes or nulls), or -1 when it is full. */
export function freeSlot(shelf) {
  for (let i = 0; i < TUNE_SLOTS; i += 1) if (!shelf?.[i]) return i;
  return -1;
}
