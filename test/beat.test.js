import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBeatFollower, noteLikelihood } from '../js/beat.js';
import { perform, rng, RHYTHMS as R } from './helpers/playing.mjs';

/** Plays the made-up notes into a follower, checking for beats every 20 ms like the page does. */
function follow(parts, seed = 1, opts) {
  const perf = perform(parts, rng(seed * 7919), opts);
  const f = createBeatFollower({ rng: rng(seed * 104729) });
  const moves = [];
  let i = 0;
  for (let now = 0; now < perf.end + 3000; now += 20) {
    while (i < perf.notes.length && perf.notes[i] <= now) f.note(perf.notes[i++]);
    moves.push(...f.beats(now));
  }
  return { perf, f, moves };
}
const near = (list, t, ms = 80) => list.some((x) => Math.abs(x - t) < ms);
const grid = (beats) => [...beats, ...beats.slice(1).map((b, k) => (b + beats[k]) / 2)];

test('a note on the beat is likelier than one anywhere; one off the beat less so', () => {
  assert.ok(noteLikelihood(0) > 2);
  assert.ok(noteLikelihood(0.5) > 1);
  assert.ok(noteLikelihood(0.38) < 1);
});

test('follows a steady piece: the buddy dances on the beat', () => {
  for (const seed of [1, 2, 3]) {
    const { perf, moves, f } = follow([{ bpm: 100, beats: 32, rhythm: R.MIX }], seed);
    const onBeat = moves.filter((m) => near(grid(perf.beats), m)).length;
    assert.ok(moves.length >= 20, `seed ${seed}: ${moves.length} moves`);
    assert.ok(onBeat / moves.length >= 0.85, `seed ${seed}: ${onBeat}/${moves.length} on the beat`);
    assert.ok(Math.abs(f.bpm - 100) <= 6 || Math.abs(f.bpm - 200) <= 12, `seed ${seed}: ${f.bpm} bpm`);
  }
});

test('follows a kid slowing down, and picks up a new song after a pause', () => {
  const slow = follow([{ bpm: [110, 70], beats: 32, rhythm: R.MIX }], 4);
  assert.ok(slow.moves.filter((m) => near(grid(slow.perf.beats), m)).length / slow.moves.length >= 0.85);
  assert.ok(Math.abs(slow.f.bpm - 70) <= 8, `${slow.f.bpm} bpm at the end`);

  // a short new song: within a few seconds the buddy dances on its beats (or on every other one)
  for (const seed of [1, 3, 5, 6]) {
    const two = follow([{ bpm: 90, beats: 16, rhythm: R.MIX }, { pause: 3000 }, { bpm: 132, beats: 16, rhythm: R.Q }], seed);
    const second = two.perf.sections[1];
    const late = two.moves.filter((m) => m > second.start + 3000 && m < second.end);
    assert.ok(late.length >= 4, `seed ${seed}: ${late.length} moves in the second song`);
    assert.ok(late.filter((m) => near(second.beats, m)).length / late.length >= 0.8, `seed ${seed}: off the new beat`);
  }
});

test('stops dancing when the kid stops', () => {
  const { perf, moves } = follow([{ bpm: 100, beats: 16, rhythm: R.Q }], 6);
  assert.equal(moves.filter((m) => m > perf.end + 1500).length, 0);
});

/** Like follow(), but the piano sounds from each note until `ring` ms later, and notes carry a strength. */
function followSounding(notes, { seed = 1, ring = 400, end } = {}) {
  const f = createBeatFollower({ rng: rng(seed * 104729) });
  const moves = [];
  let i = 0, ringing = -Infinity;
  for (let now = 0; now < (end ?? notes.at(-1).at + 4000); now += 20) {
    while (i < notes.length && notes[i].at <= now) { f.note(notes[i].at, notes[i]); ringing = notes[i].at + (notes[i].ring ?? ring); i++; }
    moves.push(...f.beats(now, now < ringing));
  }
  return { f, moves };
}
const steadyNotes = (from, count, p, extra = {}) => Array.from({ length: count }, (_, k) => ({ at: from + k * p, strength: 5, ...extra }));

test('keeps dancing through a held note, and stops within about half a beat once the piano is quiet', () => {
  // 16 beats at 100 bpm, the last note held for 4 beats, then quiet
  const notes = steadyNotes(500, 16, 600);
  notes.at(-1).ring = 2400;
  const { moves } = followSounding(notes);
  const held = moves.filter((m) => m > notes.at(-1).at + 300);
  assert.ok(held.length >= 3, `${held.length} moves through the held note`);
  const quietAt = notes.at(-1).at + 2400;
  assert.equal(moves.filter((m) => m > quietAt + 400).length, 0, 'no dancing once it is quiet');
  // the same piece cut short with no held note: at most the next beat, then it stops
  const cut = followSounding(steadyNotes(500, 16, 600), { ring: 200 });
  assert.equal(cut.moves.filter((m) => m > 500 + 15 * 600 + 700).length, 0);
});

test('after a stop to think, the buddy picks the same tempo up again within a few notes', () => {
  for (const seed of [1, 2, 3]) {
    const p = 750;   // 80 bpm
    const before = steadyNotes(500, 16, p);
    const again = 500 + 16 * p + 2200;   // a 2 s stop, then the same piece again, off the old grid
    const after = steadyNotes(again, 12, p);
    const { moves, f } = followSounding([...before, ...after], { seed, ring: 500 });
    const early = moves.filter((m) => m > again && m < again + 4 * p + 100);
    assert.ok(early.length >= 1, `seed ${seed}: no dancing in the first 4 beats after the stop`);
    const onBeat = moves.filter((m) => m > again).filter((m) => after.some((n) => Math.abs(n.at - m) < 80));
    assert.ok(onBeat.length / moves.filter((m) => m > again).length >= 0.85, `seed ${seed}: off the new beat`);
    assert.ok(Math.abs(f.bpm - 80) <= 5 || Math.abs(f.bpm - 160) <= 10, `seed ${seed}: ${f.bpm} bpm`);
  }
});

test('strong notes count more than soft ones in between', () => {
  // a strong note on every beat (100 bpm) and soft notes at random places in between
  for (const seed of [1, 2, 3]) {
    const r = rng(seed * 31);
    const notes = [];
    for (let k = 0; k < 32; k++) {
      notes.push({ at: 500 + k * 600, strength: 8 });
      if (r() < 0.7) notes.push({ at: 500 + k * 600 + 120 + r() * 360, strength: 2 });
    }
    const { moves } = followSounding(notes, { seed });
    const onBeat = moves.filter((m) => m > 4000 && notes.some((n) => n.strength === 8 && Math.abs(n.at - m) < 80));
    const all = moves.filter((m) => m > 4000);
    assert.ok(all.length >= 16, `seed ${seed}: ${all.length} moves`);
    assert.ok(onBeat.length / all.length >= 0.85, `seed ${seed}: ${onBeat.length} of ${all.length} on the strong beats`);
  }
});

test('playing with no beat: the buddy dances much less than to a steady piece', () => {
  // it leans towards dancing (a kid playing steadily must not be told otherwise), so
  // random notes get some dancing, but far less than real playing
  for (const seed of [1, 2, 3, 4]) {
    const noodle = follow([{ noodle: 30000, gap: [120, 700] }], seed);
    const slow = follow([{ noodle: 30000, gap: [700, 2200] }], seed);
    assert.ok(noodle.moves.length <= 30, `seed ${seed}: ${noodle.moves.length} moves while noodling`);
    assert.ok(slow.moves.length <= 12, `seed ${seed}: ${slow.moves.length} moves on slow single notes`);
  }
});

test('dances to fast scale runs (four notes to a beat) and to a kid who wobbles a little', () => {
  for (const seed of [1, 2, 3]) {
    const run = follow([{ bpm: 100, beats: 24, rhythm: [[0, 0.25, 0.5, 0.75]] }], seed, { jitter: 15 });
    const runTime = run.moves.filter((m) => m > run.perf.sections[0].start + 3000 && m < run.perf.end);
    assert.ok(runTime.length >= 12, `seed ${seed}: ${runTime.length} moves in a scale run`);
    const wobbly = follow([{ bpm: 90, beats: 32, rhythm: R.Q }], seed, { jitter: 45, extra: 0.06 });
    assert.ok(wobbly.moves.length >= 18, `seed ${seed}: ${wobbly.moves.length} moves for a slightly wobbly kid`);
  }
});

test('is light: hundreds of notes in well under a second', () => {
  const perf = perform([{ noodle: 120000, gap: [100, 400] }], rng(9));
  const f = createBeatFollower({ rng: rng(10) });
  const t0 = performance.now();
  for (const t of perf.notes) { f.note(t); f.beats(t); }
  const perNote = (performance.now() - t0) / perf.notes.length;
  assert.ok(perNote < 2, `${perNote.toFixed(2)} ms per note`);
});
