// The Note-o-Matic's ears (js/listener.js): made-up piano sound in, the keys and times out.
// The sound here is a stand-in for a piano (a few stretched overtones that die away); how it
// does on real recordings of a real piano is measured outside the tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listen, prepare, tuningOf, spectrogram, stretchOf, SETTINGS } from '../js/listener.js';
import { clickWave, CLICK } from '../js/studio-audio.js';

// a repeatable random number, 0 to 1
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Piano-like sound: notes [{ midi, on, len, vel }] as stretched overtones (many for a low note) with a fast start that die away. */
function piano(notes, rate, seconds, { cents = 0, hiss = 0.002, seed = 7 } = {}) {
  const x = new Float32Array(Math.round(seconds * rate));
  for (const { midi, on, len = 0.45, vel = 0.5 } of notes) {
    const f0 = 440 * 2 ** ((midi - 69 + cents / 100) / 12);
    const B = stretchOf(midi);
    const start = Math.round(on * rate);
    const n = Math.round((len + 0.3) * rate);
    for (let k = 1; k <= 24; k += 1) {
      const f = k * f0 * Math.sqrt(1 + B * k * k);
      if (f > Math.min(6000, 0.45 * rate)) break;
      const loud = vel / k ** 1.2;
      const tau = 0.7 / Math.sqrt(k);
      for (let i = 0; i < n && start + i < x.length; i += 1) {
        const t = i / rate;
        const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / tau) * (t > len ? Math.exp(-(t - len) / 0.05) : 1);
        x[start + i] += loud * env * Math.sin(2 * Math.PI * f * t);
      }
    }
  }
  const r = seeded(seed);
  for (let i = 0; i < x.length; i += 1) x[i] += hiss * (2 * r() - 1);
  return x;
}

const keysOf = (notes) => notes.map((n) => n.midi);
const TUNE = [60, 64, 67, 72, 71, 67, 64, 60].map((midi, i) => ({ midi, on: 0.3 + i * 0.5 }));

test('a tune comes out note for note, each within 30 ms of where it was played', () => {
  const heard = listen(piano(TUNE, 48000, 4.8), 48000);
  assert.deepEqual(keysOf(heard), keysOf(TUNE));
  heard.forEach((n, i) => {
    assert.ok(Math.abs(n.on - TUNE[i].on) < 0.03, `note ${i} at ${n.on}, played at ${TUNE[i].on}`);
    assert.ok(n.off > n.on && n.vel > 0 && n.vel <= 1);
  });
});

test('it works from any usual microphone rate', () => {
  for (const rate of [44100, 24000, 16000]) {
    const heard = listen(piano(TUNE, rate, 4.8), rate);
    assert.deepEqual(keysOf(heard), keysOf(TUNE), `at ${rate}`);
  }
  const ready = prepare(new Float32Array(48000), 48000);
  assert.equal(ready.rate, 24000);
  assert.equal(ready.samples.length, 24000);
  assert.equal(prepare(new Float32Array(44100), 44100).rate, 22050);
});

test('a chord in two hands: every note, and no overtone taken for a note', () => {
  const chords = [
    [36, 60, 64, 67], // C major over a low C
    [41, 60, 65, 69], // F
    [43, 59, 62, 67], // G
    [36, 60, 64, 72],
  ];
  const notes = chords.flatMap((c, i) => c.map((midi) => ({ midi, on: 0.3 + i, len: 0.9 })));
  const heard = listen(piano(notes, 48000, 4.6), 48000);
  chords.forEach((c, i) => {
    const got = heard.filter((n) => Math.abs(n.on - (0.3 + i)) < 0.06).map((n) => n.midi).sort((a, b) => a - b);
    assert.deepEqual(got, c, `chord ${i}`);
  });
  assert.equal(heard.length, 16);
});

test('a piano that is out of tune is still heard right, and how far out is measured', () => {
  for (const cents of [-25, 20]) {
    const x = piano(TUNE, 48000, 4.8, { cents });
    assert.deepEqual(keysOf(listen(x, 48000)), keysOf(TUNE), `${cents} cents`);
    const ready = prepare(x, 48000);
    const tune = tuningOf(spectrogram(ready.samples, ready.rate));
    assert.ok(Math.abs(tune - cents) < 6, `measured ${tune} for ${cents}`);
  }
});

test('the same key struck again is two notes', () => {
  // (a key has to come up before it can be struck again, so the first note stops a moment before the second)
  const notes = [60, 60, 60, 62, 62].map((midi, i) => ({ midi, on: 0.3 + i * 0.3, len: 0.18 }));
  assert.deepEqual(keysOf(listen(piano(notes, 48000, 2.4), 48000)), [60, 60, 60, 62, 62]);
});

test('a key struck again while it still rings is a new note; a held key under other notes is not', () => {
  // (the key comes up for a moment and the string is still sounding when the hammer comes down again)
  const rate = 24000;
  const tune = [67, 67, 69, 67, 72, 71].map((midi, i) => ({ midi, on: 0.3 + i * 0.25, len: 0.2 }));
  assert.deepEqual(keysOf(listen(piano(tune, rate, 2.6), rate)), [67, 67, 69, 67, 72, 71]);
  const held = [{ midi: 48, on: 0.3, len: 3 }, ...[60, 64, 67, 72, 67, 64].map((midi, i) => ({ midi, on: 0.3 + i * 0.4, len: 0.35 }))];
  const heard = listen(piano(held, rate, 3.6), rate);
  assert.equal(heard.filter((n) => n.midi === 48).length, 1);
  assert.equal(heard.length, 7);
});

test('an octave above: the piano\'s usual ghost goes; a real octave among single notes and playing in octaves stay', () => {
  const rate = 24000;
  const tune = [60, 62, 64, 65, 67, 65, 64, 62, 60, 64, 67, 64];
  const note = (midi, i, vel = 0.5) => ({ midi, on: 0.3 + i * 0.4, len: 0.35, vel });
  // every strike brings a soft note an octave up with it, some stronger than others (what a
  // bright piano's overtones look like): only the tune is heard
  const bright = tune.flatMap((midi, i) => [note(midi, i), note(midi + 12, i, i % 3 === 1 ? 0.22 : 0.12)]);
  assert.deepEqual(keysOf(listen(piano(bright, rate, 5.6), rate)), tune);
  // but a tune played in octaves all the way, the upper hand softer, is two hands: every note stays
  const hands = tune.flatMap((midi, i) => [note(midi, i), note(midi + 12, i, 0.3)]);
  assert.deepEqual(keysOf(listen(piano(hands, rate, 5.6), rate)).sort((a, b) => a - b), [...tune, ...tune.map((m) => m + 12)].sort((a, b) => a - b));
  // one such octave in a tune of single notes is out of the usual: it was played
  const once = tune.flatMap((midi, i) => (i === 5 ? [note(midi, i), note(midi + 12, i, 0.22)] : [note(midi, i)]));
  const heard = listen(piano(once, rate, 5.6), rate);
  assert.equal(heard.length, 13);
  assert.ok(heard.some((n) => n.midi === 77 && Math.abs(n.on - 2.3) < 0.03));
  // and a low octave under a chord (an overtone of its own in the picture) is a note
  const low = [[41, 53, 57, 60], [36, 48, 52, 55]].flatMap((c, i) => c.map((midi) => ({ midi, on: 0.3 + i, len: 0.9 })));
  assert.deepEqual(keysOf(listen(piano(low, rate, 2.6), rate)).sort((a, b) => a - b), [36, 41, 48, 52, 53, 55, 57, 60]);
});

test('silence, hiss and a recording too short to look at give no notes', () => {
  assert.deepEqual(listen(new Float32Array(48000), 48000), []);
  assert.deepEqual(listen(new Float32Array(100), 48000), []);
  assert.deepEqual(listen(piano([], 48000, 2, { hiss: 0.01 }), 48000), []);
});

/** A quiet room: a low rumble with hiss on top (most of a real room's noise is low), at loudness `level`. */
function room(rate, seconds, level, seed = 11) {
  const x = new Float32Array(Math.round(seconds * rate));
  const r = seeded(seed);
  let low = 0;
  for (let i = 0; i < x.length; i += 1) {
    const w = 2 * r() - 1;
    low = 0.98 * low + w;
    x[i] = level * (0.05 * low + 0.005 * w);
  }
  return x;
}

test('a quiet room with no piano in it gives no notes, however the take is turned up', () => {
  // (a take is made as loud as it can be before it is kept, so "quiet" can't be told from its loudness)
  for (const level of [0.001, 0.02, 0.9]) {
    assert.deepEqual(listen(room(48000, 6, level), 48000), [], `at ${level}`);
  }
  assert.deepEqual(listen(room(24000, 3, 0.01, 5), 24000), []);
});

test('a little playing and then a long quiet room: the playing, and nothing from the room', () => {
  const rate = 24000;
  const few = TUNE.slice(0, 4);
  const x = piano(few, rate, 24);
  const quiet = room(rate, 24, 0.004);
  for (let i = 0; i < x.length; i += 1) x[i] += quiet[i];
  const heard = listen(x, rate);
  assert.deepEqual(keysOf(heard), keysOf(few));
  // and the same playing is heard the same with the room cut off
  assert.deepEqual(keysOf(listen(x.subarray(0, 3 * rate), rate)), keysOf(few));
});

test('the studio\'s clicks are not notes, once it is told when they sound', () => {
  const rate = 48000;
  // a tune on the beat (two beats a second) with a click on every beat, as loud as the piano
  const x = piano(TUNE, rate, 4.8);
  const clicks = [];
  for (let i = 0; 0.3 + i * 0.5 < 4.6; i += 1) {
    const hz = i % 4 === 0 ? CLICK.first : CLICK.other;
    const wave = clickWave(rate, hz);
    const at = 0.3 + i * 0.5;
    for (let j = 0; j < wave.length; j += 1) x[Math.round(at * rate) + j] += 0.5 * wave[j];
    clicks.push({ at, hz });
  }
  assert.deepEqual(keysOf(listen(x, rate, { clicks })), keysOf(TUNE));
  // and a click with no note on it leaves nothing behind
  const alone = piano(TUNE.slice(0, 2), rate, 4.8);
  const later = [{ at: 2.5, hz: CLICK.first }, { at: 3, hz: CLICK.other }, { at: 3.5, hz: CLICK.other }];
  for (const c of later) { const wave = clickWave(rate, c.hz); for (let j = 0; j < wave.length; j += 1) alone[Math.round(c.at * rate) + j] += 0.5 * wave[j]; }
  assert.deepEqual(keysOf(listen(alone, rate, { clicks: later })), [60, 64]);
  // telling it about clicks that are not there loses nothing
  assert.deepEqual(keysOf(listen(piano(TUNE, rate, 4.8), rate, { clicks })), keysOf(TUNE));
});

test('progress goes up to 1 and never back', () => {
  const seen = [];
  listen(piano(TUNE.slice(0, 3), 24000, 2), 24000, { progress: (f) => seen.push(f) });
  assert.ok(seen.length >= SETTINGS.iters + SETTINGS.itersJoint);
  assert.equal(seen[seen.length - 1], 1);
  for (let i = 1; i < seen.length; i += 1) assert.ok(seen[i] >= seen[i - 1]);
  assert.ok(seen[0] > 0 && seen[0] < 0.1);
});

test('settings can be changed for one listen without changing the usual ones', () => {
  const x = piano(TUNE.slice(0, 3), 24000, 2);
  const before = { ...SETTINGS };
  assert.deepEqual(listen(x, 24000, { settings: { alpha: 50 } }), []); // nothing is that loud
  assert.deepEqual(SETTINGS, before);
  assert.equal(listen(x, 24000).length, 3);
});
