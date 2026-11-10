// The recording studio's remix kit as notes: every ready-made clip (a part of a song, a
// backing track) is a list of notes { at, len, midi } or drums { at, kind }, counted in steps
// (eighth notes) from the clip's start. That is what lets a clip be played in another voice,
// on another drum kit, or higher and lower (music.js renderEvents plays the list). The keys
// a clip can be in, and where a backing track plays in the mix's key, are worked out here too.
// Pure: no DOM and no sound, so the rules (studiorules.js) and the tests can use it in Node.
//
// A clip's notes come from its source (SOURCES below): a song's part, a backing track, and
// later the kid's own playing (a stored list of notes) all give the same kind of list.

import { songScore } from './music.js';
import { parseNote, keyInfo } from './sheetmusic.js';
import { BACKING, LOOPS, DRUM_HALVES, backingEvents } from './studiokit.js';

/** A song's parts with notes, and its parts with drums. */
export const NOTE_PARTS = ['lead', 'hook', 'arp', 'bass'];
export const DRUM_PARTS = ['drums', 'beat', 'cymbals'];
/** The lowest and highest notes a clip may be moved to (MIDI), and the most it may move. */
export const LOWEST = 24;
export const HIGHEST = 96;
export const MOST_SHIFT = 24;

/** How many steps a lead note lasts (its own step plus any '-' after it), as music.js has it. */
function holdLength(bar, i) {
  let n = 1;
  while (i + n < bar.length && bar[i + n] === '-') n += 1;
  return n;
}

const partCache = new Map();

/**
 * Exactly what music.js scheduleStep plays for one part of a song, once through, as the
 * studio renders it (renderPart: the arpeggio from the first bar): notes { at, len, midi }
 * and drums { at, kind }, in steps, before swing (music.js swingAt moves them). 'hook' is
 * the tune's first 2 bars, 'beat' the drums' kick, snare and toms, 'cymbals' their hats.
 * The list is shared: don't change it.
 */
export function partEvents(songId, part) {
  const key = `${songId}|${part}`;
  if (partCache.has(key)) return partCache.get(key);
  const song = songScore(songId);
  const { beat } = song;
  const bars = song.lead.length;
  const last = part === 'hook' ? Math.min(2, bars) : bars;
  const half = DRUM_HALVES[part] || null;
  const out = [];
  for (let b = 0; b < last; b += 1) {
    const bar = song.lead[b];
    for (let i = 0; i < beat; i += 1) {
      const at = b * beat + i;
      const tones = song.chords[b][i];
      if (part === 'lead' || part === 'hook') {
        const n = bar[i];
        if (n !== '-' && n !== '.') out.push({ at, len: holdLength(bar, i) * 0.95, midi: parseNote(n).midi });
      } else if (part === 'arp' && song.arp) {
        const order = song.arp.order === 'updown' ? [0, 1, 2, 1] : [0, 2, 1, 2];
        for (let k = 0; k < 2; k += 1) out.push({ at: at + k / 2, len: 0.4, midi: tones[order[(i * 2 + k) % order.length]] + ((song.arp.octave ?? 4) + 1) * 12 });
      } else if (part === 'bass') {
        const n = song.bass[i];
        if (n) out.push({ at, len: n[2] || 0.9, midi: tones[n[0]] + (n[1] + 1) * 12 });
      } else if (part === 'drums' || half) {
        const sets = song.drums;
        const set = sets[Math.min(sets.length - 1, Math.floor((b * sets.length) / bars))];
        const fill = song.fill && b === bars - 1 ? song.fill : null;
        for (const line of fill || set) {
          const ch = line[i];
          if (ch && ch !== '.' && (!half || half.includes(ch))) out.push({ at, kind: ch });
        }
      }
    }
  }
  partCache.set(key, out);
  return out;
}

// ---------- keys ----------

// the major and minor keys of each key signature (sharps +, flats -)
const MAJOR_OF = { '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };
const MINOR_OF = { '-7': 'Abm', '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm', '-1': 'Dm', 0: 'Am', 1: 'Em', 2: 'Bm', 3: 'F#m', 4: 'C#m', 5: 'G#m', 6: 'D#m', 7: 'A#m' };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'Db', 'C#', 'D', 'Eb', 'D#', 'E', 'F', 'Gb', 'F#', 'G', 'Ab', 'G#', 'A', 'Bb', 'A#', 'B'];
const pcOf = (name) => (PC[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;
const mod12 = (n) => ((n % 12) + 12) % 12;

/** A key's signature: sharps (+) or flats (-). */
export const sigOf = (key) => keyInfo(key).sig;

/** Whether two keys share a key signature (counting ones that sound the same, like F♯ and G♭). */
export const sameSig = (a, b) => mod12(sigOf(a) - sigOf(b)) === 0;

/**
 * The key a backing track plays in, in a mix in `mixKey`: a 'major' loop in the major key of
 * its key signature, a 'minor' loop in its relative minor. A mix with no key: C major, A minor.
 */
export function backingKey(mixKey, mood = 'major') {
  const sig = mixKey ? sigOf(mixKey) : 0;
  return mood === 'minor' ? MINOR_OF[sig] : MAJOR_OF[sig];
}

/** A key's key note as a pitch class (0 is C). */
export const keyTonic = (key) => pcOf(keyInfo(key).tonic);

/**
 * A key moved by k semitones, spelled with the fewest sharps or flats: shiftKey('F', 2) is
 * 'G', shiftKey('Dm', -2) is 'Cm'.
 */
export function shiftKey(key, k) {
  const m = /^([A-G][#b]?)(m|dor|lyd|mix)?$/.exec(key);
  if (!m) return key;
  const want = mod12(pcOf(m[1]) + k);
  let best = null;
  for (const name of NAMES) {
    if (pcOf(name) !== want) continue;
    let sig;
    try { sig = keyInfo(name + (m[2] || '')).sig; } catch { continue; }
    if (!best || Math.abs(sig) < best.sig) best = { key: name + (m[2] || ''), sig: Math.abs(sig) };
  }
  return best ? best.key : key;
}

// ---------- clips as notes ----------

/**
 * Where each kind of clip gets its notes: sound(clip) is 'notes', 'drums' or null (no notes
 * to change); events(clip, mixKey) its list, before any shift; steps(clip) how long it is
 * once through. A new source (the kid's own playing as a list of notes) plugs in here.
 */
const SOURCES = {
  part: {
    sound: (c) => (NOTE_PARTS.includes(c.part) ? 'notes' : DRUM_PARTS.includes(c.part) ? 'drums' : null),
    events: (c) => partEvents(c.song, c.part),
  },
  backing: {
    sound: (c) => (BACKING[c.pattern] ? (BACKING[c.pattern].kind === 'drums' ? 'drums' : 'notes') : null),
    events: (c, mixKey) => {
      const b = BACKING[c.pattern];
      if (!b) return [];
      if (b.kind === 'drums') return backingEvents(c.pattern);
      const loop = LOOPS[c.loop] ? c.loop : 'sunny';
      return backingEvents(c.pattern, { loop, tonic: keyTonic(backingKey(mixKey, LOOPS[loop].mood)) });
    },
  },
  // the kid's own playing, kept as notes { at, len, midi } (for a later kind of clip)
  notes: {
    sound: () => 'notes',
    events: (c) => (Array.isArray(c.notes) ? c.notes : []),
  },
};

/** What a clip holds that the remix kit can change: 'notes', 'drums', or null (a take). */
export const clipSound = (clip) => SOURCES[clip?.kind]?.sound(clip) || null;

/** A clip's notes or drums, before its shift (a backing track's follow the mix's key). */
export const clipEvents = (clip, mixKey = null) => SOURCES[clip?.kind]?.events(clip, mixKey) || [];

/** The lowest and highest notes of a list, or null when it has none. */
export function noteSpan(events) {
  let low = Infinity;
  let high = -Infinity;
  for (const e of events) {
    if (e.midi == null) continue;
    low = Math.min(low, e.midi);
    high = Math.max(high, e.midi);
  }
  return low <= high ? { low, high } : null;
}
