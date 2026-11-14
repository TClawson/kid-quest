// A song from the composing desk (composerules.js) as piano sheet music, for abcjs to engrave
// and the kid to print: their tune in the right hand with the chord names over it, the chords
// in the left hand (the bass note, then the chord, the way the desk's steady groove plays them),
// between repeat signs since the loop plays twice, and the kid's name as the composer.
//
// Notes are spelled for the key by scale step, so a raised seventh in D minor is C♯ (not D♭)
// and the borrowed chord in C major is B♭ (not A♯).

import { METERS, BARS, chordDef, chordName, chordPcs, voicing, noteName, keyName, JOB_NAME } from './composerules.js';

const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
// the scale step each distance from home is written on: the in-between notes are the ♭2, ♭3,
// ♯4, ♭6 and ♭7 (and in minor the raised 3, 6 and 7 land on the 3rd, 6th and 7th steps)
const STEP_OF = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
const ACC = { '-2': '__', '-1': '_', 0: '=', 1: '^', 2: '^^' };
// eighth notes a beam joins: half a bar in 4/4, a beat in 3/4, a dotted beat in 6/8
const BEAM = { '4/4': 4, '3/4': 2, '6/8': 3 };
// the speed mark: a quarter note a beat, or in 6/8 a dotted quarter
const TEMPO = { '4/4': '1/4', '3/4': '1/4', '6/8': '3/8' };

const tonicLetter = (key) => LETTERS.indexOf(noteName(key, key.tonic)[0]);

/** How a pitch class is written in a key: { li (letter index in CDEFGAB), alter (-2..2) }. */
export function spell(key, pc) {
  const li = (tonicLetter(key) + STEP_OF[(pc - key.tonic + 12) % 12]) % 7;
  return { li, alter: ((pc - NATURAL[li] + 18) % 12) - 6 };
}

/** The key signature: each letter's sharp (1), flat (-1) or natural (0). */
export function keySignature(key) {
  const steps = key.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const sig = Array(7).fill(0);
  for (const s of steps) { const { li, alter } = spell(key, (key.tonic + s) % 12); sig[li] = alter; }
  return sig;
}

/** The key for abcjs's K: field, like "Bb", "F#m". */
export const abcKey = (key) => `${noteName(key, key.tonic).replace('♯', '#').replace('♭', 'b')}${key.mode === 'minor' ? 'm' : ''}`;

/** One pitch as ABC, with the accidental the bar needs (held: the bar's accidentals so far). */
function pitch(midi, sp, sig, held) {
  const octave = Math.floor((midi - sp.alter) / 12) - 1;
  const spot = `${sp.li}${octave}`;
  const now = held.has(spot) ? held.get(spot) : sig[sp.li];
  held.set(spot, sp.alter);
  const acc = sp.alter !== now ? ACC[sp.alter] : '';
  const L = LETTERS[sp.li];
  return acc + (octave >= 5 ? L.toLowerCase() + "'".repeat(octave - 5) : L + ','.repeat(Math.max(0, 4 - octave)));
}

const lenText = (n) => (n === 1 ? '' : String(n));

/**
 * Whether a note of `len` eighths can start at `pos` in a bar without hiding a beat (whole:
 * the note is only this long, so off the beat it may be a quarter: eighth, quarter, eighth).
 */
function fits(meter, pos, len, whole) {
  if (meter !== '6/8' && pos % 2 && len > 1 && !(len === 2 && whole)) return false;
  if (meter === '4/4') {
    if (![1, 2, 3, 4, 6, 8].includes(len)) return false;
    if (len >= 6) return pos === 0;
    if (len === 4) return pos === 0 || pos === 4;
    if (len === 3) return pos % 2 === 0 && (pos + len <= 4 || pos >= 4);
    return pos + len <= 4 || pos >= 4;
  }
  if (meter === '3/4') {
    if (![1, 2, 3, 4, 6].includes(len)) return false;
    if (len === 6) return pos === 0;
    if (len === 4) return pos === 0 || pos === 2;
    if (len === 3) return pos % 2 === 0;
    return true;
  }
  // 6/8: nothing crosses the middle of the bar but a whole bar's note
  if (![1, 2, 3, 6].includes(len)) return false;
  if (len === 6) return pos === 0;
  if (len === 3) return pos === 0 || pos === 3;
  return pos + len <= 3 || pos >= 3;
}

/** A held note (or a rest) of `len` eighths from `pos`, cut into lengths a kid can read. */
export function pieces(meter, pos, len) {
  const out = [];
  while (len > 0) {
    let n = len;
    while (n > 1 && !fits(meter, pos, n, n === len && !out.length)) n -= 1;
    out.push(n);
    pos += n;
    len -= n;
  }
  return out;
}

/**
 * The tune as events in each bar: [[{ pos, len, midi|null, tie }]]. A note runs over the
 * steps after it that are empty (null); 'z' starts a rest, and so do the empty steps before
 * the first note. A note held over a bar line is tied into the next bar.
 */
export function tuneBars(song) {
  const st = METERS[song.meter].steps;
  const runs = [];
  song.tune.forEach((v, i) => {
    if (Number.isInteger(v)) runs.push({ at: i, len: 1, midi: v });
    else if (v === 'z' || !runs.length) {
      const last = runs[runs.length - 1];
      if (v !== 'z' && last) last.len += 1; else runs.push({ at: i, len: 1, midi: null });
    } else runs[runs.length - 1].len += 1;
  });
  const bars = Array.from({ length: BARS }, () => []);
  for (const r of runs) {
    let at = r.at;
    const end = r.at + r.len;
    while (at < end) {
      const b = Math.floor(at / st);
      const to = Math.min(end, (b + 1) * st);
      bars[b].push({ pos: at - b * st, len: to - at, midi: r.midi, tie: r.midi !== null && to < end });
      at = to;
    }
  }
  return bars;
}

/** The right hand's bar: the tune, beamed by beat, with the chord name on its first note. */
function rightBar(song, events, chord, sig) {
  const held = new Map();
  const group = BEAM[song.meter];
  let out = '';
  let lastLen = 0;
  let lastGroup = -1;
  events.forEach((e, k) => {
    const parts = pieces(song.meter, e.pos, e.len);
    let pos = e.pos;
    parts.forEach((len, j) => {
      const g = Math.floor(pos / group);
      const gap = out && (g !== lastGroup || len > 1 || lastLen > 1) ? ' ' : '';
      let text = e.midi === null ? `z${lenText(len)}` : `${pitch(e.midi, spell(song.key, e.midi % 12), sig, held)}${lenText(len)}`;
      if (e.midi !== null && (j < parts.length - 1 || e.tie)) text += '-';
      if (k === 0 && j === 0) text = `"${chord}"${text}`;
      out += gap + text;
      lastLen = len;
      lastGroup = g;
      pos += len;
    });
  });
  return out;
}

/** The chord's notes stacked from its root letter: [{ midi, sp }] above `bass`, within an octave. */
function chordTones(song, c, bass) {
  const root = spell(song.key, (song.key.tonic + c.r) % 12);
  return chordPcs(song.key, c).map((pc, i) => {
    const li = (root.li + 2 * i) % 7;
    const midi = bass + (((pc - bass) % 12 + 12) % 12 || 12);
    return { midi, sp: { li, alter: ((pc - NATURAL[li] + 18) % 12) - 6 } };
  }).sort((a, b) => a.midi - b.midi);
}

/**
 * The left hand's bar: the chord's bass note then the chord (4/4: a half note of each; 3/4:
 * oom-pah-pah; 6/8: a dotted quarter of each). When the tune dips into the chord, the hand
 * leaves out the chord notes it would cross, or just holds the bass note.
 */
function leftBar(song, c, low, sig) {
  const held = new Map();
  const st = METERS[song.meter].steps;
  let { bass } = voicing(song.key, c);
  const root = spell(song.key, bass % 12);
  // under a low tune, only the chord notes below it (or just the bass note)
  const tones = chordTones(song, c, bass).filter((t) => t.midi < low);
  if (tones.length < 2) {
    while (bass >= low && bass > 36) bass -= 12;
    return `${pitch(bass, root, sig, held)}${lenText(st)}`;
  }
  const b = (n) => `${pitch(bass, root, sig, held)}${lenText(n)}`;
  const ch = (n) => `[${tones.map((t) => pitch(t.midi, t.sp, sig, held)).join('')}]${lenText(n)}`;
  if (song.meter === '4/4') return `${b(4)} ${ch(4)}`;
  if (song.meter === '3/4') return `${b(2)} ${ch(2)} ${ch(2)}`;
  return `${b(3)} ${ch(3)}`;
}

/** ABC can't hold a line break or a % (a comment) in a header line. */
const headerText = (s) => String(s).replace(/[\r\n%\\]/g, ' ').replace(/\s+/g, ' ').trim();

/** What the second time round asks for (printed under the music). */
export const SECOND_LINE = {
  same: 'Play it twice.',
  high: 'Play it twice: the second time, the tune an octave higher.',
  echo: 'Play it twice: the second time, add an echo up high.',
};

/**
 * A desk song as ABC for abcjs: a grand staff, `perLine` bars to a line, between repeat signs.
 * by: the composer's name.
 */
export function deskSongAbc(song, { by = '', perLine = 4 } = {}) {
  const m = METERS[song.meter];
  const sig = keySignature(song.key);
  const bars = tuneBars(song);
  const right = [];
  const left = [];
  for (let b = 0; b < BARS; b += 1) {
    const c = chordDef(song.key.mode, song.bars[b]);
    const name = chordName(song.key, c);
    right.push(rightBar(song, bars[b], name, sig));
    const notes = bars[b].filter((e) => e.midi !== null).map((e) => e.midi);
    left.push(leftBar(song, c, notes.length ? Math.min(...notes) : Infinity, sig));
  }
  const head = [
    'X:1',
    `T:${headerText(song.name || 'My song')}`,
    `T:${headerText(`${keyName(song.key)} · ${song.meter}`)}`,
    by ? `C:${headerText(`Music by ${by}`)}` : '',
    `M:${m.id}`,
    'L:1/8',
    `Q:${TEMPO[song.meter]}=${song.bpm}`,
    `K:${abcKey(song.key)}`,
    '%%score {(R) | (L)}',
    'V:R clef=treble',
    'V:L clef=bass',
  ].filter(Boolean);
  const per = Math.max(1, Math.min(BARS, perLine));
  const body = [];
  for (let at = 0; at < BARS; at += per) {
    const end = Math.min(BARS, at + per);
    const line = (list) => `${at === 0 ? '|: ' : ''}${list.slice(at, end).join(' | ')} ${end === BARS ? ':|' : '|'}`;
    body.push(`[V:R] ${line(right)}`, `[V:L] ${line(left)}`);
  }
  return `${head.join('\n')}\n${body.join('\n')}\n`;
}

/** The chords under the sheet, bar by bar, with their jobs: [{ bar, name, job, jobName }]. */
export function sheetChords(song) {
  return song.bars.map((rn, i) => {
    const c = chordDef(song.key.mode, rn);
    return { bar: i + 1, name: chordName(song.key, c), job: c.job, jobName: JOB_NAME[c.job] };
  });
}
