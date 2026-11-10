// The Note-o-Matic's readings (js/notomatic.js): what was heard, set on the beat, and given a
// band. Checked on made-up performances of every piece in the songbook (on the clicks with
// human timing, and at the player's own speed with stops to think), and on what the ears
// heard in two real recordings of a real piano (test/fixtures/heard-*.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SONGS, SHOW_SONGS, barChords } from '../js/songs.js';
import { songById, songAbc, meterOf } from '../js/sheetmusic.js';
import { arrangementNotes } from '../js/arrange.js';
import { sameSig, LOWEST, HIGHEST } from '../js/remix.js';
import { swingAt } from '../js/music.js';
import {
  READINGS, readings, inSteps, strikes, swung, gridFit, clickGrid, ownGrid, handSplit, guessKey, chordsFor, bandPart, topLine,
} from '../js/notomatic.js';

const IDS = [...Object.keys(SONGS), ...Object.keys(SHOW_SONGS).map((k) => `show:${k}`)];
const LEVELS = ['easy', 'medium', 'hard'];

// a repeatable random source
function rng(seed) {
  let a = seed;
  const u = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { u, range: (lo, hi) => lo + (hi - lo) * u(), gauss: () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()), chance: (p) => u() < p };
}
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// the easy version of a piece is made from its tune, with full chords in the left hand
function easyVersion(id) {
  const rh = []; const lh = [];
  for (const line of songAbc(id, { hands: 'chords' }).split('\n')) {
    const m = /^\[V:([RL])\]\s*(.*)$/.exec(line);
    if (!m) continue;
    (m[1] === 'R' ? rh : lh).push(...m[2].replace(/\|\]\s*$/, '').replace(/\|\s*$/, '').split('|').map((b) => b.trim()));
  }
  return { rh, lh };
}
const sheet = (id, level) => arrangementNotes(id, level, level === 'easy' ? easyVersion(id) : undefined);

/**
 * A made-up performance of a piece: its notes with human timing (`jitter` seconds, chords not
 * quite together). 'click' keeps to the beat; 'free' plays at its own slower speed, starts late
 * and now and then stops to find a note. `swing` leans the off-beat eighths late.
 */
function perform(id, level, { mode = 'click', jitter = 0.025, swing = 0, bars = 10, stops = 0.08 } = {}) {
  const song = songById(id);
  const step = 30 / song.bpm;
  const steps = meterOf(song).steps;
  const r = rng(hash(`${id}|${level}|${mode}`));
  const score = sheet(id, level).filter((n) => n.start < bars * steps);
  const speed = mode === 'free' ? r.range(0.75, 0.95) : 1;
  const lead = 0.06;
  let wait = 0;
  const when = new Map();
  for (const s of [...new Set(score.map((n) => n.start))].sort((a, b) => a - b)) {
    if (mode === 'free' && r.chance(stops)) wait += r.range(0.3, 0.9) * 2 * step;
    when.set(s, lead + (swingAt(s, swing) * step) / speed + wait + r.gauss() * jitter + (mode === 'click' ? 0.02 : 0.4));
  }
  const heard = score.map((n) => {
    const on = Math.max(0, when.get(n.start) + r.gauss() * 0.008);
    return { midi: n.midi, on, off: on + Math.min(1.2, ((n.len * step) / speed) * r.range(0.5, 0.9)), vel: 0.6 };
  }).sort((a, b) => a.on - b.on);
  const beats = Math.ceil(((Math.max(...heard.map((n) => n.off)) - lead) * song.bpm) / 60) + 1;
  return { heard, score, song, opts: { bpm: song.bpm, meter: steps / 2, lead, beats } };
}

// the longest run two lists share, in order
function shared(a, b, same = (x, y) => x === y) {
  const L = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) L[i][j] = same(a[i - 1], b[j - 1]) ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1]);
  return L[a.length][b.length];
}
const gapsOf = (starts) => { const s = [...new Set(starts)].sort((a, b) => a - b); return s.slice(1).map((x, i) => x - s[i]); };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const chordOf = (name) => ({ root: (PC[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12, minor: /^[A-G][#b]?m/.test(name) });

// ---------- the small pieces ----------

test('what was heard is counted in steps from the take\'s beat', () => {
  const notes = inSteps([{ midi: 60, on: 0.56, off: 1.06, vel: 0.5 }, { midi: 100, on: 0.06, off: 0.31 }, { midi: 20, on: 0.05, off: 0.3 }], { bpm: 120, lead: 0.06 });
  // at 120 a step (an eighth) is a quarter of a second; a note before the beat starts on it
  assert.deepEqual(notes.map((n) => [n.at, n.midi]), [[0, 32], [0, 88], [2, 60]]);
  assert.equal(notes[2].len, 2);
  for (const n of notes) assert.ok(n.midi >= LOWEST && n.midi <= HIGHEST);
  assert.deepEqual(inSteps([], { bpm: 100 }), []);
});

test('notes struck together are one strike, however a kid spreads a chord', () => {
  const at = (list) => list.map((x, i) => ({ at: x, midi: 60 + i }));
  // each note within 0.2 of the one before, the whole chord within 0.48
  assert.deepEqual(strikes(at([0, 0.15, 0.3, 1, 1.1, 2]), 0.2).map((g) => g.notes.length), [3, 2, 1]);
  assert.deepEqual(strikes(at([0, 0.19, 0.38, 0.57]), 0.2).map((g) => g.notes.length), [3, 1]);
  assert.ok(Math.abs(strikes(at([0, 0.1, 0.2]), 0.2)[0].at - 0.1) < 1e-9);
});

test('swing is the game\'s own', () => {
  for (const s of [0, 0.16, 0.33]) for (const x of [0, 0.5, 1, 1.5, 2, 3, 7.25]) assert.equal(swung(x, s), swingAt(x, s));
});

test('playing on the clicks is told from playing that takes no notice of them', () => {
  const r = rng(11);
  const on = (spots, n, jitter) => Array.from({ length: n }, (_, i) => 2 * Math.floor(i / spots.length) + spots[i % spots.length] + r.gauss() * jitter);
  // straight eighths, a touch late as a whole
  const straight = clickGrid(on([0, 1], 40, 0.1).map((x) => x + 0.12));
  assert.equal(straight.grid, 1);
  assert.equal(straight.swing, 0);
  assert.ok(Math.abs(straight.off - 0.12) < 0.05);
  // swung eighths: how far they lean is measured
  const lilt = clickGrid(on([0, 1.3], 40, 0.08));
  assert.equal(lilt.grid, 1);
  assert.ok(Math.abs(lilt.swing - 0.3) < 0.06, `swing ${lilt.swing}`);
  // exact sixteenths
  assert.equal(clickGrid(on([0, 0.5, 1, 1.5], 48, 0.04)).grid, 0.5);
  // anywhere at all
  const anywhere = Array.from({ length: 40 }, (_, i) => i * 1.37 + r.u());
  assert.equal(clickGrid(anywhere), null);
  // Even eighths that all fall between the clicks' eighths are eighths played a steady sixteenth
  // late (a kid who waits to hear each click), not a tune made of off-beat sixteenths.
  const waits = clickGrid(on([0, 1], 40, 0.05).map((x) => x + 0.4));
  assert.equal(waits.grid, 1);
  assert.ok(Math.abs(waits.off - 0.4) < 0.05, `off ${waits.off}`);
  const ahead = clickGrid(on([0, 1], 40, 0.05).map((x) => x - 0.4));
  assert.equal(ahead.grid, 1);
  assert.ok(Math.abs(ahead.off + 0.4) < 0.05, `off ${ahead.off}`);
  // right in the middle it could be either: late is the likelier
  assert.ok(Math.abs(clickGrid(on([0, 1], 40, 0.03).map((x) => x + 0.5)).off - 0.5) < 0.05);
  // (sixteenths with a quick pair now and then still use the eighths, so they stay sixteenths)
  const quick = Array.from({ length: 40 }, (_, i) => 8 * Math.floor(i / 10) + [0, 1, 2, 2.5, 3, 4, 5, 6, 6.5, 7][i % 10] + r.gauss() * 0.03);
  assert.equal(clickGrid(quick).grid, 0.5);
  // a different speed from the clicks drifts across them: not on the beat
  assert.equal(clickGrid(Array.from({ length: 40 }, (_, i) => i * 1.06 + r.gauss() * 0.05)), null);
  // one strike can't be judged; none is nothing
  assert.deepEqual(clickGrid([3.1]), { grid: 1, swing: 0, off: 0 });
  assert.equal(clickGrid([]), null);
  assert.ok(gridFit([0.1, 1.1, 2.1, 3.1], [0, 1]).err < 1e-9);
});

test('a kid who is a steady tenth of a second behind the clicks gets the tune on its own steps', () => {
  const steps = [0, 2, 4, 5, 6, 8, 10, 12, 14, 16, 17, 18, 20, 22, 24, 26];
  for (const [bpm, late] of [[90, 0.12], [120, 0.1], [120, 0.12], [120, -0.11], [150, 0.1]]) {
    const r = rng(9);
    const beat = 60 / bpm;
    const heard = steps.map((st, i) => { const on = 0.06 + (st / 2) * beat + late + r.gauss() * 0.008; return { midi: [60, 62, 64, 65, 67, 65, 64, 62][i % 8], on, off: on + 0.3, vel: 0.6 }; });
    const got = readings(heard, { bpm, meter: 4, lead: 0.06, beats: 16 });
    assert.equal(got.onBeat, true, `${bpm} bpm, ${late} s`);
    assert.deepEqual(got.tidy[0].notes.map((n) => n.at), steps, `${bpm} bpm, ${late} s`);
    assert.equal(got.tidy[0].follows, true);
  }
});

test('playing at its own speed is set even from its own gaps', () => {
  // a tune of gaps 2 2 1 1 2 4 2 2, played a quarter slower than the mix, a little unevenly
  const want = [2, 2, 1, 1, 2, 4, 2, 2, 1, 1, 2, 2, 4];
  const r = rng(5);
  let t = 3.3;
  const xs = [t];
  for (const g of want) { t += g * 1.25 * (1 + r.gauss() * 0.04); xs.push(t); }
  const places = ownGrid(xs);
  assert.equal(places[0], 3);
  assert.deepEqual(places.slice(1).map((p, i) => p - places[i]), want);
  // the rest of a spread chord stays with it
  assert.deepEqual(ownGrid([0, 2, 2.2, 4, 6]), [0, 2, 2, 4, 6]);
  // a long gap that is a little too long is a kid thinking: the next strike still lands on a beat
  assert.deepEqual(ownGrid([0, 2, 4, 6, 8, 12.6, 14.6, 16.6]), [0, 2, 4, 6, 8, 12, 14, 16]);
  assert.deepEqual(ownGrid([0, 2, 4, 6, 8, 16.85, 18.85, 20.85]), [0, 2, 4, 6, 8, 16, 18, 20]);
  // (a gap that is clearly five steps is five)
  assert.deepEqual(ownGrid([0, 2, 4, 6, 8, 13, 15, 17]), [0, 2, 4, 6, 8, 13, 15, 17]);
  // quick pairs are half steps only when the playing clearly has them
  assert.deepEqual(ownGrid([0, 1, 2, 2.5, 3, 4, 4.5, 5, 6]), [0, 1, 2, 2.5, 3, 4, 4.5, 5, 6]);
  assert.deepEqual(ownGrid([0, 1, 2, 2.7, 4, 5]), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(ownGrid([]), []);
  assert.deepEqual(ownGrid([4.4]), [4]);
});

test('two hands are told apart, one hand is left whole', () => {
  const both = [48, 52, 55, 48, 53, 57, 43, 47, 50].concat([72, 74, 76, 77, 79, 76, 72, 74, 71, 72]).map((midi) => ({ midi }));
  const split = handSplit(both);
  assert.ok(split > 57 && split <= 71, `split at ${split}`);
  assert.equal(handSplit([60, 62, 64, 65, 67, 69, 71, 72, 74].map((midi) => ({ midi }))), null);
  assert.equal(handSplit([]), null);
});

test('the key is found for every piece of the songbook', () => {
  let right = 0; let all = 0;
  for (const id of IDS) for (const level of LEVELS) {
    const song = songById(id);
    const key = guessKey(sheet(id, level).map((n) => ({ at: n.start, len: n.len, midi: n.midi })));
    all += 1;
    if (key && sameSig(key, song.key)) right += 1;
  }
  // (the same sharps or flats: a minor tune may be named by its major key and the other way round)
  assert.ok(right >= 0.9 * all, `${right} of ${all}`);
  assert.equal(guessKey([{ at: 0, len: 1, midi: 60 }]), null);
  // C D E F G with a C at the bottom and the end is C major, A B C D E ending on A is A minor
  const run = (list) => list.map((midi, i) => ({ at: i, len: 1, midi }));
  assert.equal(guessKey(run([60, 62, 64, 65, 67, 64, 62, 60])), 'C');
  assert.equal(guessKey(run([57, 59, 60, 62, 64, 60, 59, 57])), 'Am');
});

// ---------- the readings, on the whole songbook ----------

test('there are three readings, and nothing heard gives empty ones', () => {
  assert.deepEqual(READINGS.map((r) => r.id), ['heard', 'tidy', 'band']);
  const none = readings([], { bpm: 120, meter: 4, beats: 8 });
  assert.equal(none.key, null);
  assert.equal(none.band, null);
  assert.deepEqual([none.heard.length, none.tidy.length, none.heard[0].notes.length, none.tidy[0].notes.length], [1, 1, 0, 0]);
  // three notes are a tidy tune but too little for a band
  const few = readings([60, 62, 64].map((midi, i) => ({ midi, on: 0.5 * i, off: 0.5 * i + 0.4, vel: 0.5 })), { bpm: 120, meter: 4, beats: 4 });
  assert.equal(few.band, null);
  assert.deepEqual(few.tidy[0].notes.map((n) => [n.at, n.midi]), [[0, 60], [2, 62], [4, 64]]);
});

test('As I heard it keeps every note where it was played', () => {
  const p = perform('bg-meadow', 'easy');
  const rd = readings(p.heard, p.opts);
  const part = rd.heard[0];
  assert.equal(part.role, 'tune');
  assert.equal(part.follows, false);
  assert.equal(part.beats, p.opts.beats);
  assert.equal(part.notes.length, p.heard.length);
  const per = p.opts.bpm / 30;
  for (const n of part.notes) {
    assert.ok(p.heard.some((h) => h.midi === n.midi && Math.abs(Math.max(0, (h.on - p.opts.lead) * per) - n.at) < 0.002), `a note at ${n.at}`);
    assert.ok(n.len > 0 && n.at >= 0 && n.at + n.len <= 2 * part.beats + 1e-6);
  }
  // a key struck twice: the first note stops for the second
  const twice = readings([{ midi: 60, on: 0, off: 2 }, { midi: 60, on: 0.5, off: 1 }], { bpm: 120, meter: 4, beats: 4 }).heard[0].notes;
  assert.ok(twice[0].len < 2);
});

test('Tidied puts playing on the clicks back on the sheet\'s places', () => {
  let exact = 0; let onBeat = 0; let all = 0; let share = 0;
  for (const id of IDS) for (const level of LEVELS) {
    const p = perform(id, level);
    const rd = readings(p.heard, p.opts);
    const want = new Set(p.score.map((n) => `${n.start}|${n.midi}`));
    const notes = rd.tidy[0].notes;
    const hit = notes.filter((n) => want.has(`${n.at}|${n.midi}`)).length / Math.max(want.size, notes.length);
    all += 1; share += hit;
    if (rd.onBeat) onBeat += 1;
    if (hit >= 0.95) exact += 1;
    // a part that follows the mix's swing sits on whole eighths
    if (rd.tidy[0].follows) assert.ok(notes.every((n) => Number.isInteger(n.at)), `${id} ${level}`);
  }
  // (two of the hard show tunes run in sixteenths at speed: 25 ms of human timing blurs those)
  assert.ok(onBeat >= 0.9 * all, `on the beat: ${onBeat} of ${all}`);
  assert.ok(exact >= 0.9 * all, `note for note: ${exact} of ${all}`);
  assert.ok(share / all >= 0.95, `share of notes in place ${share / all}`);
});

test('Tidied keeps the rhythm of playing at its own speed, with stops to think', () => {
  let share = 0; let all = 0; let onBeat = 0;
  for (const id of IDS) for (const level of LEVELS) {
    const p = perform(id, level, { mode: 'free' });
    const rd = readings(p.heard, p.opts);
    const a = gapsOf(p.score.map((n) => n.start)); const b = gapsOf(rd.tidy[0].notes.map((n) => n.at));
    share += shared(a, b, (x, y) => Math.abs(x - y) < 1e-6) / Math.max(a.length, b.length);
    all += 1;
    if (rd.onBeat) onBeat += 1;
    assert.ok(rd.tidy[0].beats >= 1 && rd.tidy[0].notes.every((n) => n.at >= 0 && n.at + n.len <= 2 * rd.tidy[0].beats + 1e-6));
  }
  // one gap in twelve has a stop in it, which no tidying can know about
  assert.ok(share / all >= 0.85, `share of gaps kept ${share / all}`);
  assert.ok(onBeat <= 0.1 * all, `${onBeat} taken for on the beat`);
});

test('swung playing: straightened to follow a mix that swings, kept in the notes when the mix doesn\'t', () => {
  const p = perform('bg-meadow', 'easy', { swing: 0.25 });
  const want = new Set(p.score.map((n) => `${n.start}|${n.midi}`));
  const withMix = readings(p.heard, { ...p.opts, swing: 0.25 });
  assert.equal(withMix.onBeat, true);
  assert.equal(withMix.tidy[0].follows, true);
  assert.ok(withMix.tidy[0].notes.filter((n) => want.has(`${n.at}|${n.midi}`)).length >= 0.95 * want.size);
  const alone = readings(p.heard, p.opts);
  assert.equal(alone.tidy[0].follows, false);
  const late = alone.tidy[0].notes.filter((n) => Math.abs((n.at % 2) - 1) < 0.5).map((n) => (n.at % 2) - 1);
  assert.ok(late.length > 10 && late.every((x) => x > 0.15 && x < 0.35), 'the off-beat eighths lean late, as played');
});

test('Band version: the tune alone on top, and a band part on the chords that fit', () => {
  for (const id of IDS) for (const level of LEVELS) {
    const p = perform(id, level);
    const rd = readings(p.heard, p.opts);
    assert.ok(rd.band, `${id} ${level} got no band`);
    const [tune, band] = rd.band;
    assert.deepEqual([tune.role, band.role], ['tune', 'band']);
    // one note at a time, each over before the next
    tune.notes.forEach((n, i) => { if (i) assert.ok(tune.notes[i - 1].at + tune.notes[i - 1].len <= n.at + 1e-6, `${id} ${level}: the tune overlaps at ${n.at}`); });
    for (const n of [...tune.notes, ...band.notes]) assert.ok(Number.isInteger(n.midi) && n.midi >= LOWEST && n.midi <= HIGHEST && n.len > 0 && n.at >= 0);
    for (const part of rd.band) assert.ok(part.notes.every((n) => n.at < 2 * part.beats), `${id} ${level}: a note starts after its part ends`);
    // the band stays under the tune
    const low = Math.min(...tune.notes.map((n) => n.midi));
    assert.ok(Math.max(...band.notes.map((n) => n.midi)) < Math.max(low, 60), `${id} ${level}: the band climbs over the tune`);
    // every chord starts with its root in the bass
    for (const c of rd.chords) {
      const first = band.notes.filter((n) => Math.abs(n.at - c.at) < 1e-6);
      assert.equal(Math.min(...first.map((n) => n.midi)) % 12, c.root, `${id} ${level}: chord at ${c.at}`);
    }
  }
});

test('the band finds the songs\' own chords from a kid\'s two-handed playing', () => {
  let right = 0; let all = 0;
  for (const id of Object.keys(SONGS)) {
    const p = perform(id, 'easy', { bars: 16 });
    const rd = readings(p.heard, p.opts);
    const steps = meterOf(p.song).steps;
    p.song.chords.slice(0, 16).forEach((entry, b) => {
      for (const c of barChords(entry, steps)) {
        const want = chordOf(c.name);
        const got = rd.chords.find((x) => x.at <= b * steps + c.pos + 1e-6 && x.at + x.len > b * steps + c.pos + 1e-6);
        all += 1;
        if (got && got.root === want.root && got.minor === want.minor) right += 1;
      }
    });
  }
  assert.ok(right >= 0.85 * all, `${right} of ${all} chords`);
});

test('the tune leaves out an overtone above it and the left hand passing under it', () => {
  const n = (at, midi, right = true) => ({ at, len: 1, midi, right });
  // a tune around C5; at step 4 an overtone an octave above its own note; at step 6 only a low note
  const notes = [n(0, 72), n(2, 74), n(4, 76), n(4, 88), n(6, 55), n(8, 77), n(10, 79), n(12, 76), n(0, 48, false), n(8, 43, false)];
  assert.deepEqual(topLine(notes).map((x) => x.midi), [72, 74, 76, 77, 79, 76]);
  // a real leap up an octave stays
  assert.deepEqual(topLine([n(0, 60), n(2, 62), n(4, 76), n(6, 77), n(8, 79), n(10, 77)]).map((x) => x.midi), [60, 62, 76, 77, 79, 77]);
  assert.deepEqual(topLine([]), []);
});

test('chords and the band part, by hand', () => {
  // two bars of four: C E G under a C, then F A C under an A
  const bar = (at, list) => list.map((midi) => ({ at, len: 8, midi }));
  const notes = [...bar(0, [48, 52, 55, 72]), ...bar(8, [53, 57, 60, 69]), ...bar(16, [55, 59, 62, 74]), ...bar(24, [48, 52, 55, 72])];
  const chords = chordsFor(notes, 'C', { bar: 8, from: 0, to: 32, split: 64 });
  assert.deepEqual(chords.map((c) => c.name), ['I', 'IV', 'V', 'I']);
  const band = bandPart(chords, { bar: 8, under: 69 });
  // bass, chord, bass (the fifth), chord; the last bar is held
  const at = (s) => band.filter((x) => x.at === s).map((x) => x.midi);
  assert.deepEqual(at(0), [36]);
  assert.equal(at(2).length, 3);
  assert.deepEqual(at(4), [43]);
  assert.deepEqual(at(8), [41]);
  assert.equal(at(24).length, 4);
  assert.ok(band.filter((x) => x.at >= 24).every((x) => x.len > 7));
  // under a low tune the held chord reaches down to the bass note: no key is struck twice at once
  for (const root of [9, 10, 11, 7]) {
    const low = bandPart([{ at: 0, len: 8, name: 'I', root, third: 4 }, { at: 8, len: 8, name: 'I', root, third: 4 }], { bar: 8, under: 60 });
    const last = low.filter((x) => x.at === 8).map((x) => x.midi);
    assert.equal(new Set(last).size, last.length, `root ${root}: ${last}`);
    assert.ok(last.length >= 3);
  }
  // a waltz: bass, chord, chord
  const waltz = bandPart(chordsFor(notes.map((x) => ({ ...x, at: (x.at / 8) * 6, len: 6 })), 'C', { bar: 6, from: 0, to: 24, split: 64 }), { bar: 6, under: 69 });
  assert.deepEqual([0, 2, 4].map((s) => waltz.filter((x) => x.at === s).length), [1, 3, 3]);
  // an empty bar keeps the chord before it
  assert.deepEqual(chordsFor(notes.slice(0, 4), 'C', { bar: 8, from: 0, to: 24 }).map((c) => c.name), ['I', 'I', 'I']);
});

// ---------- real playing ----------

const real = (name) => JSON.parse(readFileSync(new URL(`./fixtures/heard-${name}.json`, import.meta.url), 'utf8'));

test('a real recording of Forest Village (easy), played with no clicks: its rhythm and its chords', () => {
  const heard = real('forest-village-easy');
  const song = songById('bg-meadow');
  const last = Math.max(...heard.map((n) => n.off));
  const rd = readings(heard, { bpm: song.bpm, meter: 4, lead: 0, beats: Math.ceil((last * song.bpm) / 60) });
  assert.equal(rd.key, 'C');
  assert.equal(rd.onBeat, false);
  const a = gapsOf(sheet('bg-meadow', 'easy').map((n) => n.start)); const b = gapsOf(rd.tidy[0].notes.map((n) => n.at));
  assert.ok(shared(a, b) >= 0.9 * a.length, `${shared(a, b)} of ${a.length} gaps`);
  // all sixteen bars get the song's own chord
  const want = song.chords.map(chordOf);
  const got = rd.chords.slice(0, 16);
  const same = want.filter((w, i) => got[i] && got[i].root === w.root && got[i].minor === w.minor).length;
  assert.ok(same >= 15, `${same} of 16 chords: ${got.map((c) => c.name).join(' ')}`);
  // and the tune is the sheet's tune
  const top = new Map();
  for (const n of sheet('bg-meadow', 'easy').filter((x) => x.hand === 'rh')) if (!top.has(n.start) || top.get(n.start) < n.midi) top.set(n.start, n.midi);
  const tune = [...top.keys()].sort((x, y) => x - y).map((k) => top.get(k));
  const mine = rd.band[0].notes.map((n) => n.midi);
  assert.ok(shared(tune, mine) >= 0.85 * tune.length && shared(tune, mine) >= 0.9 * mine.length, `${shared(tune, mine)} of ${tune.length} sheet notes, ${mine.length} in the band's tune`);
});

test('a real recording of Moon Base (easy), played slower than the mix: still the sheet\'s rhythm', () => {
  const heard = real('moon-base-easy');
  const last = Math.max(...heard.map((n) => n.off));
  const rd = readings(heard, { bpm: 120, meter: 4, lead: 0, beats: Math.ceil(last * 2) });
  assert.ok(sameSig(rd.key, 'Am'));
  const a = gapsOf(sheet('bg-space', 'easy').map((n) => n.start)); const b = gapsOf(rd.tidy[0].notes.map((n) => n.at));
  assert.ok(shared(a, b) >= 0.9 * a.length, `${shared(a, b)} of ${a.length} gaps`);
  assert.ok(rd.band && rd.band[0].notes.length >= 35);
});
