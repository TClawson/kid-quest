// Sheet music for the game's songs (the music house's sheet music stand, songbook.js): each
// song's lead written out for piano, as ABC notation for abcjs to engrave. The right hand
// plays the melody (moved down an octave or two when it sits high above the staff), the
// chord names go above it, and an easy left hand (root notes or chords) goes on a bass
// staff below. Also the songbook itself: which pieces there are, how hard each is, and
// which unlock with each piano. Pure logic, no DOM.

import { SONGS, SHOW_SONGS } from './songs.js';

const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ALTER = { '#': 1, b: -1, '': 0 };
const SIGN = { 1: '♯', '-1': '♭', 0: '' };

/** 'F#5' → { letter: 3, alter: 1, octave: 5, midi: 78 }. */
export function parseNote(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const letter = LETTERS.indexOf(m[1]);
  const alter = ALTER[m[2]];
  const octave = Number(m[3]);
  return { letter, alter, octave, midi: (octave + 1) * 12 + NATURAL[letter] + alter };
}

// ---------- keys ----------

// sharps and flats in key signatures, in the order they are added
const SHARPS = 'FCGDAEB';
const FLATS = 'BEADGCF';
// how many sharps (+) or flats (-) a major key has
const MAJOR_SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6 };
// a mode's key signature is the major key this many semitones below its tonic
const MODES = { '': ['major', 0], m: ['minor', 9], dor: ['dorian', 2], lyd: ['lydian', 5], mix: ['mixolydian', 7] };
const PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const pcOf = (name) => (NATURAL[LETTERS.indexOf(name[0])] + (ALTER[name.slice(1)] || 0) + 12) % 12;

/** 'Dm' → { tonic: 'D', mode: 'minor', sig: -1 }: the key's tonic, mode and sharps (+) or flats (-). */
export function keyInfo(key) {
  const m = /^([A-G][#b]?)(m|dor|lyd|mix)?$/.exec(key);
  if (!m) throw new Error(`bad key ${key}`);
  const [mode, below] = MODES[m[2] || ''];
  const major = PC_NAMES[(pcOf(m[1]) - below + 12) % 12];
  const sig = MAJOR_SIG[major === 'Gb' && m[1].includes('#') ? 'F#' : major];
  return { tonic: m[1], mode, sig };
}

/** How a key is shown to kids: 'C major', 'D minor', 'B♭ major', 'D dorian'. */
export function keyLabel(key) {
  const { tonic, mode } = keyInfo(key);
  return `${tonic[0]}${SIGN[ALTER[tonic.slice(1)]] || ''} ${mode}`;
}

/** The key signature as an alteration per letter (0 C ... 6 B). */
function signature(key) {
  const { sig } = keyInfo(key);
  const alter = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.abs(sig); i += 1) alter[LETTERS.indexOf((sig > 0 ? SHARPS : FLATS)[i])] = Math.sign(sig);
  return alter;
}

// ---------- chords ----------

/** 'Bbm' → [root, third, fifth] as notes { letter, alter } (spelled from the root up). */
export function chordNotes(name) {
  const m = /^([A-G])([#b]?)(m|dim)?$/.exec(name);
  if (!m) throw new Error(`bad chord ${name}`);
  const letter = LETTERS.indexOf(m[1]);
  const rootPc = NATURAL[letter] + ALTER[m[2]];
  const steps = [[0, 0], [2, m[3] ? 3 : 4], [4, m[3] === 'dim' ? 6 : 7]];
  return steps.map(([up, semis]) => {
    const l = (letter + up) % 7;
    let alter = ((rootPc + semis - NATURAL[l]) % 12 + 12) % 12;
    if (alter > 6) alter -= 12;
    return { letter: l, alter };
  });
}

/** A chord name as shown above the staff: 'Bb' → 'B♭', 'C#m' → 'C♯m'. */
export const chordLabel = (name) => name.replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭');

// ---------- rhythm ----------

/** A song's time: steps (eighth notes) a bar, the ABC meter, and where the beats fall. */
export function meterOf(song) {
  const steps = song.beat || 8;
  if (steps === 6) return { steps, meter: '3/4', middle: null }; // the waltz: three quarter notes
  return { steps, meter: '4/4', middle: 4 };
}

const WHOLE = [8, 6, 4, 3, 2, 1]; // note lengths in eighths that are a single note (dotted or not)

/**
 * Split a note of length len starting at step pos into notes that can be written, tied
 * together: a note that starts off the beat breaks at the middle of a 4/4 bar, and a
 * length that isn't one note (5, 7) breaks into the biggest that fits and the rest.
 */
export function splitLength(pos, len, meter) {
  const parts = [];
  let p = pos;
  let left = len;
  while (left > 0) {
    let room = left;
    if (meter.middle && p % 2 === 1 && p < meter.middle && p + left > meter.middle) room = meter.middle - p;
    const d = WHOLE.find((w) => w <= room);
    parts.push(d);
    p += d;
    left -= d;
  }
  return parts;
}

/** A bar's tokens to [{ pos, len, note|null }]: notes with their holds, and rests. */
export function barEvents(bar) {
  const t = bar.trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < t.length;) {
    let j = i + 1;
    while (j < t.length && t[j] === '-') j += 1;
    if (t[i] === '.') {
      // rests: a run of them (and any holds after them) is one rest
      while (j < t.length && (t[j] === '.' || t[j] === '-')) j += 1;
      out.push({ pos: i, len: j - i, note: null });
    } else {
      out.push({ pos: i, len: j - i, note: t[i] === '-' ? null : t[i] });
    }
    i = j;
  }
  return out;
}

// ---------- the songbook ----------

/** A piece's song data: 'bg-meadow' is a map song, 'show:bg-meadow' a secret show's tune. */
export function songById(id) {
  return id.startsWith('show:') ? SHOW_SONGS[id.slice(5)] : SONGS[id];
}

/**
 * How hard a piece is to play from the page, roughly: more notes a bar, more quick notes, a
 * wider reach, big jumps, sharps and flats (in the key signature or outside it),
 * syncopation and length all add to it. Tempo doesn't: kids play at their own speed.
 */
export function difficulty(song) {
  const meter = meterOf(song);
  const sig = signature(song.key);
  const notes = [];
  let offBeat = 0;
  for (const bar of song.lead) {
    for (const e of barEvents(bar)) {
      if (!e.note) continue;
      notes.push({ ...parseNote(e.note), len: e.len });
      if (e.pos % 2 === 1 && splitLength(e.pos, e.len, meter).length === 1 && e.len > 1) offBeat += 1;
    }
  }
  const n = Math.max(1, notes.length);
  const midis = notes.map((x) => x.midi);
  const reach = Math.max(...midis) - Math.min(...midis);
  const outside = notes.filter((x) => x.alter !== sig[x.letter]).length;
  const quick = notes.filter((x) => x.len === 1).length / n;
  const leaps = notes.slice(1).filter((x, i) => Math.abs(x.midi - notes[i].midi) > 4).length / n;
  const flats = sig.reduce((a, x) => a + Math.abs(x), 0);
  return Math.round((notes.length / song.lead.length) * 5 + quick * 15 + reach * 0.6 + outside * 2.5 + offBeat * 1.5 + leaps * 15 + flats * 3 + song.lead.length * 0.5);
}

/** How many pieces each piano opens (tier 1, 2, 3): easiest first. */
export const PIECES_PER_TIER = [6, 12, 18];

/**
 * Every piece in the songbook, easiest first: { id, name, key, bars, kind ('map' or 'show'),
 * map (the map's background id), level (difficulty), tier (the piano that opens it) }.
 */
export const SONGBOOK = (() => {
  const all = [
    ...Object.entries(SONGS).map(([map, s]) => ({ id: map, map, kind: 'map', song: s })),
    ...Object.entries(SHOW_SONGS).map(([map, s]) => ({ id: `show:${map}`, map, kind: 'show', song: s })),
  ].map((p) => ({ id: p.id, map: p.map, kind: p.kind, name: p.song.name, key: p.song.key, bars: p.song.lead.length, level: difficulty(p.song) }));
  all.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
  return all.map((p, i) => ({ ...p, tier: PIECES_PER_TIER.findIndex((n) => i < n) + 1 }));
})();

/** The songbook for a music house look (tier 1-3): every piece, with open: whether this piano has opened it. */
export function songbookFor(tier) {
  return SONGBOOK.map((p) => ({ ...p, open: p.tier <= tier }));
}

/** Stars for a piece's level (1-3), for the songbook list. */
export function stars(level) {
  const levels = SONGBOOK.map((p) => p.level);
  const lo = Math.min(...levels);
  const span = Math.max(...levels) - lo || 1;
  return 1 + Math.min(2, Math.floor(((level - lo) / span) * 3));
}

// ---------- ABC ----------

/** A note in ABC at a given octave shift: 'c'' style, with an accidental if one is needed. */
function abcPitch(letter, octave, accidental) {
  const name = LETTERS[letter];
  let s = octave >= 5 ? name.toLowerCase() : name;
  if (octave >= 6) s += "'".repeat(octave - 5);
  if (octave <= 3) s += ','.repeat(4 - octave);
  return `${accidental}${s}`;
}
const ACC = { 1: '^', '-1': '_', 0: '=' };

/** How far to move the melody (0, -1 or -2 octaves) so it sits on the treble staff. */
export function melodyShift(song) {
  const midis = song.lead.flatMap((b) => barEvents(b)).filter((e) => e.note).map((e) => parseNote(e.note).midi);
  const cost = (k) => midis.reduce((n, m) => n + Math.max(0, m + 12 * k - 81) + Math.max(0, 60 - (m + 12 * k)), 0);
  return [0, -1, -2].reduce((best, k) => (cost(k) < cost(best) ? k : best), 0);
}

const lengthText = (len) => (len === 1 ? '' : String(len));

/**
 * One piece as ABC notation for abcjs. o: {
 *   hands: 'melody' (right hand and chord names), 'roots' (+ the left hand's root notes) or
 *     'chords' (+ the left hand's chords),
 *   names: true to write each note's letter under it,
 *   perLine: bars on a line (the last lines are shared out evenly),
 * }
 */
export function songAbc(id, o = {}) {
  const song = songById(id);
  if (!song) throw new Error(`no song ${id}`);
  const hands = o.hands || 'roots';
  const perLine = Math.max(1, o.perLine || 4);
  const meter = meterOf(song);
  const sig = signature(song.key);
  const shift = melodyShift(song);
  const lines = Math.ceil(song.lead.length / perLine);
  const per = Math.ceil(song.lead.length / lines);

  const right = [];
  const words = [];
  const left = [];
  song.lead.forEach((bar, b) => {
    // accidentals hold for the rest of the bar, for the same note on the same line or space
    const held = new Map();
    const tokens = [];
    const names = [];
    const chord = `"${chordLabel(song.chords[b])}"`;
    let group = -1;
    for (const e of barEvents(bar)) {
      const parts = splitLength(e.pos, e.len, meter);
      let pos = e.pos;
      parts.forEach((len, k) => {
        // beam eighth notes within each half bar (each beat in the waltz)
        const g = meter.middle ? Math.floor(pos / meter.middle) : Math.floor(pos / 2);
        const gap = tokens.length && (g !== group || len > 1 || tokens[tokens.length - 1].len > 1) ? ' ' : '';
        group = g;
        let text;
        if (!e.note) {
          text = `z${lengthText(len)}`;
        } else {
          const n = parseNote(e.note);
          const octave = n.octave + shift;
          const spot = `${n.letter}${octave}`;
          const now = held.has(spot) ? held.get(spot) : sig[n.letter];
          const acc = n.alter !== now ? ACC[n.alter] : '';
          held.set(spot, n.alter);
          text = `${abcPitch(n.letter, octave, acc)}${lengthText(len)}${k < parts.length - 1 ? '-' : ''}`;
          names.push(k === 0 ? `${LETTERS[n.letter]}${SIGN[n.alter]}` : '*');
        }
        if (pos === 0) text = chord + text;
        tokens.push({ text: gap + text, len });
        pos += len;
      });
    }
    right.push(tokens.map((t) => t.text).join('').trim());
    words.push(names.join(' '));
    if (hands !== 'melody') left.push(leftHand(song.chords[b], hands, meter, sig));
  });

  const head = [
    'X:1',
    `M:${meter.meter}`,
    'L:1/8',
    `K:${song.key}`,
    hands === 'melody' ? '' : '%%score {(R) | (L)}',
    hands === 'melody' ? '' : 'V:R clef=treble',
    hands === 'melody' ? '' : 'V:L clef=bass',
  ].filter(Boolean);
  const body = [];
  for (let at = 0; at < song.lead.length; at += per) {
    const end = Math.min(song.lead.length, at + per);
    const last = end === song.lead.length;
    const bars = (list) => `${list.slice(at, end).join(' | ')} ${last ? '|]' : '|'}`;
    body.push(hands === 'melody' ? bars(right) : `[V:R] ${bars(right)}`);
    if (o.names) body.push(`w: ${words.slice(at, end).join(' | ')}`);
    if (hands !== 'melody') body.push(`[V:L] ${bars(left)}`);
  }
  return `${head.join('\n')}\n${body.join('\n')}\n`;
}

/** The left hand for one bar: the chord's root, or the whole chord, held all bar. */
function leftHand(name, hands, meter, sig) {
  const tones = chordNotes(name);
  const root = tones[0];
  // the root between G2 and F#3, so it sits on the bass staff
  const rootMidi = (o) => (o + 1) * 12 + NATURAL[root.letter] + root.alter;
  let octave = 2;
  while (rootMidi(octave) < 43) octave += 1;
  while (rootMidi(octave) > 54) octave -= 1;
  const held = new Map();
  const write = (t, oct) => {
    const spot = `${t.letter}${oct}`;
    const now = held.has(spot) ? held.get(spot) : sig[t.letter];
    held.set(spot, t.alter);
    return abcPitch(t.letter, oct, t.alter !== now ? ACC[t.alter] : '');
  };
  const len = lengthText(meter.steps);
  if (hands === 'roots') return `${write(root, octave)}${len}`;
  // the third and fifth above the root (moving up an octave when their letter wraps past B)
  const notes = tones.map((t) => write(t, octave + (t.letter < root.letter ? 1 : 0)));
  return `[${notes.join('')}]${len}`;
}
