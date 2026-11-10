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
  if (fine.err <= 0.1 && fine.err < 0.6 * eighths.err && !edge(fine)) return { grid: 0.5, swing: 0, off: fine.off };
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
 * the first stays where it is.
 */
export function ownGrid(xs) {
  if (!xs.length) return [];
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  let unit = 1;
  let top = -Infinity;
  let halves = false;
  const fit = (u) => { let s = 0; for (const g of gaps) if (g <= 6 * u) s += Math.cos((2 * Math.PI * g) / u); return s / Math.max(1, gaps.length); };
  for (let u = 0.7; u < 1.4; u *= 1.02) {
    // gaps that are whole steps, or (a little less likely) whole and half steps
    const whole = fit(u);
    const half = fit(u / 2) - 0.1;
    // nearer the mix's own speed wins a tie
    const score = Math.max(whole, half) - 0.15 * Math.abs(Math.log2(u));
    if (score > top) { top = score; unit = u; halves = half > whole; }
  }
  // half steps (a quick pair of notes) only for playing that clearly has them: an uneven
  // eighth must not be taken for one
  if (gaps.filter((g) => g / unit > 0.3 && g / unit < 0.68).length < 2) halves = false;
  const out = [Math.round(xs[0])];
  let u = unit;
  gaps.forEach((g, i) => {
    const k = g / u;
    // (a strike right after another is the rest of the same chord: it stays in its place)
    let steps = k < 0.3 ? 0 : halves && k < 0.75 ? 0.5 : Math.max(1, Math.round(k));
    // A long gap that falls between two counts goes to the one that lands the next strike
    // on a beat, and a very long one leans short as well: a gap that is a little too long
    // is a kid finding the next note, and the bars after it should still line up.
    const lo = Math.floor(k);
    const between = k - lo > 0.25 && k - lo < (k >= 7 ? 0.9 : 0.75);
    if (k >= 4.5 && between && Number.isInteger(out[i])) steps = (out[i] + lo) % 2 === 0 ? lo : lo + 1;
    out.push(out[i] + steps);
    // follow the kid's speed, a little at a time, and only on gaps that are clear
    if (steps >= 1 && steps <= 4 && Math.abs(k - steps) <= 0.25) u = Math.max(0.85 * unit, Math.min(1.18 * unit, u + 0.2 * (g / steps - u)));
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
      out.push({ at: c.at, len: c.len * 0.95, midi: bass }, ...tones.map((midi) => ({ at: c.at, len: c.len * 0.95, midi })));
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

/**
 * The tune of tidied notes: the top note of each strike of the right hand. Two things are
 * kept out of it. A top note far from the tune around it that sits an overtone above another
 * note of its strike is most likely that note's overtone, heard as a note: the lower one is
 * the tune. And a strike whose top is far below the tune around it is the left hand passing
 * through (the tune's note is still ringing above it).
 */
export function topLine(notes) {
  const by = new Map();
  for (const n of notes) { if (!by.has(n.at)) by.set(n.at, []); by.get(n.at).push(n); }
  const strikesOf = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);
  const tops = strikesOf.map((list) => { const r = list.filter((n) => n.right); return r.length ? r.reduce((a, n) => (n.midi > a.midi ? n : a)) : null; });
  const around = (i) => {
    const near = [];
    for (let j = i - 1; j >= 0 && near.length < 3; j -= 1) if (tops[j]) near.push(tops[j].midi);
    let after = 0;
    for (let j = i + 1; j < tops.length && after < 3; j += 1) if (tops[j]) { near.push(tops[j].midi); after += 1; }
    near.sort((a, b) => a - b);
    return near.length ? near[near.length >> 1] : null;
  };
  const out = [];
  tops.forEach((top, i) => {
    if (!top) return;
    const mid = around(i);
    let pick = top;
    if (mid != null) {
      const under = strikesOf[i].filter((n) => OVERTONES.includes(top.midi - n.midi)).sort((a, b) => Math.abs(a.midi - mid) - Math.abs(b.midi - mid))[0];
      if (under && Math.abs(top.midi - mid) > 9 && Math.abs(under.midi - mid) + 4 < Math.abs(top.midi - mid)) pick = under;
      if (pick.midi < mid - 8) return;
    }
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
 * Returns { key, onBeat, heard, tidy, band }: the key the playing is in (null when too little
 * was played), whether it kept to the clicks, and for each reading its parts
 * [{ role: 'tune' | 'band', notes: [{ at, len, midi }] (steps), beats, follows }]; band is
 * null when there is no tune to make a band for (fewer than 4 notes).
 */
export function readings(heard, { bpm, meter = 4, lead = 0, beats, swing = 0, barAt = 0 }) {
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
  const clicks = clickGrid(xs, swing, Math.min(0.4, (LATE * bpm) / 30));
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
    places = ownGrid(xs);
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
      result.chords = chords.map((c) => ({ at: c.at, len: c.len, name: c.name }));
    }
  }
  return result;
}
