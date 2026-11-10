// The recording studio's mixer, as rules: a mix is a short loop (30 seconds at most) of four
// tracks. A track holds clips that never overlap: ready-made parts of the game's songs (the
// tune, its hook, the arpeggio, the bass, the drums or their kick and snare or cymbals, see
// music.js songParts), backing tracks that belong to no song (studiokit.js BACKING), and the
// kid's own takes (recordings, kept on the tablet by studio-store.js). Clips can be moved,
// trimmed, copied and thrown away. A clip with notes can be played in another voice and
// moved higher or lower; a clip with drums can be played on another kit (the remix kit,
// remix.js). Everything is counted in beats (quarter notes) at the mix's speed, and snaps
// to whole beats. Pure logic, no DOM and no sound: studio.js draws and plays it.
//
// Clips: { id, kind: 'part', song, part, start, len, from, total }, { kind: 'backing',
// pattern, loop, ... }, { kind: 'take', take, lead, ... } or { kind: 'notes', nid, role,
// notes, key?, follows?, ... } (a take the Note-o-Matic turned into notes: see takeToNotes).
// A clip with notes may have `voice` (a VOICES id) and `shift` (semitones); a clip with drums
// may have `kit` (a KITS id).

import { SONGS, SHOW_SONGS } from './songs.js';
import { keyInfo, keyLabel, songbookFor } from './sheetmusic.js';
import { VOICES, KITS, LOOPS, BACKING, LOOP_BARS } from './studiokit.js';
import { clipSound, clipEvents, noteSpan, sameSig, shiftKey, sigOf, LOWEST, HIGHEST, MOST_SHIFT } from './remix.js';

export const TRACKS = 4;
export const MAX_SECONDS = 30;
export const MIX_SLOTS = 3; // mixes a kid can keep
export const PART_NAMES = { lead: 'Tune', arp: 'Sparkle', bass: 'Bass', drums: 'Drums', hook: 'Hook', beat: 'Kick and snare', cymbals: 'Cymbals' };
/** A new mix that starts with a backing track plays at this speed. */
export const BACKING_BPM = 120;
export const BPM_RANGE = [70, 170];

const songOf = (id) => {
  const [book, key] = String(id).startsWith('show:') ? [SHOW_SONGS, id.slice(5)] : [SONGS, id];
  return Object.hasOwn(book, key) ? book[key] : null;
};

/** A song's parts as sources for clips: { song, name, key, bpm, meter (beats a bar), beats (its length) }. */
export function sourceOf(songId) {
  const s = songOf(songId);
  if (!s) return null;
  const meter = (s.beat || 8) / 2;
  return { song: songId, name: s.name, key: s.key, bpm: s.bpm, meter, beats: s.lead.length * meter };
}

/** How many beats a part of a song lasts: the hook is its first 2 bars, the others the whole song. */
export const partBeats = (src, part) => (part === 'hook' ? Math.min(src.beats, 2 * src.meter) : src.beats);

/** A backing track's length in beats: 4 bars. */
export const backingBeats = (pattern) => LOOP_BARS * BACKING[pattern].meter;

/** The most bars a loop can have at this speed and beat, to stay within 30 seconds (at least 2). */
export function maxBars(bpm, meter = 4) {
  return Math.max(2, Math.floor((MAX_SECONDS * bpm) / 60 / meter));
}

/** A loop's length in beats and in seconds. */
export const mixBeats = (mix) => mix.bars * mix.meter;
export const mixSeconds = (mix) => (mixBeats(mix) * 60) / mix.bpm;

/** An empty mix: 8 bars of 4 beats at 120, until the first part sets the speed and the beat. */
export function newMix(name = 'My mix') {
  return { v: 1, name, bpm: 120, meter: 4, bars: 8, key: null, tracks: Array.from({ length: TRACKS }, () => []), next: 1 };
}

const clone = (mix) => ({ ...mix, tracks: mix.tracks.map((t) => t.map((c) => ({ ...c }))) });
const allClips = (mix) => mix.tracks.flat();
const ok = (mix) => ({ mix, error: null });
const no = (mix, error) => ({ mix, error });

/** Where a clip is: { clip, track }, or null. */
export function findClip(mix, id) {
  for (let t = 0; t < mix.tracks.length; t += 1) {
    const clip = mix.tracks[t].find((c) => c.id === id);
    if (clip) return { clip, track: t };
  }
  return null;
}

/** Whether beats [start, start + len) are free on a track (leaving out clip `skip`), inside the loop. */
export function isFree(mix, track, start, len, skip = null) {
  if (!mix.tracks[track] || !(start >= 0) || !(len >= 1) || !(start + len <= mixBeats(mix))) return false;
  return mix.tracks[track].every((c) => c.id === skip || start >= c.start + c.len || start + len <= c.start);
}

/** The first free place of len beats on a track at or after `from` (then from the start), or -1. */
export function freeSpot(mix, track, len, from = 0, skip = null) {
  const total = mixBeats(mix);
  for (let k = 0; k < total; k += 1) {
    const start = (Math.max(0, Math.round(from)) + k) % total;
    if (isFree(mix, track, start, len, skip)) return start;
  }
  return -1;
}

/** The room after `start` on a track before the next clip or the loop's end, in beats. */
export function roomAt(mix, track, start, skip = null) {
  let end = mixBeats(mix);
  for (const c of mix.tracks[track] || []) {
    if (c.id === skip) continue;
    if (start >= c.start && start < c.start + c.len) return 0;
    if (c.start >= start) end = Math.min(end, c.start);
  }
  return Math.max(0, end - start);
}

/**
 * Where new music goes when the kid hasn't picked a spot: the free place with the most room.
 * An empty track wins, then the longest free stretch; a tie goes to the lower track and the
 * earlier beat. Returns { track, beat, room }, or null when every track is full.
 */
export function bestSpot(mix) {
  const total = mixBeats(mix);
  let best = null;
  for (let t = 0; t < mix.tracks.length; t += 1) {
    const empty = !mix.tracks[t].length;
    for (let b = 0; b < total; b += 1) {
      const room = roomAt(mix, t, b);
      if (room < 1) continue;
      if (!best || (empty && !best.empty) || (empty === best.empty && room > best.room)) best = { track: t, beat: b, room, empty };
      b += room - 1; // the rest of this stretch has less room
    }
  }
  return best && { track: best.track, beat: best.beat, room: best.room };
}

/**
 * Put a ready-made part on a track at beat `at` (snapped; the first free place from there on).
 * The first clip of a mix sets its speed, beat and key, and trims the loop to 30 seconds. A
 * part of another beat (a waltz in a four-beat mix) is turned down. The clip is as long as
 * the part, or the room there is. A mix with no key yet (only drums so far) takes the song's.
 * Returns { mix, error, id }.
 */
export function addPart(mix, track, songId, part, at = 0) {
  const src = sourceOf(songId);
  if (!src) return no(mix, 'That song is not in the studio.');
  let next = clone(mix);
  if (!allClips(next).length) {
    next.bpm = src.bpm;
    next.meter = src.meter;
    next.key = src.key;
    // a short show tune's loop is as long as the tune; a map song starts with its first 8 bars
    next.bars = Math.max(2, Math.min(maxBars(src.bpm, src.meter), 8, Math.ceil(src.beats / src.meter)));
  } else if (src.meter !== next.meter) {
    return no(mix, `${src.name} has ${src.meter} beats in a bar, and this mix has ${next.meter}. They can't play together.`);
  } else if (!next.key) next.key = src.key;
  const start = freeSpot(next, track, 1, Math.round(at));
  if (start < 0) return no(mix, 'That track is full.');
  const total = partBeats(src, part);
  const len = Math.min(total, roomAt(next, track, start));
  const id = next.next;
  next = { ...next, next: id + 1 };
  next.tracks[track].push({ id, kind: 'part', song: songId, part, start, len, from: 0, total });
  next.tracks[track].sort((a, b) => a.start - b.start);
  return { mix: next, error: null, id };
}

/**
 * Put a backing track (a BACKING pattern, 4 bars) on a track at beat `at`, as addPart does.
 * One with notes plays the chord loop `loop` in the mix's key (see remix.js backingKey). An
 * empty mix takes the pattern's beat and a speed of 120; a mix with no key yet gets C major
 * or A minor (as the loop's mood) from a backing with notes. Another beat is turned down.
 * Returns { mix, error, id }.
 */
export function addBacking(mix, track, pattern, loop = 'sunny', at = 0) {
  const b = Object.hasOwn(BACKING, pattern) ? BACKING[pattern] : null;
  if (!b) return no(mix, 'That backing track is not in the studio.');
  if (!Object.hasOwn(LOOPS, loop)) return no(mix, 'Pick the chords first.');
  let next = clone(mix);
  if (!allClips(next).length) {
    next.bpm = BACKING_BPM;
    next.meter = b.meter;
    next.key = null;
    next.bars = Math.max(2, Math.min(maxBars(BACKING_BPM, b.meter), 8));
  } else if (b.meter !== next.meter) {
    return no(mix, `${b.name} has ${b.meter} beats in a bar, and this mix has ${next.meter}. They can't play together.`);
  }
  if (b.kind === 'notes' && !next.key) next.key = LOOPS[loop].mood === 'minor' ? 'Am' : 'C';
  const start = freeSpot(next, track, 1, Math.round(at));
  if (start < 0) return no(mix, 'That track is full.');
  const total = backingBeats(pattern);
  const len = Math.min(total, roomAt(next, track, start));
  const id = next.next;
  next = { ...next, next: id + 1 };
  next.tracks[track].push({ id, kind: 'backing', pattern, loop, start, len, from: 0, total });
  next.tracks[track].sort((a, b2) => a.start - b2.start);
  return { mix: next, error: null, id };
}

/**
 * Play every backing track with notes in a mix on the chord loop `loop` (they follow the
 * chords the kid picks). Other chords can take a clip moved higher or lower past what can be
 * heard well (MIDI 24 to 96): it then moves back by the fewest whole octaves that keep every
 * note in. Returns { mix, error, changed (how many clips), moved: [{ id, octaves }] (the clips
 * that moved back, and how far: negative is lower) }.
 */
export function setLoop(mix, loop) {
  if (!Object.hasOwn(LOOPS, loop)) return { ...no(mix, 'Pick the chords first.'), changed: 0, moved: [] };
  const next = clone(mix);
  let changed = 0;
  const moved = [];
  for (const c of allClips(next)) {
    if (c.kind !== 'backing' || clipSound(c) !== 'notes' || c.loop === loop) continue;
    c.loop = loop;
    changed += 1;
    const was = c.shift || 0;
    const shift = inRange(next, c, was);
    if (shift === was) continue;
    moved.push({ id: c.id, octaves: Math.round((shift - was) / 12) });
    if (shift) c.shift = shift;
    else delete c.shift;
  }
  return { mix: changed ? next : mix, error: null, changed, moved };
}

// ---------- the remix kit: voices, kits, higher and lower ----------

/** The voice a clip of the kid's own notes plays in when it has none of its own choosing. */
export const NOTES_VOICE = 'steel';

/**
 * A clip's own voice: absent for a song's part (its own waves), the pattern's for a backing
 * track, the steel drum for the kid's own notes.
 */
const ownVoice = (c) => (c.kind === 'backing' ? BACKING[c.pattern]?.voice || null : c.kind === 'notes' ? NOTES_VOICE : null);

/** Whether a clip plays in a voice or on a kit of the kid's choosing (not its own sound). */
export const remixed = (c) => Boolean((c.voice && c.voice !== ownVoice(c)) || (c.kit && c.kit !== 'chip'));

/** The notes a clip plays now (its shift too): { low, high }, or null when it has none. */
export function clipSpan(mix, c) {
  const span = noteSpan(clipEvents(c, mix.key));
  return span && { low: span.low + (c.shift || 0), high: span.high + (c.shift || 0) };
}

/** A shift's whole octaves and what is left (-6 to 5 semitones): 14 is 1 octave and 2. */
export function splitShift(shift = 0) {
  const rest = ((((shift + 6) % 12) + 12) % 12) - 6;
  return { octaves: (shift - rest) / 12, rest };
}

/** Whether a clip may be moved by `shift` semitones in all: within the limits, every note playable. */
function shiftOk(mix, c, shift) {
  return shiftFits(noteSpan(clipEvents(c, mix.key)), shift);
}
const shiftFits = (span, shift) => Math.abs(shift) <= MOST_SHIFT && (!span || (span.low + shift >= LOWEST && span.high + shift <= HIGHEST));

/**
 * The shift nearest to `shift` by whole octaves (so the clip keeps its key) that lets clip c
 * play every note within MIDI 24 to 96 in a mix: `shift` itself when it does already, the
 * fewest octaves back otherwise, and 0 (no move) when no octave fits.
 */
function inRange(mix, c, shift) {
  const span = noteSpan(clipEvents(c, mix.key));
  if (shiftFits(span, shift)) return shift;
  const toward = shift > 0 ? [-12, 12] : [12, -12];
  for (let o = 1; o <= 2 * Math.ceil(MOST_SHIFT / 12) + 1; o += 1) {
    for (const d of toward) if (shiftFits(span, shift + d * o)) return shift + d * o;
  }
  return 0;
}

/**
 * Give a clip with notes a voice (a VOICES id), or its own sound back (null). The first time a
 * clip gets a voice, and it hasn't been moved by octaves yet, it moves by whole octaves so its
 * notes sit around that voice's home octave (a tune played on Deep bass plays low at once).
 * Returns { mix, error, octaves (how far it moved) }.
 */
export function setVoice(mix, id, voice) {
  const found = findClip(mix, id);
  if (!found) return no(mix, 'That clip is gone.');
  const c = found.clip;
  if (clipSound(c) !== 'notes') return no(mix, 'Only music with notes can change its voice.');
  if (voice != null && !Object.hasOwn(VOICES, voice)) return no(mix, 'That voice is not in the studio.');
  const next = clone(mix);
  const clip = findClip(next, id).clip;
  let octaves = 0;
  if (voice == null || voice === ownVoice(c)) delete clip.voice;
  else {
    const { octaves: moved, rest } = splitShift(c.shift || 0);
    const span = clipSpan(mix, c);
    if (!c.voice && moved === 0 && span) {
      // the middle of the voice's home octave (octave 4 is MIDI 60 to 71)
      const home = (VOICES[voice].home + 1) * 12 + 5.5;
      const want = Math.round((home - (span.low + span.high) / 2) / 12);
      // the nearest octave that keeps every note playable (else it stays where it is)
      const fits = [-2, -1, 0, 1, 2].filter((o) => shiftOk(mix, c, rest + 12 * o));
      octaves = fits.length ? fits.reduce((a, o) => (Math.abs(o - want) < Math.abs(a - want) ? o : a)) : 0;
      if (octaves) clip.shift = rest + 12 * octaves;
    }
    clip.voice = voice;
  }
  return { mix: next, error: null, octaves };
}

/** Play a clip with drums on a kit (a KITS id), or the game's own kit (null or 'chip'). */
export function setKit(mix, id, kit) {
  const found = findClip(mix, id);
  if (!found) return no(mix, 'That clip is gone.');
  if (clipSound(found.clip) !== 'drums') return no(mix, 'Only drums can change their kit.');
  if (kit != null && !Object.hasOwn(KITS, kit)) return no(mix, 'That kit is not in the studio.');
  const next = clone(mix);
  const clip = findClip(next, id).clip;
  if (kit == null || kit === 'chip') delete clip.kit;
  else clip.kit = kit;
  return ok(next);
}

/**
 * Move a clip with notes higher or lower by `by` semitones (12 is an octave up). Turned down
 * when a note would leave what can be heard well (MIDI 24 to 96) or it would move more than
 * 2 octaves.
 */
export function shiftClip(mix, id, by) {
  const found = findClip(mix, id);
  if (!found) return no(mix, 'That clip is gone.');
  const c = found.clip;
  if (clipSound(c) !== 'notes') return no(mix, 'Only music with notes can go higher or lower.');
  const shift = (c.shift || 0) + Math.round(by);
  if (!shiftOk(mix, c, shift)) return no(mix, by > 0 ? 'It can\'t go any higher. Its notes would be too high to hear well.' : 'It can\'t go any lower. Its notes would be too low to hear well.');
  const next = clone(mix);
  const clip = findClip(next, id).clip;
  if (shift) clip.shift = shift;
  else delete clip.shift;
  return ok(next);
}

/**
 * How many semitones (-6 to 5, the smallest move) bring music in key `from` to the key
 * signature of key `to`: fitShift('F', 'C') is -5, fitShift('G', 'C') is 5.
 */
export function fitShift(from, to) {
  const k = (((7 * (sigOf(to) - sigOf(from))) % 12) + 12) % 12;
  return k > 5 ? k - 12 : k;
}

/** The key a clip is in before its shift: a song's part with notes, the kid's notes (when known). */
function ownKey(c) {
  if (c.kind === 'notes') return typeof c.key === 'string' ? c.key : null;
  if (c.kind !== 'part' || clipSound(c) !== 'notes') return null;
  return sourceOf(c.song)?.key || null;
}

/** The key a clip with a key plays in now, moved by its shift (null for anything else). */
export function clipKey(c) {
  const key = ownKey(c);
  return key ? shiftKey(key, c.shift || 0) : null;
}

/** Whether a clip goes with the mix's key (a backing track always does: it follows the mix). */
export function clipFits(mix, c) {
  const key = clipKey(c);
  return !mix.key || !key || sameSig(mix.key, key);
}

/**
 * Move a song's part (or the kid's notes) into the mix's key: the smallest move that brings it there, keeping
 * any octaves it was moved by (or the octave next to them, when the notes would go too far).
 * Returns { mix, error }.
 */
export function moveIntoKey(mix, id) {
  const found = findClip(mix, id);
  if (!found) return no(mix, 'That clip is gone.');
  const c = found.clip;
  if (!clipKey(c) || !mix.key) return no(mix, 'That clip has no key to move.');
  if (clipFits(mix, c)) return no(mix, `It already goes with ${keyLabel(mix.key)}.`);
  const { octaves } = splitShift(c.shift || 0);
  const k = fitShift(ownKey(c), mix.key);
  for (const o of [octaves, octaves - 1, octaves + 1]) {
    const shift = 12 * o + k;
    if (!shiftOk(mix, c, shift)) continue;
    const next = clone(mix);
    const clip = findClip(next, id).clip;
    if (shift) clip.shift = shift;
    else delete clip.shift;
    return ok(next);
  }
  return no(mix, 'It can\'t move into that key. Its notes would be too high or too low.');
}

/**
 * Put a take (a recording of `beats` beats, kept under take id) on a track at beat `at`. A
 * take longer than the room it has is cut to fit (the rest is still there to trim back).
 * `lead` is how many seconds of sound the take keeps from before its beat (see schedule).
 * Returns { mix, error, id }.
 */
export function addTake(mix, track, take, beats, at = 0, { lead = 0 } = {}) {
  const total = Math.max(1, Math.ceil(beats - 1e-3));
  const next = clone(mix);
  const start = Math.round(at);
  const room = roomAt(next, track, start);
  if (start < 0 || room < 1) return no(mix, 'There is no room there. Pick an empty spot on a track.');
  const id = next.next;
  next.next = id + 1;
  const clip = { id, kind: 'take', take, start, len: Math.min(total, room), from: 0, total };
  if (lead > 0) clip.lead = lead;
  next.tracks[track].push(clip);
  next.tracks[track].sort((a, b) => a.start - b.start);
  return { mix: next, error: null, id };
}

// ---------- the Note-o-Matic: a take turned into notes ----------

/**
 * The voices the kid's notes start in, by reading (notomatic.js READINGS) and role: the band
 * version plays its tune on Beep and its band on the Organ, like the game's own music. A
 * reading or role not listed plays in the notes' own voice (NOTES_VOICE).
 */
export const READING_VOICES = { band: { tune: 'beep', band: 'organ' } };

/** The voice a part of a reading starts in, or null for the notes' own voice. */
export const readingVoice = (readingId, role) => READING_VOICES[readingId]?.[role] || null;

/** A new name for a list of notes (two clips with the same name sound the same: copies share it). */
let nids = 0;
export function newNid() {
  nids = (nids + 1) % 1296;
  return `n${Date.now().toString(36)}${nids.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A part of a reading's notes, as a clip keeps them: { at, len, midi } only. */
const keptNotes = (notes) => notes.map((n) => ({ at: n.at, len: n.len, midi: n.midi }));

/**
 * Turn the take `id` into notes: `reading` is one reading's parts (notomatic.js readings:
 * [{ role, notes, beats, follows }]), `key` the key the playing is in (or null). The tune
 * (part 0) takes the take's place on its track, at the same beat and from the same place in
 * it while that is still inside the notes; a band part goes on the track with the most room
 * at that beat, lined up with the tune. A reading with a band part is the band version, and
 * its parts start in that reading's voices (READING_VOICES). A mix with no key yet takes the
 * playing's. The take's sound stays in the store while Undo can bring it back (see takesIn).
 * Returns { mix, error, ids } (the new clips' ids, the tune's first).
 */
export function takeToNotes(mix, id, reading, key = null) {
  const fail = (error) => ({ mix, error, ids: [] });
  const found = findClip(mix, id);
  if (!found || found.clip.kind !== 'take') return fail('That recording is gone.');
  const parts = Array.isArray(reading) ? reading : [];
  if (!parts.length || parts.some((p) => !Array.isArray(p?.notes) || !p.notes.length)) return fail('There were no notes to use.');
  const take = found.clip;
  const band = parts.length > 1;
  const readingId = band ? 'band' : null;
  const goodKey = typeof key === 'string' && validKey(key) ? key : null;
  const next = clone(mix);
  next.tracks[found.track] = next.tracks[found.track].filter((c) => c.id !== id);
  const start = take.start;
  const make = (part, role, from, len) => {
    const total = Math.max(1, Math.ceil(part.beats - 1e-6));
    const clip = { id: next.next, kind: 'notes', nid: newNid(), role, notes: keptNotes(part.notes), start, len, from, total };
    next.next += 1;
    if (goodKey) clip.key = goodKey;
    if (part.follows === true) clip.follows = true;
    const voice = readingVoice(readingId, role);
    if (voice && voice !== NOTES_VOICE) clip.voice = voice;
    return clip;
  };
  // the tune, in the take's place
  const tune = parts[0];
  const tuneTotal = Math.max(1, Math.ceil(tune.beats - 1e-6));
  const from = take.from < tuneTotal ? take.from : 0;
  const tuneClip = make(tune, 'tune', from, Math.max(1, Math.min(tuneTotal - from, roomAt(next, found.track, start))));
  const placed = [[found.track, tuneClip]];
  // the band, on another track: the one with the most room at that beat
  for (const part of parts.slice(1)) {
    let best = null;
    for (let t = 0; t < next.tracks.length; t += 1) {
      if (placed.some(([pt]) => pt === t)) continue;
      const room = roomAt(next, t, start);
      if (room >= 1 && (!best || room > best.room)) best = { track: t, room };
    }
    if (!best) return fail('The band needs an empty spot on another track. Make some room and try again.');
    const total = Math.max(1, Math.ceil(part.beats - 1e-6));
    // lined up with the tune: from the same place in the music when the band reaches it
    const bandFrom = from < total ? from : 0;
    const clip = make(part, 'band', bandFrom, Math.min(total - bandFrom, best.room));
    placed.push([best.track, clip]);
    next.tracks[best.track].push(clip); // (so the next band part finds this track taken)
  }
  next.tracks[found.track].push(tuneClip);
  for (const [t] of placed) next.tracks[t].sort((a, b) => a.start - b.start);
  if (!next.key && goodKey) next.key = goodKey;
  return { mix: next, error: null, ids: placed.map(([, c]) => c.id) };
}

/** Move a clip to a track and a beat (snapped). Turned down when something is in the way. */
export function moveClip(mix, id, track, start) {
  const found = findClip(mix, id);
  if (!found) return no(mix, 'That clip is gone.');
  const at = Math.max(0, Math.min(mixBeats(mix) - found.clip.len, Math.round(start)));
  if (!isFree(mix, track, at, found.clip.len, id)) return no(mix, 'Something is already there.');
  const next = clone(mix);
  next.tracks[found.track] = next.tracks[found.track].filter((c) => c.id !== id);
  next.tracks[track].push({ ...found.clip, start: at });
  next.tracks[track].sort((a, b) => a.start - b.start);
  return ok(next);
}

/**
 * Trim a clip: change { start, len } and with them `from`, where in the part or the take it
 * begins. Dragging the front edge moves start and from together; the back edge changes len.
 * It never grows past its source, the loop, or a neighbour, and is never under one beat.
 */
export function trimClip(mix, id, { start, len }) {
  const found = findClip(mix, id);
  if (!found) return no(mix, 'That clip is gone.');
  const c = found.clip;
  let s = Math.round(start ?? c.start);
  let l = Math.round(len ?? c.len);
  // the front edge: no earlier than the source's own start, or the clip before
  const before = mix.tracks[found.track].filter((x) => x.id !== id && x.start + x.len <= c.start).map((x) => x.start + x.len);
  s = Math.max(s, c.start - c.from, 0, ...before);
  s = Math.min(s, c.start + c.len - 1);
  const from = c.from + (s - c.start);
  if (len === undefined) l = c.start + c.len - s;
  l = Math.max(1, Math.min(l, c.total - from, roomAt(mix, found.track, s, id)));
  const next = clone(mix);
  Object.assign(findClip(next, id).clip, { start: s, len: l, from });
  return ok(next);
}

/** Copy a clip: right after itself when there is room, else the first free place on any track. */
export function copyClip(mix, id) {
  const found = findClip(mix, id);
  if (!found) return no(mix, 'That clip is gone.');
  const { clip } = found;
  const order = [found.track, ...mix.tracks.map((_, t) => t).filter((t) => t !== found.track)];
  for (const track of order) {
    const start = freeSpot(mix, track, clip.len, track === found.track ? clip.start + clip.len : clip.start);
    if (start < 0) continue;
    const next = clone(mix);
    const copy = next.next;
    next.next = copy + 1;
    next.tracks[track].push({ ...clip, id: copy, start });
    next.tracks[track].sort((a, b) => a.start - b.start);
    return { mix: next, error: null, id: copy };
  }
  return no(mix, 'There is no room for a copy. Make the loop longer or clear a spot.');
}

/** Throw a clip away. (A take's sound stays in the store until no mix uses it: see takesIn.) */
export function removeClip(mix, id) {
  const next = clone(mix);
  next.tracks = next.tracks.map((t) => t.filter((c) => c.id !== id));
  return ok(next);
}

/**
 * Make the loop longer or shorter (2 bars to 30 seconds' worth). A clip that reaches past
 * the new end is cut there (the rest is still there to trim back). Music is never thrown
 * away: when a clip starts past the new end, the loop stays as it is.
 */
export function setBars(mix, bars) {
  const next = clone(mix);
  next.bars = Math.max(2, Math.min(maxBars(mix.bpm, mix.meter), Math.round(bars)));
  const end = mixBeats(next);
  if (allClips(next).some((c) => c.start >= end)) return no(mix, 'Move or delete the music in the last bar first.');
  next.tracks = next.tracks.map((t) => t.map((c) => ({ ...c, len: Math.min(c.len, end - c.start) })));
  return ok(next);
}

/**
 * Change the speed. Ready-made parts follow any speed; a take was played at the speed it was
 * recorded at, so a mix with a take keeps its speed. Slower makes the loop longer in seconds:
 * past 30 seconds it gets fewer bars, but only when no music is in the bars that would go.
 */
export function setBpm(mix, bpm) {
  if (allClips(mix).some((c) => c.kind === 'take')) return no(mix, 'Your recording was played at this speed, so the speed stays. Take the recording off to change it.');
  const next = clone(mix);
  next.bpm = Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], Math.round(bpm)));
  const r = setBars(next, Math.min(next.bars, maxBars(next.bpm, next.meter)));
  return r.error ? no(mix, 'That would make your loop longer than 30 seconds. Make the loop shorter first.') : r;
}

// ---------- how loud each track plays ----------

/**
 * A track's loudness is a level from 0 to 5: 3 is the usual (and every track's until a kid
 * changes one), 0 is silent (muted). In decibels, by level (null: silent).
 */
export const VOLUME_DB = [null, -12, -6, 0, 3, 6];
export const VOLUME_TOP = VOLUME_DB.length - 1;
export const USUAL_VOLUME = 3;

/** A track's level (a mix without `vols` has every track at the usual 3). */
export const trackVolume = (mix, track) => (Array.isArray(mix.vols) && Number.isInteger(mix.vols[track]) ? mix.vols[track] : USUAL_VOLUME);

/** A level's gain from the table: 0 when muted, 1 at the usual level. */
const levelGain = (level) => (VOLUME_DB[level] == null ? 0 : 10 ** (VOLUME_DB[level] / 20));

/**
 * How much a track's sound is multiplied by: a balance between the tracks, never a boost of the
 * whole mix. Its level's gain is divided by the loudest track's when that is above the usual
 * (so one track at 5 plays as usual and the others 6 dB lower; all at 5 play as all at 3).
 * Levels at or below 3 are never raised. 0 when muted.
 */
export function trackGain(mix, track) {
  const top = Math.max(...Array.from({ length: TRACKS }, (_, t) => levelGain(trackVolume(mix, t))));
  return levelGain(trackVolume(mix, track)) / Math.max(1, top);
}

/**
 * Set a track's level (0 to 5). Turned down for a track or level that isn't there; the same
 * level changes nothing (the same mix comes back). A mix only gets `vols` once a level changes.
 */
export function setTrackVolume(mix, track, level) {
  if (!Number.isInteger(track) || track < 0 || track >= TRACKS) return no(mix, 'That track is not on the desk.');
  if (!Number.isInteger(level) || level < 0 || level > VOLUME_TOP) return no(mix, level > VOLUME_TOP ? 'That\'s as loud as it goes.' : 'That\'s as quiet as it goes.');
  if (trackVolume(mix, track) === level) return ok(mix);
  const next = clone(mix);
  next.vols = Array.from({ length: TRACKS }, (_, t) => trackVolume(mix, t));
  next.vols[track] = level;
  return ok(next);
}

/** Mute a track (level 0), or unmute it: back to the usual level 3. */
export const muteTrack = (mix, track) => setTrackVolume(mix, track, trackVolume(mix, track) === 0 ? USUAL_VOLUME : 0);

/** The take ids a mix uses (a take turned into notes is no longer used by it). */
export const takesIn = (mix) => [...new Set(allClips(mix).filter((c) => c.kind === 'take').map((c) => c.take))];

/**
 * The songs whose parts a desk may use: the ones open in the songbook for this piano (`tier`,
 * 0-3) and these found treasure maps (a Set of map ids), whether bought or not. The best
 * piano opens every song, the shows' too (the parent's test desk uses it).
 */
export function shelfSongs(tier, maps = new Set()) {
  return songbookFor(tier, maps).filter((p) => p.open && sourceOf(p.id));
}

/** Whether a part's key goes with the mix's (the same key signature: C major with A minor). */
export function keyFits(mixKey, key) {
  if (!mixKey || !key) return true;
  return keyInfo(mixKey).sig === keyInfo(key).sig;
}

/**
 * What to play for one time round the loop: [{ id, track, kind, song, part, pattern, loop,
 * voice, kit, shift, take, nid, role, notes, follows, at, offset, dur }] in seconds: when it starts, how far into its
 * part, backing track or take, and for how long, and how it is played.
 * A take keeps `lead` seconds of sound from before its beat, so a note played a little early
 * keeps its start. Untrimmed, it starts that much before its beat (a clip on the loop's first
 * beat then starts at the end of the loop before). Trimmed at the front, it starts on its beat.
 */
export function schedule(mix) {
  const beat = 60 / mix.bpm;
  return mix.tracks.flatMap((clips, track) => clips.map((c) => {
    const lead = c.kind === 'take' ? c.lead || 0 : 0;
    const early = c.from === 0 ? lead : 0;
    const e = {
      id: c.id, track, kind: c.kind, song: c.song, part: c.part, take: c.take,
      at: c.start * beat - early, offset: c.from === 0 ? 0 : c.from * beat + lead, dur: c.len * beat + early,
    };
    // the remix kit's fields, when the clip has them
    for (const k of ['pattern', 'loop', 'voice', 'kit', 'shift', 'nid', 'role', 'notes', 'follows']) if (c[k] !== undefined) e[k] = c[k];
    return e;
  })).sort((a, b) => a.at - b.at || a.track - b.track);
}

/**
 * How much a backing track swings in a mix (see music.js swingAt): as the mix's song parts do.
 * The first song part counts (the earliest, then the lowest track); none, no swing.
 */
export function backingSwing(mix) {
  let first = null;
  mix.tracks.forEach((clips) => clips.forEach((c) => { if (c.kind === 'part' && (!first || c.start < first.start)) first = c; }));
  return (first && songOf(first.song)?.swing) || 0;
}

/**
 * How much a clip swings in a mix, for a clip that isn't a song's part (that swings as its
 * song does): a backing track as backingSwing, the kid's notes only when they sit on straight
 * eighths (`follows`), else 0.
 */
export function clipSwing(mix, c) {
  if (c.kind === 'backing' || (c.kind === 'notes' && c.follows === true)) return backingSwing(mix);
  return 0;
}

/** The stickers a mix has earned, for its card: [{ id, name, why }]. */
export function badges(mix) {
  const clips = allClips(mix);
  const parts = clips.filter((c) => c.kind === 'part');
  const takes = clips.filter((c) => c.kind === 'take');
  const notes = clips.filter((c) => c.kind === 'notes');
  // the kid's own playing: a take, or a take turned into notes
  const mine = [...takes, ...notes];
  const kinds = new Set(parts.map((c) => c.part));
  const songs = new Set(parts.map((c) => c.song));
  const out = [];
  if (mine.length) out.push({ id: 'take', name: 'First take', why: 'You recorded yourself!' });
  if (mine.length && parts.length) out.push({ id: 'duet', name: 'Duet', why: 'You played along with the game.' });
  if (['lead', 'bass', 'drums'].every((k) => kinds.has(k))) out.push({ id: 'band', name: 'Full band', why: 'A tune, a bass and drums together.' });
  if (songs.size >= 2) out.push({ id: 'remix', name: 'Remix', why: 'Parts from two songs in one mix.' });
  // (a part moved into the mix's key counts as in it)
  // only parts with notes have a key: drums count neither for it nor against it
  const keyed = parts.filter((c) => clipSound(c) === 'notes');
  if (new Set(keyed.map((c) => c.song)).size >= 2 && keyed.every((c) => (c.shift ? clipFits(mix, c) : keyFits(mix.key, sourceOf(c.song)?.key)))) {
    out.push({ id: 'match', name: 'Perfect match', why: 'All the notes fit the key of your mix.' });
  }
  // (a band the Note-o-Matic made for the kid's tune isn't the kid playing)
  const yours = mix.tracks.filter((t) => t.some((c) => c.kind === 'take' || (c.kind === 'notes' && c.role === 'tune'))).length;
  if (yours >= TRACKS && !parts.length && !clips.some((c) => c.kind === 'backing')) out.push({ id: 'solo', name: 'One-kid band', why: 'Every track is you!' });
  if (clips.some(remixed)) out.push({ id: 'remixer', name: 'Remixer', why: 'You gave the music a new sound.' });
  const groups = new Set(clips.filter((c) => c.kind === 'backing').map((c) => BACKING[c.pattern]?.group));
  if (['beats', 'bass', 'chords'].every((g) => groups.has(g))) out.push({ id: 'house', name: 'House band', why: 'A beat, a bass line and chords from the backing tracks.' });
  if (notes.length) out.push({ id: 'notes', name: 'Note-o-Matic', why: 'You turned your playing into notes.' });
  if (notes.some((c) => c.role === 'band')) out.push({ id: 'leader', name: 'Band leader', why: 'A band played along with your tune.' });
  return out;
}

/**
 * Whether a key is one the studio can play in: any key with a key signature (sheetmusic.js
 * keyInfo), since a kid's own playing can be in any key, not only the songs'.
 */
export function validKey(key) {
  if (typeof key !== 'string' || key.length > 6) return false;
  try { keyInfo(key); return true; } catch { return false; }
}

/** The most notes a clip of the kid's notes keeps. */
export const MOST_NOTES = 2000;

/**
 * A clip of the kid's notes read back from storage, tidied (see cleanMix), or null when it
 * can't be used: its name, role and notes checked, the notes that can't be played dropped.
 */
function cleanNotesClip(c, base) {
  if (typeof c.nid !== 'string' || !c.nid || c.nid.length > 40) return null;
  if (c.role !== 'tune' && c.role !== 'band') return null;
  if (!Array.isArray(c.notes)) return null;
  const end = 2 * base.total;
  const notes = [];
  for (const n of c.notes.slice(0, MOST_NOTES)) {
    if (!n || typeof n !== 'object') continue;
    const { at, len, midi } = n;
    if (!Number.isFinite(at) || at < 0 || at >= end || !Number.isFinite(len) || len <= 0) continue;
    if (!Number.isInteger(midi) || midi < LOWEST || midi > HIGHEST) continue;
    notes.push({ at, len: Math.min(len, end), midi });
  }
  if (!notes.length) return null;
  const clip = { ...base, kind: 'notes', nid: c.nid, role: c.role, notes };
  if (validKey(c.key)) clip.key = c.key;
  if (c.follows === true) clip.follows = true;
  return clip;
}

/**
 * Tidy a mix read back from storage: the right shape, known songs and keys, whole beats,
 * clips inside the loop that don't overlap, and parts with the mix's beat. Anything odd is
 * dropped, so a bad save can never stop the studio from opening.
 */
export function cleanMix(raw) {
  const base = newMix(typeof raw?.name === 'string' ? raw.name.slice(0, 24) : undefined);
  if (!raw || !Array.isArray(raw.tracks)) return base;
  const mix = {
    ...base,
    bpm: Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], Math.round(Number(raw.bpm) || 120))),
    meter: raw.meter === 3 ? 3 : 4,
    key: validKey(raw.key) ? raw.key : null,
  };
  mix.bars = Math.max(2, Math.min(maxBars(mix.bpm, mix.meter), Math.round(Number(raw.bars) || 8)));
  let next = 1;
  raw.tracks.slice(0, TRACKS).forEach((clips, t) => {
    for (const c of Array.isArray(clips) ? clips : []) {
      const src = c?.kind === 'part' && typeof c.song === 'string' ? sourceOf(c.song) : null;
      const part = src && typeof c.part === 'string' && Object.hasOwn(PART_NAMES, c.part) && src.meter === mix.meter;
      // a backing track: a known pattern of the mix's beat
      const pattern = c?.kind === 'backing' && typeof c.pattern === 'string' && Object.hasOwn(BACKING, c.pattern) && BACKING[c.pattern].meter === mix.meter;
      const take = c?.kind === 'take' && typeof c.take === 'string';
      const mine = c?.kind === 'notes';
      const [start, len, from, total] = [c?.start, c?.len, c?.from, c?.total];
      if (!(part || pattern || take || mine) || ![start, len, from, total].every(Number.isInteger)) continue;
      if (!(len >= 1) || !(from >= 0) || !(total >= from + len) || !isFree(mix, t, start, len)) continue;
      if (part || pattern || mine) {
        let clip;
        if (mine) {
          clip = cleanNotesClip(c, { id: next, start, len, from, total });
          if (!clip) continue;
        } else {
          // never longer than the part or the backing track itself
          const whole = part ? partBeats(src, c.part) : backingBeats(c.pattern);
          const keep = Math.min(len, whole - from);
          if (keep < 1) continue;
          clip = part
            ? { id: next, kind: 'part', song: c.song, part: c.part, start, len: keep, from, total: whole }
            : { id: next, kind: 'backing', pattern: c.pattern, loop: Object.hasOwn(LOOPS, c.loop) ? c.loop : 'sunny', start, len: keep, from, total: whole };
        }
        // how it is played: a known voice and a shift in range for notes, a known kit for drums
        const sound = clipSound(clip);
        if (sound === 'notes' && typeof c.voice === 'string' && Object.hasOwn(VOICES, c.voice) && c.voice !== ownVoice(clip)) clip.voice = c.voice;
        if (sound === 'drums' && typeof c.kit === 'string' && Object.hasOwn(KITS, c.kit) && c.kit !== 'chip') clip.kit = c.kit;
        if (sound === 'notes' && Number.isFinite(c.shift)) {
          let shift = Math.max(-MOST_SHIFT, Math.min(MOST_SHIFT, Math.round(c.shift)));
          // a backing track plays in the mix's key: it only ever moves by whole octaves
          if (clip.kind === 'backing') shift = 12 * Math.round(shift / 12);
          if (shift) clip.shift = shift; // (the notes are checked below, once the mix's key is known)
        }
        mix.tracks[t].push(clip);
      } else {
        const clip = { id: next, kind: 'take', take: c.take, start, len, from, total };
        if (Number.isFinite(c.lead) && c.lead > 0 && c.lead <= 0.2) clip.lead = c.lead;
        mix.tracks[t].push(clip);
      }
      next += 1;
    }
    mix.tracks[t].sort((a, b) => a.start - b.start);
  });
  if (!mix.key) mix.key = sourceOf(mix.tracks.flat().find((c) => c.kind === 'part')?.song || '')?.key || null;
  if (!mix.key) mix.key = mix.tracks.flat().find((c) => c.kind === 'notes' && c.key)?.key || null;
  const notes = mix.tracks.flat().find((c) => c.kind === 'backing' && clipSound(c) === 'notes');
  if (!mix.key && notes) mix.key = LOOPS[notes.loop].mood === 'minor' ? 'Am' : 'C';
  // a moved clip whose notes went past what can be heard well moves back by whole octaves
  for (const c of mix.tracks.flat()) {
    if (c.shift === undefined) continue;
    const shift = inRange(mix, c, c.shift);
    if (shift) c.shift = shift;
    else delete c.shift;
  }
  mix.next = next;
  // track levels: kept only when the mix had them; an odd one is the usual level, a list of
  // the wrong length is dropped (every track at the usual level)
  if (Array.isArray(raw.vols) && raw.vols.length === TRACKS) {
    mix.vols = raw.vols.map((v) => (Number.isInteger(v) && v >= 0 && v <= VOLUME_TOP ? v : USUAL_VOLUME));
  }
  return mix;
}
