// The medium and hard versions of the songbook's pieces (js/arrangements.js): two-hand piano
// arrangements written bar by bar in a small part of ABC notation. This file reads those bars
// (for the sheet music, the note names and for Listen), and writes a whole piece as ABC for
// abcjs. The easy version is the one sheetmusic.js writes from the song itself.
// Pure logic, no DOM.

import { ARRANGEMENTS } from './arrangements.js';
import { songById, signature, meterOf, chordLabel, lineRanges, SWING_MARK } from './sheetmusic.js';
import { barChords } from './songs.js';

const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ACCIDENTAL = { '^^': 2, '^': 1, '=': 0, _: -1, __: -2 };
const SIGN = { 2: '𝄪', 1: '♯', 0: '', '-1': '♭', '-2': '𝄫' };

/** The levels a piece can be shown at: easy is the song itself (sheetmusic.js). */
export const LEVELS = ['easy', 'medium', 'hard'];

/** Whether a piece has a medium or hard version yet. */
export const hasLevel = (id, level) => level === 'easy' || Boolean(ARRANGEMENTS[id]?.[level]);

/**
 * Read one bar of one hand: notes ('c', '^F,', '_b'''), chords ('[CEG]'), rests ('z'), with
 * lengths in eighth notes (L:1/8: '2' a quarter, '3' a dotted quarter, '/2' or '/' a
 * sixteenth, '3/2' a dotted eighth) and ties ('-', also into the next bar). Slurs '( )',
 * decorations ('!p!', '!f!', '.' staccato) and spaces (beaming) are allowed and skipped.
 * Accidentals hold for the rest of the bar, for the same note on the same line or space, on
 * top of the key signature (sig: an alteration per letter, from signature()).
 * A hand can play two voices in one bar (the concert pieces, longpieces.js): '&' starts the
 * next voice, which counts again from the start of the bar; 'x' is a rest that isn't printed
 * (a voice that waits). Accidentals don't carry from one voice to the other.
 * Returns { events: [{ start, len, notes: [{ letter, alter, octave, midi }], tie, col, voice,
 * hidden }] (a rest has no notes, and hidden when it's an x; col is where it starts in the
 * text; voice 0 is the first), length (eighths: the longest voice), lengths (each voice's),
 * first (where the first note, chord or rest starts in the text), errors: [text] }.
 */
export function readAbcBar(text, sig) {
  const events = [];
  const errors = [];
  let held = new Map();
  const lengths = [];
  let voice = 0;
  let at = 0;
  let first = -1;
  let i = 0;
  const s = String(text);

  const length = () => {
    const m = /^(\d*)((?:\/\d*)*)/.exec(s.slice(i));
    i += m[0].length;
    let len = m[1] ? Number(m[1]) : 1;
    for (const part of m[2].split('/').slice(1)) len /= part ? Number(part) : 2;
    return len;
  };
  const pitch = () => {
    const m = /^(\^\^|\^|=|__|_)?([A-Ga-g])([,']*)/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    const letter = LETTERS.indexOf(m[2].toUpperCase());
    let octave = m[2] === m[2].toUpperCase() ? 4 : 5;
    for (const c of m[3]) octave += c === "'" ? 1 : -1;
    const spot = `${letter}${octave}`;
    if (m[1] !== undefined) held.set(spot, ACCIDENTAL[m[1]]);
    const alter = held.has(spot) ? held.get(spot) : sig[letter];
    return { letter, alter, octave, midi: (octave + 1) * 12 + NATURAL[letter] + alter };
  };

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) || c === ')' || c === '.') { i += 1; continue; }
    if (c === '(') {
      if (/\d/.test(s[i + 1] || '')) { errors.push(`triplets aren't supported: ${s.slice(i, i + 4)}`); i += 2; continue; }
      i += 1;
      continue;
    }
    if (c === '!') {
      const end = s.indexOf('!', i + 1);
      if (end < 0) { errors.push('a ! decoration is not closed'); break; }
      i = end + 1;
      continue;
    }
    if (c === '"') {
      const end = s.indexOf('"', i + 1);
      if (end < 0) { errors.push('a " is not closed'); break; }
      i = end + 1;
      continue;
    }
    if (c === '&') {
      // the next voice: from the start of the bar again, with its own accidentals
      lengths.push(at);
      voice += 1;
      at = 0;
      held = new Map();
      i += 1;
      continue;
    }
    const start = i;
    let notes = null;
    const hidden = c === 'x';
    if (c === 'z' || c === 'x') {
      i += 1;
      notes = [];
    } else if (c === '[') {
      i += 1;
      notes = [];
      while (i < s.length && s[i] !== ']') {
        if (/\s/.test(s[i])) { i += 1; continue; }
        const n = pitch();
        if (!n) { errors.push(`can't read the chord at "${s.slice(start, start + 12)}"`); i = s.indexOf(']', i); if (i < 0) i = s.length; break; }
        if (/^[\d/]/.test(s.slice(i))) { errors.push(`a note inside a chord can't have its own length: ${s.slice(start, start + 12)}`); length(); }
        notes.push(n);
      }
      i += 1;
      if (!notes.length) errors.push('an empty chord');
    } else {
      const n = pitch();
      if (!n) { errors.push(`can't read "${s.slice(i, i + 8)}"`); i += 1; continue; }
      notes = [n];
    }
    const len = length();
    let tie = false;
    if (s[i] === '-') { tie = true; i += 1; }
    if (/^[<>]/.test(s.slice(i))) { errors.push(`broken rhythm (> <) isn't supported: ${s.slice(start, i + 2)}`); i += 1; }
    if (!(len > 0)) errors.push(`a bad length at "${s.slice(start, i)}"`);
    if (first < 0) first = start;
    const event = { start: at, len, notes, tie: tie && notes.length > 0, col: start, voice };
    if (hidden) event.hidden = true;
    events.push(event);
    at += len;
  }
  lengths.push(at);
  return { events, length: Math.max(...lengths), lengths, first: first < 0 ? 0 : first, errors };
}

/**
 * Both hands of a piece's version, bar by bar: { rh: [readAbcBar], lh: [readAbcBar] }.
 * version: the version's { rh, lh } (by default the one in arrangements.js).
 */
export function arrangementBars(id, level, version = ARRANGEMENTS[id]?.[level]) {
  const song = songById(id);
  const arr = version;
  if (!song || !arr) return null;
  const sig = signature(song.key);
  return { rh: arr.rh.map((b) => readAbcBar(b, sig)), lh: arr.lh.map((b) => readAbcBar(b, sig)) };
}

/**
 * Every note of a version to play: [{ midi, start, len, hand: 'rh'|'lh' }], in eighths from
 * the start of the piece, with tied notes joined into one.
 */
export function arrangementNotes(id, level, version = ARRANGEMENTS[id]?.[level]) {
  const bars = arrangementBars(id, level, version);
  if (!bars) return [];
  const steps = meterOf(songById(id)).steps;
  const out = [];
  for (const hand of ['rh', 'lh']) {
    let open = new Map(); // midi → the note a tie carries on
    bars[hand].forEach((bar, b) => {
      for (const e of bar.events) {
        const start = b * steps + e.start;
        const next = new Map();
        for (const n of e.notes) {
          const tied = open.get(n.midi);
          let note = tied && Math.abs(tied.start + tied.len - start) < 1e-6 ? tied : null;
          if (note) note.len += e.len;
          else { note = { midi: n.midi, start, len: e.len, hand }; out.push(note); }
          if (e.tie) next.set(n.midi, note);
        }
        open = next;
      }
    });
  }
  return out.sort((a, b) => a.start - b.start || a.midi - b.midi);
}

/** A note's name for the note names under the music: 'F♯'. */
const noteName = (n) => `${LETTERS[n.letter]}${SIGN[n.alter]}`;

/**
 * A piece's version as ABC for abcjs: both hands on a grand staff, the song's chord names
 * above the right hand, and (o.names) the name of the right hand's top note under each note.
 * o.perLine: bars on a line (the last lines are shared out evenly).
 */
export function arrangementAbc(id, level, o = {}, version = ARRANGEMENTS[id]?.[level]) {
  const song = songById(id);
  const arr = version;
  if (!song || !arr) throw new Error(`no ${level} version of ${id}`);
  const meter = meterOf(song);
  const sig = signature(song.key);
  const perLine = Math.max(1, o.perLine || 4);

  let carried = null; // the top note a tie from the bar before carries on
  const right = arr.rh.map((text, b) => {
    const { events } = readAbcBar(text, sig);
    let out = text;
    // each chord's name goes on the note (or rest) that starts with it, or the first one after;
    // from the bar's last chord back, so the places found in the text stay right
    for (const c of barChords(song.chords[b], meter.steps).reverse()) {
      const e = events.find((x) => x.start >= c.pos - 1e-6);
      if (e) out = `${out.slice(0, e.col)}"${chordLabel(c.name)}"${out.slice(e.col)}`;
    }
    return out.trim();
  });
  const words = arr.rh.map((text) => {
    const names = [];
    for (const e of readAbcBar(text, sig).events) {
      if (!e.notes.length) { carried = null; continue; }
      const top = e.notes.reduce((a, n) => (n.midi > a.midi ? n : a));
      names.push(carried === top.midi ? '*' : noteName(top));
      carried = e.tie ? top.midi : null;
    }
    return names.join(' ');
  });

  const head = ['X:1', `M:${meter.meter}`, 'L:1/8', ...(song.swing ? [SWING_MARK] : []), `K:${song.key}`, '%%score {(R) | (L)}', 'V:R clef=treble', 'V:L clef=bass'];
  const body = [];
  for (const [at, end] of lineRanges(song.lead.length, perLine)) {
    const close = end === song.lead.length ? '|]' : '|';
    body.push(`[V:R] ${right.slice(at, end).join(' | ')} ${close}`);
    if (o.names) body.push(`w: ${words.slice(at, end).join(' | ')}`);
    body.push(`[V:L] ${arr.lh.slice(at, end).join(' | ')} ${close}`);
  }
  return `${head.join('\n')}\n${body.join('\n')}\n`;
}
