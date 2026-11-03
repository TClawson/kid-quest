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

test('playing with no beat: the buddy hardly dances', () => {
  for (const seed of [1, 2, 3, 4]) {
    const noodle = follow([{ noodle: 30000, gap: [120, 700] }], seed);
    const slow = follow([{ noodle: 30000, gap: [700, 2200] }], seed);
    assert.ok(noodle.moves.length <= 4, `seed ${seed}: ${noodle.moves.length} moves while noodling`);
    assert.ok(slow.moves.length <= 2, `seed ${seed}: ${slow.moves.length} moves on slow single notes`);
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
