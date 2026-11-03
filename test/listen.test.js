import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createListener, steadyBpm, buddyState, noteName } from '../js/listen.js';
import { RATE, pianoNotes, talking, addNoise, runListener } from './helpers/sound.mjs';

const listen = (samples) => {
  const l = createListener({ sampleRate: RATE, fftSize: 2048 });
  const events = runListener(l, addNoise(samples));
  return { l, events };
};
const SCALE = [262, 294, 330, 349, 392, 440, 494, 523];

test('hears each note of a slow scale as piano, with a steady beat', () => {
  const { l } = listen(pianoNotes(SCALE.map((hz, i) => ({ at: 0.3 + i * 0.5, hz })), { length: 5 }));
  assert.equal(l.state.pianoNotes, 8);
  assert.equal(l.state.otherSounds, 0);
  assert.equal(l.state.bpm, 120);
});

test('fast notes and chords are still piano', () => {
  const fast = listen(pianoNotes([...SCALE, ...SCALE].map((hz, i) => ({ at: 0.3 + i * 0.15, hz })), { length: 4 }));
  assert.ok(fast.l.state.pianoNotes >= 14, `fast: ${fast.l.state.pianoNotes}`);
  assert.ok(fast.l.state.otherSounds <= 1);
  const chords = listen(pianoNotes([0, 1, 2, 3].flatMap((i) => [262, 330, 392].map((h) => ({ at: 0.3 + i * 0.7, hz: h }))), { length: 4 }));
  assert.equal(chords.l.state.pianoNotes, 4);
  const low = listen(pianoNotes([65, 73, 82, 98].map((hz, i) => ({ at: 0.3 + i * 0.6, hz })), { length: 4 }));
  assert.equal(low.l.state.pianoNotes, 4);
});

test('talking is not piano', () => {
  for (const f0 of [120, 180, 280]) {
    const { l } = listen(talking(6, { f0 }));
    assert.equal(l.state.pianoNotes, 0, `voice at ${f0} Hz`);
    assert.ok(l.state.otherSounds > 5);
  }
});

test('silence makes no notes, and the clock counts from the start', () => {
  const { l } = listen(new Float32Array(RATE * 3));
  assert.equal(l.state.pianoNotes + l.state.otherSounds, 0);
  assert.ok(Math.abs(l.since(3000) - 3) < 0.01);
});

test('the buddy is bored at 30 seconds and asleep at 60', () => {
  assert.equal(buddyState(1), 'playing');
  assert.equal(buddyState(1, false), 'waiting');
  assert.equal(buddyState(10), 'waiting');
  assert.equal(buddyState(30), 'bored');
  assert.equal(buddyState(59.9), 'bored');
  assert.equal(buddyState(60), 'asleep');
});

test('a steady beat needs steady gaps; chords count once', () => {
  assert.equal(steadyBpm([0, 500, 1000, 1500, 2000]), 120);
  assert.equal(steadyBpm([0, 30, 500, 520, 1000, 1500, 1540, 2000]), 120);
  assert.equal(steadyBpm([0, 300, 1100, 1300, 2600, 2700]), 0);
  assert.equal(steadyBpm([0, 500, 1000]), 0);
});

test('note names', () => {
  assert.equal(noteName(440), 'A4');
  assert.equal(noteName(261.6), 'C4');
  assert.equal(noteName(0), '');
});
