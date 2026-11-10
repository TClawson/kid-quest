import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../js/songs.js';
import { fakeAudio } from './helpers/fake-audio.mjs';

// the music engine plays through the browser's AudioContext: give it one that writes the notes down
const { FakeAudioContext, played, contexts } = fakeAudio();
globalThis.window = { AudioContext: FakeAudioContext };
const { playPiece, startMusic, stopMusic } = await import('../js/music.js');

const START = 0.15; // playPiece starts this long after the clock's time

/**
 * Play a piece from the songbook (as Listen on its easy page does) to its end. Returns its
 * notes, drums left out, as { midi, bar, step } (step: the eighth of the bar it starts in).
 */
async function hear(id) {
  for (const c of contexts) c.currentTime = 0;
  played.length = 0;
  const h = playPiece(id);
  // notes are scheduled a little ahead of the clock: move the clock past the end, and wait a turn
  contexts[0].currentTime = 1e6;
  await new Promise((resolve) => { setTimeout(resolve, 150); });
  h.stop();
  const place = (n) => {
    const s = (n.t - START) / h.step + 1e-6;
    return { midi: n.midi, bar: Math.floor(s / h.beat), step: Math.floor(s % h.beat) };
  };
  return {
    notes: played.filter((n) => !n.swept && !n.noise).map(place),
    drums: played.filter((n) => n.swept).map(place), // kicks and toms
    noise: played.filter((n) => n.noise).map(place), // snares and hats
    bars: h.steps / h.beat,
  };
}
const classes = (notes) => [...new Set(notes.map((n) => n.midi % 12))].sort((a, b) => a - b);

test('two chords in a bar: the bass and the arpeggio change with the chord', async () => {
  // Phoenix Fire, bar 4: F for two beats, then E. The tune there is C6 B5, then A5 G#5.
  const fire = await hear('show:bg-volcano');
  assert.equal(fire.bars, 5);
  const band = (from, to) => fire.notes.filter((n) => n.bar === 3 && n.step >= from && n.step < to && n.midi < 79);
  assert.deepEqual(classes(band(0, 4)), [0, 5, 9], 'F, A and C under the first half');
  assert.deepEqual(classes(band(4, 8)), [4, 8, 11], 'E, G sharp and B under the second half');
  assert.ok(band(4, 8).some((n) => n.midi === 52), 'the bass lands on E on beat 3');
  // Dragon King Fanfare, bar 2: F, then B flat
  const king = await hear('show:bg-castle');
  const under = (from, to) => king.notes.filter((n) => n.bar === 1 && n.step >= from && n.step < to && n.midi < 82);
  assert.deepEqual(classes(under(0, 4)), [0, 5, 9]);
  assert.deepEqual(classes(under(4, 8)), [2, 5, 10], 'B flat, D and F under the second half');
  // a bar with one chord is as it was: all of bar 3 of Phoenix Fire is G
  assert.deepEqual(classes(fire.notes.filter((n) => n.bar === 2 && n.midi < 79)), [2, 7, 11]);
});

test('Listen plays a closing bar after the loop: one held home chord, and no more', async () => {
  const waltz = await hear('bg-ocean');
  assert.equal(SONGS['bg-ocean'].lead.length, 16);
  assert.equal(waltz.bars, 17, 'the sixteen bars of the loop, and the closing bar');
  const last = waltz.notes.filter((n) => n.bar === 16);
  assert.ok(last.length >= 3 && last.every((n) => n.step === 0), 'everything in the closing bar starts on its first beat');
  assert.deepEqual(classes(last), [2, 5, 9], 'D minor');
  assert.ok(last.some((n) => n.midi === 74), 'the tune comes home to D');
  assert.equal(waltz.notes.filter((n) => n.bar > 16).length, 0);
  // the bar before is still the loop's last bar (A, leading back), with its arpeggio running
  assert.deepEqual(classes(waltz.notes.filter((n) => n.bar === 15)), [1, 4, 9]);
  assert.ok(waltz.notes.filter((n) => n.bar === 15).length > 10);
  // a song that already ends at home has no closing bar
  assert.equal((await hear('bg-meadow')).bars, 16);
});

test('the new arpeggios come in where they should', async () => {
  const count = (id, bar) => hear(id).then((r) => r.notes.filter((n) => n.bar === bar).length);
  // Golden Stars: bare for four bars (tune and bass), then the sparkle (16 quick notes a bar)
  assert.ok(await count('bg-galaxy', 3) < 10);
  assert.ok(await count('bg-galaxy', 4) >= 16);
  // Ghost Ship Shanty: its first arpeggio, from bar 2
  assert.ok(await count('show:bg-sunset', 0) < 14);
  assert.ok(await count('show:bg-sunset', 1) >= 16);
});

test('the closing bar leaves the loop\'s drums alone: the build and the fill stay where they were', async () => {
  // Lava Run: four drum patterns over the sixteen bars of the loop, a fill in bar 16
  const lava = await hear('bg-volcano');
  assert.equal(lava.bars, 17);
  const drums = (bar) => lava.drums.filter((n) => n.bar === bar).length;
  const noise = (bar) => lava.noise.filter((n) => n.bar === bar).length;
  assert.equal(drums(3), 3, 'bars 1 to 4: three kicks');
  assert.equal(noise(3), 6, '... two snares and four hats');
  assert.equal(noise(4), 10, 'bars 5 to 8: eight hats');
  assert.equal(drums(8), 5, 'bars 9 to 12: two toms more');
  assert.equal(drums(12), 7, 'bars 13 to 15: four kicks and three toms');
  assert.equal(drums(15), 6, 'bar 16 is the fill: a kick and five toms');
  assert.equal(noise(15), 8);
  assert.deepEqual([drums(16), noise(16)], [1, 1], 'the closing bar: one kick and one open hat');
});

test('the game\'s loop never plays the closing bar', async () => {
  for (const c of contexts) c.currentTime = 0;
  played.length = 0;
  startMusic('bg-ocean');
  const step = 60 / SONGS['bg-ocean'].bpm / 2;
  // two times round and a bit, scheduled at the next turn of the engine's clock
  contexts[0].currentTime = 0.1 + step * 6 * 34;
  await new Promise((resolve) => { setTimeout(resolve, 150); });
  stopMusic();
  const notes = played.filter((n) => !n.swept && !n.noise).map((n) => {
    const k = Math.round(((n.t - 0.1) / step) * 100); // hundredths of an eighth from the start
    return { midi: n.midi, bar: Math.floor(k / 600), at: k % 600 };
  });
  const bar = (b) => notes.filter((n) => n.bar === b).map((n) => `${n.at}:${n.midi}`).sort().join(' ');
  assert.ok(bar(0).length > 0 && bar(33).length > 0, 'it played all the way');
  assert.equal(bar(16), bar(0), 'after bar 16 comes bar 1 again, not a closing bar');
  assert.equal(bar(17), bar(1));
  assert.equal(bar(32), bar(0));
  assert.notEqual(bar(16), bar(15));
});
