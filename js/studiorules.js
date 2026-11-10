// The recording studio's mixer, as rules: a mix is a short loop (30 seconds at most) of four
// tracks. A track holds clips that never overlap: ready-made parts of the game's songs (the
// tune, the arpeggio, the bass or the drums, see music.js songParts) and the kid's own takes
// (recordings, kept on the tablet by studio-store.js). Clips can be moved, trimmed, copied and
// thrown away. Everything is counted in beats (quarter notes) at the mix's speed, and snaps
// to whole beats. Pure logic, no DOM and no sound: studio.js draws and plays it.

import { SONGS, SHOW_SONGS } from './songs.js';
import { keyInfo, songbookFor } from './sheetmusic.js';

export const TRACKS = 4;
export const MAX_SECONDS = 30;
export const MIX_SLOTS = 3; // mixes a kid can keep
export const PART_NAMES = { lead: 'Tune', arp: 'Sparkle', bass: 'Bass', drums: 'Drums' };
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
 * the part, or the room there is. Returns { mix, error, id }.
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
  }
  const start = freeSpot(next, track, 1, Math.round(at));
  if (start < 0) return no(mix, 'That track is full.');
  const len = Math.min(src.beats, roomAt(next, track, start));
  const id = next.next;
  next = { ...next, next: id + 1 };
  next.tracks[track].push({ id, kind: 'part', song: songId, part, start, len, from: 0, total: src.beats });
  next.tracks[track].sort((a, b) => a.start - b.start);
  return { mix: next, error: null, id };
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

/** The take ids a mix uses. */
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
 * What to play for one time round the loop: [{ id, track, kind, song, part, take, at, offset,
 * dur }] in seconds: when it starts, how far into its part or take, and for how long.
 * A take keeps `lead` seconds of sound from before its beat, so a note played a little early
 * keeps its start. Untrimmed, it starts that much before its beat (a clip on the loop's first
 * beat then starts at the end of the loop before). Trimmed at the front, it starts on its beat.
 */
export function schedule(mix) {
  const beat = 60 / mix.bpm;
  return mix.tracks.flatMap((clips, track) => clips.map((c) => {
    const lead = c.kind === 'take' ? c.lead || 0 : 0;
    const early = c.from === 0 ? lead : 0;
    return {
      id: c.id, track, kind: c.kind, song: c.song, part: c.part, take: c.take,
      at: c.start * beat - early, offset: c.from === 0 ? 0 : c.from * beat + lead, dur: c.len * beat + early,
    };
  })).sort((a, b) => a.at - b.at || a.track - b.track);
}

/** The stickers a mix has earned, for its card: [{ id, name, why }]. */
export function badges(mix) {
  const clips = allClips(mix);
  const parts = clips.filter((c) => c.kind === 'part');
  const takes = clips.filter((c) => c.kind === 'take');
  const kinds = new Set(parts.map((c) => c.part));
  const songs = new Set(parts.map((c) => c.song));
  const out = [];
  if (takes.length) out.push({ id: 'take', name: 'First take', why: 'You recorded yourself!' });
  if (takes.length && parts.length) out.push({ id: 'duet', name: 'Duet', why: 'You played along with the game.' });
  if (['lead', 'bass', 'drums'].every((k) => kinds.has(k))) out.push({ id: 'band', name: 'Full band', why: 'A tune, a bass and drums together.' });
  if (songs.size >= 2) out.push({ id: 'remix', name: 'Remix', why: 'Parts from two songs in one mix.' });
  if (songs.size >= 2 && [...songs].every((s) => keyFits(mix.key, sourceOf(s)?.key))) out.push({ id: 'match', name: 'Perfect match', why: 'Every part is in the same key.' });
  const mine = mix.tracks.filter((t) => t.some((c) => c.kind === 'take')).length;
  if (mine >= TRACKS && !parts.length) out.push({ id: 'solo', name: 'One-kid band', why: 'Every track is you!' });
  return out;
}

/** The keys the songs are in: a mix's key is always one of them. */
let songKeys = null;
const knownKey = (key) => {
  songKeys ||= new Set([...Object.keys(SONGS), ...Object.keys(SHOW_SONGS).map((k) => `show:${k}`)].map((id) => sourceOf(id)?.key).filter(Boolean));
  return typeof key === 'string' && songKeys.has(key);
};

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
    key: knownKey(raw.key) ? raw.key : null,
  };
  mix.bars = Math.max(2, Math.min(maxBars(mix.bpm, mix.meter), Math.round(Number(raw.bars) || 8)));
  let next = 1;
  raw.tracks.slice(0, TRACKS).forEach((clips, t) => {
    for (const c of Array.isArray(clips) ? clips : []) {
      const src = c?.kind === 'part' && typeof c.song === 'string' ? sourceOf(c.song) : null;
      const part = src && typeof c.part === 'string' && Object.hasOwn(PART_NAMES, c.part) && src.meter === mix.meter;
      const take = c?.kind === 'take' && typeof c.take === 'string';
      const [start, len, from, total] = [c?.start, c?.len, c?.from, c?.total];
      if (!(part || take) || ![start, len, from, total].every(Number.isInteger)) continue;
      if (!(len >= 1) || !(from >= 0) || !(total >= from + len) || !isFree(mix, t, start, len)) continue;
      if (part) {
        // never longer than the song itself
        const keep = Math.min(len, src.beats - from);
        if (keep < 1) continue;
        mix.tracks[t].push({ id: next, kind: 'part', song: c.song, part: c.part, start, len: keep, from, total: src.beats });
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
  mix.next = next;
  return mix;
}
