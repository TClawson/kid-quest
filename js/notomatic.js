// The Note-o-Matic's readings: what the ears heard (listener.js: piano keys and the seconds they
// were struck) turned into music the studio can play as a clip of notes. Three readings:
//
//   As I heard it  every note where it was played, to the hundredth of a second.
//   Tidied         the same notes set on the beat: chords struck together, even eighths (or
//                  sixteenths when the playing has them), notes held on to the next one.
//   Band version   the tune alone (the top line), with a band part made for it: the chords
//                  that fit each bar, played as a bass note and chord.
//
// Time is counted in steps (eighth notes) at the mix's speed, as in remix.js. A studio take is
// recorded against clicks, so where the beats are is known: Tidied first checks whether the
// playing kept to them. When it didn't (a kid who plays at their own speed, or stops to find
// a note), it works from the gaps between the notes instead, so the tune comes out even at the
// mix's speed. Pure arithmetic: no DOM and no sound.

import { LOWEST, HIGHEST } from './remix.js';

/** The readings a kid can pick, in the order they are shown. */
export const READINGS = [
  { id: 'heard', name: 'As I heard it', about: 'Every note just where you played it.' },
  { id: 'tidy', name: 'Tidied', about: 'Your notes, set neatly on the beat.' },
  { id: 'band', name: 'Band version', about: 'Your tune on top, with a band part made for it.' },
];

const TOGETHER = 0.05; // seconds: a note struck within this of the one before belongs to its chord
const SPREAD = 0.12; // seconds: but a chord is never spread wider than this
const LATE = 0.08; // seconds: a kid on the clicks is at most this far behind or ahead of them
const LONGEST = 8; // steps: no tidied note is held longer than this
const DOTTED = 0.58; // steps: the short note of a dotted pair is shorter than this (an uneven eighth is longer)
const WIDE_FROM = 3.4; // steps: playing whose gaps are nearly all this long or longer is slow playing
const round3 = (x) => Math.round(x * 1000) / 1000;
const mod = (n, m) => ((n % m) + m) % m;
const fold = (midi) => { let m = midi; while (m < LOWEST) m += 12; while (m > HIGHEST) m -= 12; return m; };

/** What was heard, in steps from the take's beat: [{ at, len, midi, vel }], by time. */
export function inSteps(heard, { bpm, lead = 0 }) {
  const per = bpm / 30; // steps in a second
  return heard
    .filter((n) => Number.isFinite(n.midi) && Number.isFinite(n.on))
    .map((n) => ({ at: Math.max(0, (n.on - lead) * per), len: Math.max(0.1, ((n.off ?? n.on + 0.2) - n.on) * per), midi: fold(Math.round(n.midi)), vel: n.vel ?? 0.6 }))
    .sort((a, b) => a.at - b.at || a.midi - b.midi);
}

/**
 * Notes struck together: each within `within` steps of the one before (a kid's chord is never
 * struck quite at once, and low notes are heard a touch later), and no chord wider than
 * `spread`. [{ at (the middle of its notes), notes }].
 */
export function strikes(notes, within, spread = 2.4 * within) {
  const out = [];
  for (const n of notes) {
    const g = out[out.length - 1];
    if (g && n.at - g.last <= within && n.at - g.first <= spread) { g.notes.push(n); g.last = n.at; }
    else out.push({ first: n.at, last: n.at, notes: [n] });
  }
  return out.map((g) => ({ at: g.notes.reduce((s, n) => s + n.at, 0) / g.notes.length, notes: g.notes }));
}

// ---------- on the beat, or not ----------

/** Where a song's swing puts a spot in the music (as music.js swingAt), and back again. */
export function swung(x, swing = 0) {
  const pair = Math.floor(x / 2) * 2;
  const r = x - pair;
  return pair + (r < 1 ? r * (1 + swing) : 1 + swing + (r - 1) * (1 - swing));
}

// the nearest of a beat's spots (steps within the beat, from 0) to x
function nearest(x, spots) {
  const beat = Math.floor(x / 2) * 2;
  let best = beat + 2;
  for (const s of spots) if (Math.abs(beat + s - x) < Math.abs(best - x)) best = beat + s;
  return best;
}

/**
 * How well strike times (steps) sit on a grid whose spots within a beat are `spots`: the
 * grid may sit a little early or late as a whole (`off`, at most `most` steps: a kid who is
 * always a touch behind the click); `err` is what is left, as a root mean square in steps.
 */
export function gridFit(xs, spots, most = 0.3) {
  return fitGrid(xs, spots, most);
}
function fitGrid(xs, spots, most) {
  if (!xs.length) return { off: 0, err: 0 };
  let off = 0;
  let err = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    let sum = 0; let sq = 0;
    for (const x of xs) { const d = x - off - nearest(x - off, spots); sum += d; sq += d * d; }
    err = Math.sqrt(sq / xs.length);
    if (pass < 3) off = Math.max(-most, Math.min(most, off + sum / xs.length));
  }
  return { off, err };
}

/**
 * Whether the playing kept to the clicks, and on which grid: { grid: 1 (eighths) or 0.5
 * (sixteenths), swing (how much its eighths swing, 0 for straight), off }, or null when it
 * did not. `swing` is the mix's own (0 when it doesn't swing); `most` how far (in steps) the
 * whole playing may sit off the clicks and still be keeping to them.
 */
export function clickGrid(xs, swing = 0, most = 0.3) {
  if (xs.length < 2) return xs.length ? { grid: 1, swing: 0, off: 0 } : null;
  const gridFit = (list, spots) => fitGrid(list, spots, most);
  const straight = gridFit(xs, [0, 1]);
  // swung eighths: how far the second of each pair leans is measured from the playing itself
  let lilt = swing > 0 ? swing : 1 / 3;
  let swings = gridFit(xs, [0, 1 + lilt]);
  for (let pass = 0; pass < 2; pass += 1) {
    const late = xs.map((x) => x - swings.off).filter((x) => mod(nearest(x, [0, 1 + lilt]), 2) > 0.5).map((x) => mod(x, 2) - 1);
    if (late.length < 3) break;
    lilt = Math.max(0.1, Math.min(0.45, late.reduce((s, v) => s + v, 0) / late.length));
    swings = gridFit(xs, [0, 1 + lilt]);
  }
  const fine = gridFit(xs, [0, 0.5, 1, 1.5]);
  const eighths = swings.err < 0.8 * straight.err ? { ...swings, swing: lilt } : { ...straight, swing: 0 };
  // sixteenths only when the playing is clearly that exact (any playing is "near" a fine grid)
  // (a fit that only works with the grid pushed as far off as it may go is no fit)
  const edge = (f) => Math.abs(f.off) >= most - 1e-9;
  if (fine.err <= 0.1 && fine.err < 0.6 * eighths.err && !edge(fine)) {
    // Sixteenths have notes on the eighths too. When nearly every strike sits on the fine
    // grid's in-between spots, these are eighths played a steady sixteenth off the clicks: a
    // kid who waits for each click before playing, or a take lined up a little wrong. Late
    // is the likelier of the two, so it wins when the playing sits right in the middle.
    const between = xs.filter((x) => mod(Math.round((x - fine.off) * 2), 2) === 1).length;
    if (between > 0.85 * xs.length) return { grid: 1, swing: 0, off: fine.off <= 0.05 ? fine.off + 0.5 : fine.off - 0.5 };
    return { grid: 0.5, swing: 0, off: fine.off };
  }
  // Playing that takes no notice of the clicks is off by 0.29 of a step, a kid on the clicks
  // by half of that or less. With many strikes the line can be drawn close to 0.29; with few,
  // chance alone can look tidy, so it is drawn lower.
  const line = Math.max(0.19, Math.sqrt(Math.max(0, 1 / 12 - 0.19 / Math.sqrt(xs.length))) - 0.01);
  if (eighths.err <= line && !edge(eighths)) return { grid: 1, swing: eighths.swing, off: eighths.off };
  return null;
}

/**
 * Playing that doesn't keep to the clicks, set even from its own gaps: the length of its own
 * step is found (the one the gaps between strikes are whole numbers of, near the mix's), and
 * followed as the kid speeds up and slows down; each gap becomes a whole number of steps (a
 * half for a quick pair, none for the rest of a chord). Returns each strike's place in steps;
 * the first stays where it is. `from` and `to`: how short and long its step may be, in steps
 * (nearer 1 when the steps were counted at the playing's own speed).
 */
export function ownGrid(xs, { from = 0.7, to = 1.4 } = {}) {
  if (!xs.length) return [];
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  let unit = 1;
  let top = -Infinity;
  let halves = false;
  let wholeUnit = 1;
  let topWhole = -Infinity;
  const fit = (u) => { let s = 0; for (const g of gaps) if (g <= 6 * u) s += Math.cos((2 * Math.PI * g) / u); return s / Math.max(1, gaps.length); };
  for (let u = from; u < to; u *= 1.02) {
    // gaps that are whole steps, or (a little less likely) whole and half steps
    const whole = fit(u);
    const half = fit(u / 2) - 0.1;
    // nearer the mix's own speed wins a tie
    const score = Math.max(whole, half) - 0.15 * Math.abs(Math.log2(u));
    if (score > top) { top = score; unit = u; halves = half > whole; }
    const plain = whole - 0.15 * Math.abs(Math.log2(u));
    if (plain > topWhole) { topWhole = plain; wholeUnit = u; }
  }
  // half steps (a quick pair of notes) only for playing that clearly has them: an uneven
  // eighth must not be taken for one
  // (and then its step is the one that whole steps fit best)
  if (halves && gaps.filter((g) => g / unit > 0.3 && g / unit < 0.68).length < 2) { halves = false; unit = wholeUnit; }
  if (halves) {
    // Swung eighths (long, short, long, short: two to one) look like steps a third longer with
    // a half step after each: but then every short note stands alone between two whole steps,
    // which real quick notes seldom do. They are plain eighths, played unevenly.
    const ks = gaps.map((g) => g / unit);
    const whole = (k) => k == null || (k >= 0.8 && k <= 1.25);
    const short = ks.map((k, i) => (k > 0.3 && k < 0.68 ? i : -1)).filter((i) => i >= 0);
    const alone = short.filter((i) => i > 0 && whole(ks[i - 1]) && whole(ks[i + 1]));
    if (short.length >= 3 && alone.length >= 0.7 * short.length) { unit *= 0.75; halves = false; }
  }
  const out = [Math.round(xs[0])];
  let u = unit;
  let held = 0; // the last strike on a step before a squeezed one
  let owed = 0; // the steps the next gap takes, decided with the gap before it
  gaps.forEach((g, i) => {
    const k = g / u;
    // (a strike right after another is the rest of the same chord: it stays in its place)
    let steps = k < 0.3 ? 0 : halves && k < 0.75 ? 0.5 : Math.max(1, Math.round(k));
    const part = k - Math.floor(k);
    const paid = owed > 0; // this gap's steps were settled with the gap before it
    if (paid) { steps = owed; owed = 0; } else if (halves && k >= 0.75 && part >= 0.25 && part <= 0.75) {
      // Playing with half steps in it. A long note and the short one after it that together
      // make whole steps are a dotted pair (a step and a half, then a half) when the short one
      // is short enough, else two uneven notes, set even. A gap of some steps and a half after
      // a short note comes back to a whole step. Without this each pair ran half a step long.
      const next = i + 1 < gaps.length ? gaps[i + 1] / u : Infinity;
      const both = Math.round(k + next);
      if (!Number.isInteger(out[i])) steps = Math.floor(k) + 0.5;
      else if (next >= 0.3 && next < 0.8 && Math.abs(k + next - both) <= 0.3) { owed = next < DOTTED ? 0.5 : 1; steps = both - owed; }
    }
    if (!halves && !paid && k >= 0.3) {
      // A strike squeezed in between two steps (a hand that comes in late, a slip of a finger)
      // takes half a step when the strike after it makes the step whole, and what follows is
      // counted from the strike before the squeezed one: it must not push the rest a step late.
      const next = i + 1 < gaps.length ? gaps[i + 1] / u : Infinity;
      if (k >= 1.2 && k <= 1.8 && Number.isInteger(out[i]) && next >= 0.45 && next <= 0.85 && Math.abs(k + next - 2) <= 0.3) {
        // a long eighth and a short one that make a beat together (swung eighths): two steps
        steps = 1; owed = 1;
      } else if (!Number.isInteger(out[i])) {
        const since = (xs[i + 1] - xs[held]) / u;
        steps = since < 0.75 ? 0 : out[held] + Math.max(1, Math.round(since)) - out[i];
      } else if (k < 0.75 && k + next >= 0.7 && k + next <= 1.3) { steps = 0.5; held = i; }
    }
    // A long gap that falls between two counts goes to the one that lands the next strike
    // on a beat, and a very long one leans short as well: a gap that is a little too long
    // is a kid finding the next note, and the bars after it should still line up.
    const lo = Math.floor(k);
    const between = k - lo > 0.25 && k - lo < (k >= 7 ? 0.9 : 0.75);
    if (k >= 4.5 && between && Number.isInteger(out[i])) steps = (out[i] + lo) % 2 === 0 ? lo : lo + 1;
    out.push(out[i] + steps);
    // follow the kid's speed, a little at a time, and only on gaps that are clear
    if (!paid && !owed && steps >= 1 && steps <= 4 && Math.abs(k - steps) <= 0.25) u = Math.max(0.85 * unit, Math.min(1.18 * unit, u + 0.2 * (g / steps - u)));
  });
  return out;
}

// ---------- hands ----------

/**
 * The key between the hands, when two hands were playing: notes at or above it are the right
 * hand's. null for one hand (or music all in one place).
 */
export function handSplit(notes) {
  const ps = notes.map((n) => n.midi).sort((a, b) => a - b);
  if (ps.length < 6 || ps[ps.length - 1] - ps[0] < 15) return null;
  const total = ps.reduce((s, p) => s + p, 0);
  let best = null;
  let low = 0;
  for (let i = 1; i < ps.length; i += 1) {
    low += ps[i - 1];
    if (ps[i] === ps[i - 1] || i < 0.15 * ps.length || i > 0.85 * ps.length) continue;
    const a = low / i; const b = (total - low) / (ps.length - i);
    // the widest gap between two well-filled groups
    const score = i * (ps.length - i) * (b - a) ** 2 * (1 + (ps[i] - ps[i - 1]) / 12);
    if (!best || score > best.score) best = { score, at: ps[i], apart: b - a };
  }
  return best && best.apart >= 12 ? best.at : null;
}

// ---------- the key ----------

// how much each step of a major and a minor scale belongs (Temperley's profiles)
const MAJOR_FIT = [5, 2, 3.5, 2, 4.5, 4, 2, 4.5, 2, 3.5, 1.5, 4];
const MINOR_FIT = [5, 2, 3.5, 4.5, 2, 4, 2, 4.5, 3.5, 2, 1.5, 4];
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

function correlate(a, b) {
  const ma = a.reduce((s, v) => s + v, 0) / 12; const mb = b.reduce((s, v) => s + v, 0) / 12;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < 12; i += 1) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/**
 * The key a tune is in, from its notes [{ at, len, midi }]: 'C', 'F#m', ... (null with fewer
 * than 4 notes). How long each note of the scale sounds is set against what a major and a
 * minor key use, and the note the tune ends on and its lowest notes count a little extra (a
 * tune comes home to its key note, and the left hand plays it).
 */
export function guessKey(notes) {
  if (notes.length < 4) return null;
  const use = new Array(12).fill(0);
  for (const n of notes) use[mod(n.midi, 12)] += Math.min(4, Math.max(0.5, n.len));
  const end = Math.max(...notes.map((n) => n.at));
  const last = notes.filter((n) => n.at >= end - 0.26);
  const home = mod(Math.min(...last.map((n) => n.midi)), 12);
  const first = mod(Math.min(...notes.filter((n) => n.at <= notes[0].at + 0.26).map((n) => n.midi)), 12);
  let best = null;
  for (let t = 0; t < 12; t += 1) {
    const turned = use.map((_, i) => use[mod(i + t, 12)]);
    for (const [fit, names] of [[MAJOR_FIT, MAJOR_KEYS], [MINOR_FIT, MINOR_KEYS]]) {
      const score = correlate(turned, fit) + (home === t ? 0.12 : 0) + (first === t ? 0.1 : 0);
      if (!best || score > best.score) best = { score, key: names[t] };
    }
  }
  return best.key;
}

// ---------- chords and the band ----------

// the chords of a key: [root in semitones above the key note, third (4 major, 3 minor), how usual it is]
const MAJOR_CHORDS = { I: [0, 4, 0.06], IV: [5, 4, 0.04], V: [7, 4, 0.04], vi: [9, 3, 0.02], ii: [2, 3, 0.01], iii: [4, 3, 0] };
const MINOR_CHORDS = { i: [0, 3, 0.06], iv: [5, 3, 0.04], V: [7, 4, 0.03], v: [7, 3, 0.02], VI: [8, 4, 0.03], VII: [10, 4, 0.03], III: [3, 4, 0.02] };

const keyNote = (key) => (key.endsWith('m') ? MINOR_KEYS.indexOf(key) : MAJOR_KEYS.indexOf(key));

/** How much each of the 12 notes sounds from step `from` to step `to` (bass notes and notes on the beat count more). */
function sounding(notes, from, to, split) {
  const w = new Array(12).fill(0);
  for (const n of notes) {
    const left = split != null && n.midi < split ? 1.5 : 1;
    // (for the chord, a left-hand note counts on to the hand's next strike: a piano's held chord dies away, but it is still the chord)
    const len = left > 1 ? Math.max(n.len, Math.min(n.gap ?? 0, LONGEST)) : n.len;
    const over = Math.min(to, n.at + len) - Math.max(from, n.at);
    if (over <= 0) continue;
    const onBeat = mod(n.at, 2) < 0.01 ? 1.3 : 1;
    w[mod(n.midi, 12)] += over * onBeat * left;
  }
  return w;
}

function bestChord(w, key, lean = null) {
  const book = key.endsWith('m') ? MINOR_CHORDS : MAJOR_CHORDS;
  const tonic = keyNote(key);
  const all = w.reduce((s, v) => s + v, 0);
  if (!(all > 0)) return null;
  let best = null;
  for (const [name, [root, third, usual]] of Object.entries(book)) {
    const tones = [mod(tonic + root, 12), mod(tonic + root + third, 12), mod(tonic + root + 7, 12)];
    const inside = w[tones[0]] + 0.9 * w[tones[1]] + 0.8 * w[tones[2]];
    const outside = all - w[tones[0]] - w[tones[1]] - w[tones[2]];
    const score = (inside - 0.35 * outside) / all + usual + (lean === name ? 0.08 : 0);
    if (!best || score > best.score) best = { name, root: tones[0], third, score };
  }
  return best;
}

/**
 * The chord for each bar of tidied notes: [{ at, len (steps), name, root (0-11), third }].
 * A four-beat bar is split in two when its halves clearly want different chords. A bar with
 * nothing in it keeps the chord before it; the last bar leans home.
 */
export function chordsFor(notes, key, { bar = 8, from = 0, to, split = null } = {}) {
  const home = key.endsWith('m') ? 'i' : 'I';
  const out = [];
  for (let at = from; at < to - 1e-6; at += bar) {
    const end = Math.min(to, at + bar);
    const last = end >= to - 1e-6;
    const whole = bestChord(sounding(notes, at, end, split), key, last ? home : null);
    const prev = out[out.length - 1];
    if (!whole) { out.push({ at, len: end - at, name: prev?.name || home, root: prev?.root ?? keyNote(key), third: prev?.third ?? (key.endsWith('m') ? 3 : 4) }); continue; }
    const half = bar / 2;
    if (bar === 8 && end - at === bar && !last) {
      const a = bestChord(sounding(notes, at, at + half, split), key);
      const b = bestChord(sounding(notes, at + half, end, split), key);
      if (a && b && a.name !== b.name && a.score + b.score > 2 * whole.score + 0.3) {
        out.push({ at, len: half, name: a.name, root: a.root, third: a.third }, { at: at + half, len: half, name: b.name, root: b.root, third: b.third });
        continue;
      }
    }
    out.push({ at, len: end - at, name: whole.name, root: whole.root, third: whole.third });
  }
  return out;
}

/**
 * Where the bars start, for playing with no clicks to count from: the beat (from the first
 * strike back to a bar before it) whose bars each sit on one chord best. A tune is taken to
 * start on a bar's first beat unless another beat is clearly better.
 */
function barStart(notes, key, bar, start, end, split) {
  let best = null;
  for (let back = 0; back < bar; back += 2) {
    let sum = 0; let n = 0;
    for (let at = start - back; at < end; at += bar) {
      const c = bestChord(sounding(notes, at, at + bar, split), key);
      if (c) { sum += c.score; n += 1; }
    }
    const score = (n ? sum / n : 0) + (back === 0 ? 0.03 : 0);
    if (!best || score > best.score) best = { score, from: start - back };
  }
  return best.from;
}

/** How well bars of `bar` steps each sit on one chord, at the bar start that does it best (0 to about 1). */
export function barFit(notes, key, bar) {
  if (!notes.length || !key) return 0;
  const split = handSplit(notes);
  const start = Math.min(...notes.map((n) => n.at)); const end = Math.max(...notes.map((n) => n.at + n.len));
  let best = 0;
  for (let back = 0; back < bar; back += 2) {
    let sum = 0; let n = 0;
    for (let at = start - back; at < end; at += bar) {
      const c = bestChord(sounding(notes.map((x) => ({ ...x, right: split == null || x.midi >= split })), at, at + bar, split), key);
      if (c) { sum += c.score; n += 1; }
    }
    if (n) best = Math.max(best, sum / n);
  }
  return best;
}

/**
 * A band part for chords: a bass note, then the chord (bass, chord, bass, chord in four; bass,
 * chord, chord in three), with each chord set where the hand has the least to move. The last
 * chord is held. `under` keeps the chords below the tune (a MIDI note).
 */
export function bandPart(chords, { bar = 8, under = 72 } = {}) {
  const out = [];
  let centre = Math.min(57, under - 9); // around A3, or lower under a low tune
  chords.forEach((c, i) => {
    const bass = 36 + mod(c.root - 36, 12); // C2 to B2
    // the chord's three notes in the octave around the last chord's middle
    const tones = [0, c.third, 7].map((t) => { let m = c.root + t; while (m < centre - 6) m += 12; while (m >= centre + 6) m -= 12; return m; }).sort((a, b) => a - b);
    centre = Math.max(48, Math.min(under - 9, (tones[0] + tones[2]) / 2));
    const lastOne = i === chords.length - 1;
    if (lastOne) {
      // (under a low tune the chord can reach down to the bass note itself: it is played once)
      out.push({ at: c.at, len: c.len * 0.95, midi: bass }, ...tones.filter((midi) => midi !== bass).map((midi) => ({ at: c.at, len: c.len * 0.95, midi })));
      return;
    }
    for (let s = 0; s < c.len - 1e-6; s += 2) {
      const beat = s / 2;
      const isBass = bar === 6 ? beat % 3 === 0 : beat % 2 === 0;
      if (isBass) {
        // the second bass note of a four-beat bar is the chord's fifth below
        const fifth = bar === 8 && beat % 4 === 2;
        out.push({ at: c.at + s, len: 1.8, midi: fifth ? 36 + mod(c.root + 7 - 36, 12) : bass });
      } else for (const midi of tones) out.push({ at: c.at + s, len: 0.9, midi });
    }
  });
  return out;
}

// ---------- the tune ----------

const OVERTONES = [12, 19, 24]; // an octave, an octave and a fifth, two octaves
const LONE_MOST = 0.12; // a left hand with a line of its own: more than this share of the strikes are single notes of the left hand

/**
 * The tune of tidied notes: the top note of each strike of the right hand, and the notes where
 * the tune dips into the left hand's keys for a moment. Two things are kept out of it. A top
 * note far from the tune around it that sits an overtone above another note of its strike is
 * most likely that note's overtone, heard as a note: the lower one is the tune. And a strike
 * whose top is far below the tune around it is the left hand passing through (the tune's note
 * is still ringing above it).
 */
export function topLine(notes) {
  const by = new Map();
  for (const n of notes) { if (!by.has(n.at)) by.set(n.at, []); by.get(n.at).push(n); }
  const strikesOf = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);
  const highest = (list) => list.reduce((a, n) => (n.midi > a.midi ? n : a));
  const tops = strikesOf.map((list) => { const r = list.filter((n) => n.right); return r.length ? highest(r) : null; });
  // A tune dips into the left hand's keys now and then, and comes back. A strike with no
  // right-hand note is the tune too when its top note is a step or a small leap (a fourth at
  // most) from the tune's note next to it in time (within `near` steps), stands alone or well
  // above the rest of its strike, and is not down among the notes the left hand just played.
  const near = 8;
  const follow = (dir) => {
    let tune = null; let left = null; // the tune's note and the left hand's top note, last seen
    for (let i = dir > 0 ? 0 : strikesOf.length - 1; i >= 0 && i < strikesOf.length; i += dir) {
      const list = strikesOf[i];
      if (!tops[i]) {
        const top = highest(list);
        const rest = list.filter((n) => n !== top);
        const close = tune && Math.abs(top.at - tune.at) <= near && Math.abs(top.midi - tune.midi) <= 5;
        const clear = !rest.length || top.midi - highest(rest).midi > 7;
        const above = !left || Math.abs(top.at - left.at) > 2 * near || top.midi >= left.midi + 2;
        if (close && clear && above) tops[i] = top;
      }
      const under = list.filter((n) => n !== tops[i]);
      if (under.length) left = highest(under);
      if (tops[i]) tune = tops[i];
    }
  };
  // (only where the left hand plays chords under the tune or rests: when it plays a line of
  // single notes of its own, there is no telling its notes near the tune from a dip)
  const lone = strikesOf.filter((list, i) => !tops[i] && list.length === 1).length;
  if (lone <= LONE_MOST * strikesOf.length) { follow(1); follow(-1); }
  const middle = (list) => (list.length ? [...list].sort((x, y) => x - y)[list.length >> 1] : null);
  const out = [];
  tops.forEach((top, i) => {
    if (!top) return;
    const before = []; const after = [];
    for (let j = i - 1; j >= 0 && before.length < 3; j -= 1) if (tops[j]) before.push(tops[j].midi);
    for (let j = i + 1; j < tops.length && after.length < 3; j += 1) if (tops[j]) after.push(tops[j].midi);
    const mid = middle([...before, ...after]);
    let pick = top;
    if (mid != null) {
      const under = strikesOf[i].filter((n) => OVERTONES.includes(top.midi - n.midi)).sort((x, y) => Math.abs(x.midi - mid) - Math.abs(y.midi - mid))[0];
      if (under && Math.abs(top.midi - mid) > 9 && Math.abs(under.midi - mid) + 4 < Math.abs(top.midi - mid)) pick = under;
    }
    // far under the tune on both sides (a tune that moves down and stays there is still the tune)
    if (before.length && after.length && pick.midi < middle(before) - 8 && pick.midi < middle(after) - 8) return;
    out.push(pick);
  });
  return out;
}

// ---------- the readings ----------

const part = (role, notes, beats, follows) => ({
  role,
  notes: notes.map((n) => ({ at: round3(n.at), len: round3(n.len), midi: n.midi })).sort((a, b) => a.at - b.at || a.midi - b.midi),
  beats: Math.max(1, beats),
  follows, // whether it swings along with a mix that swings (it sits on straight eighths)
});

// how long a tidied note lasts: on to the next strike of its hand (two beats at most, unless it
// was heard ringing longer), a touch short so that repeated notes speak
function hold(n, gap, grid) {
  const rang = Math.max(grid, Math.round(n.len / grid) * grid);
  const most = Math.min(LONGEST, gap ?? LONGEST);
  return Math.max(grid, Math.min(most, Math.max(Math.min(most, 4), rang))) * 0.95;
}

/**
 * Strikes set on their places: every note of a strike at its place, notes of one key that land
 * together made one, each held to the next strike of its hand. [{ at, len, midi, right }].
 */
function setNotes(groups, places, grid, split) {
  const at = new Map(); // place|midi → note
  groups.forEach((g, i) => {
    for (const n of g.notes) {
      const k = `${places[i]}|${n.midi}`;
      const had = at.get(k);
      if (had) had.len = Math.max(had.len, n.len);
      else at.set(k, { at: places[i], len: n.len, midi: n.midi, right: split == null || n.midi >= split });
    }
  });
  const notes = [...at.values()].sort((a, b) => a.at - b.at || a.midi - b.midi);
  for (const right of [true, false]) {
    const hand = notes.filter((n) => n.right === right);
    const starts = [...new Set(hand.map((n) => n.at))];
    for (const n of hand) {
      const next = starts.find((s) => s > n.at);
      n.gap = next == null ? null : next - n.at;
      n.len = hold(n, n.gap, grid);
    }
  }
  return notes;
}

/**
 * The three readings of what was heard in a take.
 *   heard   [{ midi, on, off, vel }] from listener.js (seconds from the take's first sample)
 *   bpm, meter  the mix's speed and beats in a bar
 *   lead    seconds of sound the take keeps from before its beat
 *   beats   how long the take is, in beats
 *   swing   how much the mix swings (0: it doesn't)
 *   barAt   the beat of the bar the take starts on (0 is the bar's first)
 *   own     no clicks were playing: the playing is tidied at its own speed, whatever it fits
 * Returns { key, onBeat, heard, tidy, band, chords }: the key the playing is in (null when too
 * little was played), whether it kept to the clicks, and for each reading its parts
 * [{ role: 'tune' | 'band', notes: [{ at, len, midi }] (steps), beats, follows }]; band is
 * null when there is no tune to make a band for (fewer than 4 notes). chords (with a band
 * only) are the band's: [{ at, len (steps), name ('I', 'vi', ...), root (0-11), minor }].
 */
export function readings(heard, { bpm, meter = 4, lead = 0, beats, swing = 0, barAt = 0, own = false }) {
  const steps = 2 * beats;
  const raw = inSteps(heard, { bpm, lead }).filter((n) => n.at < steps);
  // As I heard it: a note ends when the key is struck again, and with the take
  const asHeard = raw.map((n, i) => {
    const again = raw.find((m, j) => j > i && m.midi === n.midi);
    return { ...n, len: Math.max(0.1, Math.min(n.len, steps - n.at, again ? again.at - n.at - 0.02 : Infinity)) };
  });
  const key = guessKey(raw);
  const result = { key, onBeat: false, heard: [part('tune', asHeard, beats, false)], tidy: [part('tune', [], beats, true)], band: null };
  if (!raw.length) return result;

  // Tidied
  const groups = strikes(raw, (TOGETHER * bpm) / 30, (SPREAD * bpm) / 30);
  const xs = groups.map((g) => g.at);
  const split = handSplit(raw);
  const clicks = own ? null : clickGrid(xs, swing, Math.min(0.4, (LATE * bpm) / 30));
  let places; let grid; let follows = true;
  if (clicks) {
    result.onBeat = true;
    grid = clicks.grid;
    if (clicks.swing > 0) {
      // swung eighths: back to straight ones (the clip then swings along with a mix that swings)
      places = xs.map((x) => { const n = nearest(x - clicks.off, [0, 1 + clicks.swing]); return Math.floor(n / 2) * 2 + (mod(n, 2) > 0.5 ? 1 : 0); });
      // a mix that doesn't swing would iron the swing out: keep it in the notes instead
      if (!(swing > 0)) follows = false;
    } else places = xs.map((x) => Math.round((x - clicks.off) / grid) * grid);
    if (grid < 1) follows = false;
  } else {
    // slow playing (nearly every gap four steps or so: quarter notes at half the mix's speed)
    // is set on steps twice as long, or steps of a third more would fit it as well
    const gaps = xs.slice(1).map((x, i) => x - xs[i]).filter((g) => g > 0.3).sort((a, b) => a - b);
    const slow = gaps.length >= 3 && gaps[Math.floor(0.2 * gaps.length)] >= WIDE_FROM;
    // (steps counted at the playing's own speed are nearly its own: swung eighths must not
    // pass for steps a third shorter)
    const near = own ? { from: 0.8, to: 1.25 } : {};
    places = slow ? ownGrid(xs.map((x) => x / 2), near).map((p) => 2 * p) : ownGrid(xs, near);
    grid = places.some((p) => p % 1 !== 0) ? 0.5 : 1;
    if (grid < 1) follows = false;
  }
  const low = Math.min(...places);
  if (low < 0) places = places.map((p) => p - low);
  let tidy = setNotes(groups, places, grid, split);
  const lilt = clicks && clicks.swing > 0 && !follows ? clicks.swing : 0;
  const lastEnd = Math.max(...tidy.map((n) => n.at + Math.max(n.len, 1)));
  const tidyBeats = Math.max(beats, Math.ceil(lastEnd / 2 - 1e-6));
  const baked = (list) => (lilt ? list.map((n) => { const a = swung(n.at, lilt); return { ...n, at: a, len: Math.max(0.2, swung(n.at + n.len, lilt) - a) }; }) : list);
  result.tidy = [part('tune', baked(tidy), tidyBeats, follows)];

  // Band version: the top line, and a band part for the chords that fit
  if (key && tidy.length >= 4) {
    const tune = topLine(tidy);
    if (tune.length >= 4) {
      tune.forEach((n, i) => { n = tune[i] = { ...n }; n.len = hold(n, i + 1 < tune.length ? tune[i + 1].at - n.at : null, grid); });
      const bar = 2 * meter;
      // bars are the mix's when the playing kept to the clicks; else they are counted from the
      // beat that makes the chords fit best (the first strike, unless the tune starts mid-bar)
      const start = Math.min(...tidy.map((n) => n.at));
      const from = clicks ? -2 * mod(barAt, meter) : barStart(tidy, key, bar, start, lastEnd, split);
      const first = from + bar * Math.floor((start - from) / bar + 1e-6);
      const to = first + bar * Math.ceil((lastEnd - first) / bar - 1e-6);
      const chords = chordsFor(tidy, key, { bar, from: first, to, split }).map((c) => ({ ...c, at: Math.max(0, c.at), len: c.at < 0 ? c.len + c.at : c.len })).filter((c) => c.len > 0);
      const under = Math.min(...tune.map((n) => n.midi));
      const band = bandPart(chords, { bar, under }).map((n) => ({ ...n, midi: fold(n.midi) }));
      const bandBeats = Math.max(tidyBeats, Math.ceil(to / 2));
      result.band = [part('tune', baked(tune), tidyBeats, follows), part('band', baked(band), bandBeats, follows)];
      result.chords = chords.map((c) => ({ at: c.at, len: c.len, name: c.name, root: c.root, minor: c.third === 3 }));
    }
  }
  return result;
}

// ---------- playing with no mix around it (the Note-o-Matic's own screen) ----------

const BEAT_FROM = 60 / 144; // seconds: the shortest beat looked for (144 a minute)
const BEAT_TO = 60 / 40; // seconds: and the longest (40 a minute)
const BEAT_NEAR = 0.03; // seconds: how near a gap must be to a count of beats to speak for it
const BEAT_FAR = 6; // beats: gaps longer than this say nothing
const BEAT_ALIKE = 0.7; // playing is "plain notes" when this share of its gaps are the usual gap, or twice or half it
const BEAT_PAIRS = 0.75; // long-short pairs, not plain notes: this share of gaps two strikes apart are no power of two of the usual gap
const BEAT_NOTES = 2.2; // a slower beat is at most this many of the usual notes long
const BEAT_SLOW = 0.7; // a slower beat is the kid's own when it fits this share as well as the best
const WALTZ_BY = 0.05; // how much better bars of three must fit their chords than bars of four
const WALTZ_BEAT = 0.45; // how much more a single line's rhythm must speak for bars of three than of four
const WALTZ_SURE = 1; // and the rhythm of two hands, to say three without the chords
const WALTZ_NOT = -0.6; // two hands: a rhythm that speaks this much for four overrules the chords

/**
 * The speed of playing that had no clicks to follow, in beats a minute (40 to 144). The gaps
 * between every two strikes (not only neighbours) keep coming back to whole numbers of beats,
 * whatever is played in between: straight or swung eighths, dotted notes, a slip. The beat
 * length between 72 and 144 a minute that most gaps agree with is found first; when a beat
 * two or three times as long fits nearly as well, that one wins: slow playing in plain
 * quarter notes is slow playing, not fast playing in long notes (which would sound the same,
 * but its bars would be half as long and its notes harder to set on their steps). Too little
 * playing to tell gives 100.
 */
export function speedOf(heard) {
  const on = heard.map((n) => n.on).filter(Number.isFinite).sort((a, b) => a - b);
  const xs = [];
  let first = 0; let sum = 0; let count = 0;
  for (const t of on) {
    if (count && t - first > SPREAD) { xs.push(sum / count); sum = 0; count = 0; }
    if (!count) first = t;
    sum += t; count += 1;
  }
  if (count) xs.push(sum / count);
  if (xs.length < 4) return 100;
  const tried = [];
  for (let beat = BEAT_FROM; beat <= BEAT_TO; beat *= 1.006) {
    let fit = 0; let n = 0;
    for (let i = 0; i < xs.length; i += 1) {
      for (let j = i + 1; j < xs.length; j += 1) {
        const gap = xs[j] - xs[i];
        if (gap > BEAT_FAR * beat + 0.1) break;
        if (gap < 0.5 * beat) continue;
        const off = Math.abs(gap - beat * Math.round(gap / beat));
        fit += Math.exp(-0.5 * (off / BEAT_NEAR) ** 2); n += 1;
      }
    }
    if (!n) continue;
    // (what gaps from nowhere would score at this beat length is taken off)
    const chance = Math.min(1, (BEAT_NEAR * Math.sqrt(2 * Math.PI)) / beat);
    tried.push({ beat, score: (fit / n - chance) / (1 - chance) });
  }
  if (!tried.length) return 100;
  // the best beat of the fastest octave (72 to 144 a minute)
  const gaps = xs.slice(1).map((x, i) => x - xs[i]).sort((a, b) => a - b);
  const usual = gaps[gaps.length >> 1];
  const near = (want) => {
    let best = -1;
    tried.forEach((t, i) => { if (Math.abs(t.beat / want - 1) <= 0.03 && (best < 0 || t.score > tried[best].score)) best = i; });
    return best;
  };
  let at = 0;
  tried.forEach((t, i) => { if (t.beat < 2 * BEAT_FROM && t.score > tried[at].score) at = i; });
  // Plain notes (nearly all one length, or twice or half it: a scale, a run, slow long notes)
  // fit a beat of a third or a fifth of them as well as one of a half or a quarter: they are
  // counted in twos. Not so long-short pairs all the way (swung eighths): every two of their
  // gaps make one and a half of the usual, and that is their beat.
  const twos = (x) => Math.abs(Math.log2(x) - Math.round(Math.log2(x)));
  const two = xs.slice(2).map((x, i) => x - xs[i]);
  const pairs = two.filter((g) => twos(g / usual) > 0.2).length >= BEAT_PAIRS * two.length;
  if (!pairs && twos(tried[at].beat / usual) > 0.2 && gaps.filter((g) => twos(g / usual) <= 0.2).length >= BEAT_ALIKE * gaps.length) {
    let want = usual;
    while (want < BEAT_FROM) want *= 2;
    while (want >= 2 * BEAT_FROM) want /= 2;
    const plain = near(want);
    if (plain >= 0 && tried[plain].score > 0) at = plain;
  }
  const quick = tried[at];
  if (!(quick.score > 0)) return 100;
  // Slow playing: a beat two or three times as long that fits nearly as well is the kid's
  // own, as long as the usual note is not much shorter than half of it (a run of quick even
  // notes fits every longer beat).
  for (const times of [2, 3]) {
    const want = times * quick.beat;
    if (want > BEAT_TO || want > BEAT_NOTES * usual) continue;
    const best = near(want);
    if (best >= 0 && tried[best].score >= BEAT_SLOW * quick.score) at = best;
  }
  return Math.round(60 / tried[at].beat);
}

/**
 * How much a rhythm speaks for bars of three beats (above 0) or of four (below): long notes
 * fall on a bar's first beat, and a rhythm comes back a bar or two later. Counted for bars and
 * pairs of bars (6 and 12 steps against 8 and 16). `notes` are tidied ({ at, len } in steps).
 */
export function threeBeat(notes) {
  const at = [...new Set(notes.map((n) => n.at))].sort((a, b) => a - b);
  if (at.length < 6) return 0;
  const gap = at.map((a, i) => Math.min(8, i + 1 < at.length ? at[i + 1] - a : 4));
  const usual = gap.reduce((x, y) => x + y, 0) / gap.length;
  const span = at[at.length - 1] - at[0];
  // the longest notes a bar's first beat can be given (at the best place for the bar line),
  // against the usual note: 1 for notes all alike, wherever the bar line is
  const firsts = (bar) => {
    let best = 0;
    for (let from = 0; from < bar && from <= span; from += 1) {
      let sum = 0;
      at.forEach((a, i) => { if (mod(a - at[0] - from, bar) < 0.01) sum += gap[i]; });
      best = Math.max(best, sum / (Math.floor((span - from) / bar) + 1) / usual);
    }
    return best;
  };
  // the share of strikes that have a strike again `lag` steps on
  const struck = new Set(at.map((a) => Math.round(2 * a)));
  const low = Math.round(2 * at[0]); const high = Math.round(2 * at[at.length - 1]);
  const again = (lag) => {
    let both = 0; let either = 0;
    for (let t = low; t + 2 * lag <= high; t += 1) {
      const a = struck.has(t); const b = struck.has(t + 2 * lag);
      if (a || b) { either += 1; if (a && b) both += 1; }
    }
    return either ? both / either : 0;
  };
  // (a bar length is only judged where the tune is long enough for both: a short tune must
  // not lean one way because the longer bars fall off its end)
  let sum = 0;
  if (span >= 16) sum += firsts(6) - firsts(8) + 0.5 * (again(6) - again(8));
  if (span >= 24) sum += again(12) - again(16);
  if (span >= 32) sum += firsts(12) - firsts(16);
  if (span >= 40) sum += 0.5 * (again(24) - again(32));
  return sum;
}

/**
 * The three readings of playing recorded on its own, with no mix and no clicks (the
 * Note-o-Matic's own screen): its speed is found from the playing (speedOf), it starts at its
 * first note and ends with its last. Its beats in a bar (3 or 4) are found too, unless
 * `meter` says. Returns what readings() does, and { bpm, meter, beats }: the speed its steps
 * are counted at, the beats in a bar, and how long it is.
 */
export function tuneReadings(heard, { meter = 0 } = {}) {
  const notes = heard.filter((n) => Number.isFinite(n.midi) && Number.isFinite(n.on));
  if (!notes.length) return { ...readings([], { bpm: 100, meter: meter || 4, beats: 1, own: true }), bpm: 100, meter: meter || 4, beats: 1 };
  const bpm = speedOf(notes);
  const lead = Math.min(...notes.map((n) => n.on));
  const end = Math.max(...notes.map((n) => n.off ?? n.on + 0.2));
  const beats = Math.max(1, Math.ceil(((end - lead) * bpm) / 60));
  let count = meter || 4;
  let result = readings(notes, { bpm, meter: count, lead, beats, own: true });
  // Three beats in a bar or four? With two hands, a waltz's chords change every three beats:
  // its bars of three sit on one chord each clearly better than bars of four do (unless the
  // rhythm plainly says four), or their rhythm plainly says three. One line has no chords to
  // go by, only its rhythm: long notes on the first beat, and a rhythm that comes back a bar
  // later.
  if (!meter && result.band) {
    const tidy = result.tidy[0].notes;
    const beat = threeBeat(tidy);
    const three = handSplit(tidy) == null
      ? beat > WALTZ_BEAT
      : beat > WALTZ_SURE || (beat > WALTZ_NOT && barFit(tidy, result.key, 6) - barFit(tidy, result.key, 8) > WALTZ_BY);
    if (three) { count = 3; result = readings(notes, { bpm, meter: count, lead, beats, own: true }); }
  }
  return { ...result, bpm, meter: count, beats: Math.max(beats, ...READINGS.flatMap((r) => (result[r.id] || []).map((p) => p.beats))) };
}
