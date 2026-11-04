import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOnsetDetector, pitchBands, ONSET } from '../js/onsets.js';
import { RATE, pianoNotes, addNoise, room, singing } from './helpers/sound.mjs';

/** Feeds samples in blocks of `block` (the browser's audio worklet hands over 128). */
function find(x, { block = 128, tune } = {}) {
  const det = createOnsetDetector({ sampleRate: RATE, tune });
  const out = [];
  for (let i = 0; i < x.length; i += block) {
    const end = Math.min(x.length, i + block);
    out.push(...det.push(x.subarray(i, end), (end / RATE) * 1000));
  }
  return out;
}
const SCALE = [262, 294, 330, 349, 392, 440, 494, 523];

test('finds every note of a scale, each a little after it starts', () => {
  const notes = SCALE.map((hz, i) => ({ at: 0.3 + i * 0.5, hz }));
  const found = find(addNoise(pianoNotes(notes, { length: 5 })));
  assert.equal(found.length, 8);
  found.forEach((ev, i) => {
    const late = ev.at - notes[i].at * 1000;
    assert.ok(late >= 0 && late <= 50, `note ${i} reported ${late.toFixed(0)} ms after it started`);
  });
});

test('the same notes whatever size blocks the samples come in', () => {
  const x = addNoise(pianoNotes(SCALE.map((hz, i) => ({ at: 0.3 + i * 0.3, hz })), { length: 3 }));
  const at = (block) => find(x, { block }).map((e) => Math.round(e.at));
  assert.deepEqual(at(480), at(128));
  assert.deepEqual(at(x.length), at(128));
});

test('a louder note is stronger, and a bass note shows up as low', () => {
  const [soft, loud] = find(addNoise(pianoNotes([{ at: 0.3, hz: 440, g: 0.15 }, { at: 1.3, hz: 440, g: 1 }], { length: 2.5 })));
  assert.ok(loud.strength > soft.strength * 1.5, `soft ${soft.strength.toFixed(1)}, loud ${loud.strength.toFixed(1)}`);
  const [bass, treble] = find(addNoise(pianoNotes([{ at: 0.3, hz: 82 }, { at: 1.3, hz: 880 }], { length: 2.5 })));
  assert.ok(bass.low > bass.strength * 0.3, 'a bass note is mostly low');
  assert.ok(treble.low < treble.strength * 0.1, 'a high note is hardly low at all');
});

test('silence and a steady hum make no notes', () => {
  assert.equal(find(addNoise(new Float32Array(RATE * 2))).length, 0);
  const hum = Float32Array.from({ length: RATE * 2 }, (_, i) => 0.05 * Math.sin(2 * Math.PI * 120 * i / RATE));
  assert.ok(find(addNoise(hum)).length <= 1, 'only the hum starting, if anything');
});

test("a note's echo off the piano is not a second note", () => {
  // the tablet sits on the piano: each note comes back about 60 ms later, as loud
  // (with the papers' 30 ms rule, these 6 notes were found 10 times)
  const x = pianoNotes(SCALE.slice(0, 6).map((hz, i) => ({ at: 0.3 + i * 0.4, hz })), { length: 3 });
  const k = Math.round(0.06 * RATE);
  const echoed = Float32Array.from(x, (v, i) => v + (i >= k ? x[i - k] : 0));
  assert.equal(find(addNoise(echoed)).length, 6);
});

test('a sung note wobbling up and down (vibrato) is one note, not many', () => {
  // three held notes; without the published vibrato filter this made 14 "notes"
  assert.ok(find(addNoise(room(singing(4)))).length <= 4);
  assert.ok(find(addNoise(room(singing(4, { f0: 500, vibrato: 25, attack: 0.04 })))).length <= 6);
});

test('bands are a quarter tone apart, and the low ones never repeat the same bins', () => {
  const bands = pitchBands(RATE, ONSET.size, ONSET.lowHz, ONSET.highHz, ONSET.perOctave);
  const keys = bands.map((b) => b.bins.map((x) => x[0]).join());
  for (let i = 1; i < keys.length; i++) assert.notEqual(keys[i], keys[i - 1]);
  const top = bands.slice(-2);
  assert.ok(Math.abs(1200 * Math.log2(top[1].hz / top[0].hz) - 50) < 1, 'a quarter tone at the top');
});
