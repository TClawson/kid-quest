// "Teach me your piano" (js/pianoteach.js, js/teachrules.js): one key heard alone, named, and
// kept as a fingerprint the Note-o-Matic's ears can use. The sound is a stand-in for a piano
// (test/helpers/strings.mjs); how it does on a real one is measured outside the tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listen, prepare, spectrogram, taughtKey, stretchOf, SETTINGS } from '../js/listener.js';
import { TEACH, strikesIn, ringPicture, fitString, whichKey, teachRun, keyEar, emptyPiano, addKey, rebin } from '../js/pianoteach.js';
import {
  TEACH_GROUPS, TEACH_KEYS, TEACH_LOW, TEACH_HIGH, ECHO, keyName, isBlack, knownIn, knownKeys, nextGroup, cleanPiano,
  newRound, wanted, roundStep, skipKey, offWords, groupById, usablePiano, TEACH_READY,
} from '../js/teachrules.js';
import { pianoSound, keysInARow } from './helpers/strings.mjs';

const RATE = 48000;
const pictureOf = (midi, how) => {
  const ready = prepare(pianoSound([{ midi, on: 0.2, len: 0.7 }], RATE, 1.2, how), RATE);
  const spec = spectrogram(ready.samples, ready.rate);
  return { pic: ringPicture(spec, 20), df: spec.df, spec };
};
/** Play keys through the game's ears, block by block as a microphone gives them: every answer. */
function hearKeys(sound, rate, onAnswer, first) {
  const ear = keyEar(rate);
  ear.expect(first);
  const all = [];
  for (let i = 0; i < sound.length; i += 480) {
    for (const ev of ear.push(sound.subarray(i, Math.min(sound.length, i + 480)))) { all.push(ev); onAnswer?.(ev, ear); }
  }
  return all;
}

test('the groups cover A2 to C8 once each, from the middle outward', () => {
  const all = TEACH_GROUPS.flatMap((g) => g.keys).sort((a, b) => a - b);
  assert.equal(all.length, TEACH_KEYS);
  assert.deepEqual(all, Array.from({ length: TEACH_HIGH - TEACH_LOW + 1 }, (_, i) => TEACH_LOW + i));
  assert.equal(TEACH_GROUPS[0].keys[0], 60);
  assert.equal(TEACH_LOW, SETTINGS.taughtFrom, 'the game asks only for keys the ears use');
  for (const g of TEACH_GROUPS) assert.ok(g.name && g.start && groupById(g.id) === g);
  assert.equal(keyName(61), 'C♯');
  assert.ok(isBlack(61) && !isBlack(60));
});

test('a key played alone is named: the right one is taken, a wrong one is told apart', () => {
  for (const midi of [45, 52, 60, 66, 72, 79, 88, 96, 108]) {
    const { pic, df } = pictureOf(midi);
    const right = whichKey(pic, df, midi);
    assert.ok(right.sure && right.midi === midi, `${midi} as itself`);
    for (const off of [-12, -7, -2, -1, 1, 2, 5, 12]) {
      const want = midi + off;
      if (want < TEACH_LOW || want > TEACH_HIGH) continue;
      const w = whichKey(pic, df, want);
      assert.ok(!(w.sure && w.midi === want), `${midi} was played, ${want} was asked for`);
      if (midi < 96 && want < 96) assert.equal(w.midi, midi, `${midi} played while ${want} was asked for is named`);
    }
  }
});

test('a room with no piano in it is no key', () => {
  const noise = pianoSound([], RATE, 1.2, { hiss: 0.3 });
  const ready = prepare(noise, RATE);
  const spec = spectrogram(ready.samples, ready.rate);
  for (const midi of [48, 60, 72, 90]) assert.equal(whichKey(ringPicture(spec, 20), spec.df, midi).sure, false);
});

test("a key teaches where its string really is: off pitch, and how stretched", () => {
  for (const [midi, cents, stretch] of [[60, -14, 1], [67, 9, 2], [52, 20, 0.5], [76, -25, 1.5]]) {
    const { pic, df } = pictureOf(midi, { cents, stretch });
    const fit = fitString(pic, df, midi);
    assert.ok(Math.abs(fit.cents - cents) < 4, `${midi}: ${fit.cents.toFixed(1)} cents for ${cents}`);
    assert.ok(Math.abs(Math.log2(fit.B / (stretch * stretchOf(midi)))) < 0.6, `${midi}: stretch ${fit.B} for ${stretch * stretchOf(midi)}`);
  }
});

test('a recording of keys in a row teaches each of them', () => {
  const midis = TEACH_GROUPS[0].keys;
  const { sound } = keysInARow(midis, RATE, { cents: 8 });
  const { piano, ok, strikes } = teachRun(sound, RATE, midis);
  assert.ok(ok);
  assert.equal(strikes.length, midis.length);
  assert.deepEqual(Object.keys(piano.keys).map(Number), midis);
  for (const m of midis) {
    const k = piano.keys[m];
    assert.ok(Math.abs(k.cents - 8) < 4 && k.B > 0 && k.n === 1);
    let sum = 0; for (const v of k.pic) sum += v;
    assert.ok(Math.abs(sum - 1) < 1e-3);
  }
  // the wrong number of strikes teaches nothing
  assert.equal(teachRun(sound, RATE, midis.slice(1)).ok, false);
  assert.ok(strikesIn(spectrogram(prepare(sound, RATE).samples, 24000)).length === midis.length);
});

test("the game's ears: every key of a group, played in order, is taken", () => {
  for (const rate of [48000, 44100]) {
    const round = newRound('middle');
    const { sound } = keysInARow(round.keys, rate);
    const said = [];
    hearKeys(sound, rate, (ev, ear) => {
      const r = roundStep(round, ev);
      if (r.what !== 'strike') said.push(r.what);
      ear.expect(wanted(round));
    }, wanted(round));
    assert.equal(round.done, true, `at ${rate}: ${said.join(' ')}`);
    assert.deepEqual(said.filter((w) => w !== 'echo'), [...Array(11).fill('key'), 'done']);
    assert.deepEqual(Object.keys(round.got).map(Number), round.keys);
  }
});

test("the game's ears: a wrong key, the same key again and a key let go are not taken", () => {
  // C, C again, E (wrong: C sharp is wanted), C sharp
  const sound = pianoSound([60, 60, 64, 61].map((midi, i) => ({ midi, on: 0.4 + i * 1.5, len: 0.7 })), RATE, 6.6);
  const round = newRound('middle');
  const said = [];
  hearKeys(sound, RATE, (ev, ear) => {
    const r = roundStep(round, ev);
    if (r.what !== 'strike' && r.what !== 'echo') said.push(r);
    ear.expect(wanted(round));
  }, wanted(round));
  assert.deepEqual(said.map((r) => r.what), ['key', 'again', 'other', 'key']);
  assert.equal(said[2].midi, 64);
  assert.equal(said[2].off, 3);
  assert.equal(round.at, 2);
  assert.equal(offWords(2), '2 keys too high');
  assert.equal(offWords(-1), '1 key too low');
  assert.equal(offWords(-12), 'one octave too low');
});

test("the game's ears: keys played too fast are told so, and the round waits", () => {
  const sound = pianoSound([60, 61, 62].map((midi, i) => ({ midi, on: 0.4 + i * 0.3, len: 0.25 })), RATE, 2.5);
  const round = newRound('middle');
  const whats = hearKeys(sound, RATE, (ev, ear) => { roundStep(round, ev); ear.expect(wanted(round)); }, wanted(round)).map((e) => e.type);
  assert.ok(whats.includes('fast') || whats.includes('unclear'));
  assert.ok(round.at < 3);
});

test('a round: skipping, the echo of a key just taken, the end', () => {
  const round = newRound('deep');
  assert.deepEqual(round.keys, [45, 46, 47]);
  const learned = { pic: new Float32Array(8).fill(1 / 8), cents: 0, B: 1e-4 };
  assert.equal(roundStep(round, { type: 'key', midi: 45, learned, at: 1, peak: 0.5 }).what, 'key');
  // its own noise right after it: nothing to say
  assert.equal(roundStep(round, { type: 'unclear', at: 1 + ECHO - 0.1, peak: 0.1 }).what, 'echo');
  assert.equal(roundStep(round, { type: 'other', midi: 45, at: 1 + ECHO - 0.1, peak: 0.1 }).what, 'echo');
  assert.equal(roundStep(round, { type: 'unclear', at: 3, peak: 0.1 }).what, 'unclear');
  assert.equal(roundStep(round, { type: 'fast', at: 4, peak: 0.1 }).what, 'fast');
  skipKey(round);
  assert.deepEqual(round.skipped, [46]);
  const end = roundStep(round, { type: 'key', midi: 47, learned, at: 6, peak: 1 });
  assert.equal(end.what, 'done');
  assert.equal(end.loud, true);
  assert.equal(wanted(round), null);
  assert.equal(roundStep(round, { type: 'key', midi: 47, learned, at: 7, peak: 1 }).what, 'echo');
  assert.equal(newRound('nowhere'), null);
});

test('a taught piano: counting what it knows, keeping a key twice, tidying what was stored', () => {
  const midis = TEACH_GROUPS[0].keys;
  const { piano } = teachRun(keysInARow(midis, RATE).sound, RATE, midis);
  assert.equal(knownIn(piano, TEACH_GROUPS[0]), 12);
  assert.equal(knownKeys(piano), 12);
  assert.equal(nextGroup(piano).id, 'low');
  assert.equal(nextGroup(null).id, 'middle');
  assert.equal(knownKeys(null), 0);
  // the ears use it only once most keys are taught
  assert.equal(usablePiano(piano), null);
  assert.equal(usablePiano(null), null);
  const full = { ...piano, keys: Object.fromEntries(TEACH_GROUPS.flatMap((g) => g.keys).slice(0, TEACH_READY).map((m) => [m, piano.keys[60]])) };
  assert.equal(usablePiano(full), full);
  // taught again: the new picture takes the old one's place, or both count
  const again = { pic: Float32Array.from(piano.keys[60].pic), cents: 10, B: piano.keys[60].B };
  const was = piano.keys[60].cents;
  addKey(piano, 60, again, { again: true });
  assert.equal(piano.keys[60].n, 2);
  assert.ok(Math.abs(piano.keys[60].cents - (was + 10) / 2) < 1e-6);
  addKey(piano, 60, again);
  assert.equal(piano.keys[60].n, 1);
  assert.equal(piano.keys[60].cents, 10);
  // a picture from another sample rate is moved onto the piano's own bins
  const other = rebin(again.pic, piano.df, piano.df * 0.92, again.pic.length);
  addKey(piano, 61, { pic: other, cents: 0, B: 1e-4, df: piano.df * 0.92 });
  assert.equal(piano.keys[61].pic.length, again.pic.length);
  // what comes back from the tablet's store (plain objects, maybe broken)
  const stored = JSON.parse(JSON.stringify({ ...piano, keys: Object.fromEntries(Object.entries(piano.keys).map(([m, k]) => [m, { ...k, pic: Array.from(k.pic) }])) }));
  stored.keys[62].pic = [1, 2, 'x'];
  stored.keys[200] = stored.keys[60];
  stored.keys[63].cents = 'much';
  const clean = cleanPiano(stored);
  assert.ok(clean.keys[60].pic instanceof Float32Array);
  assert.equal(clean.keys[62], undefined);
  assert.equal(clean.keys[200], undefined);
  assert.equal(clean.keys[63].cents, 0);
  assert.equal(cleanPiano(null), null);
  assert.equal(cleanPiano({ df: 11.7, keys: {} }), null);
  assert.equal(cleanPiano({ df: 0, keys: stored.keys }), null);
  assert.equal(emptyPiano(11.7).df, 11.7);
});

test('the ears use a taught piano: a tune and chords are heard right, on a usual piano and on one with odd strings', () => {
  const midis = [...TEACH_GROUPS[1].keys, ...TEACH_GROUPS[0].keys, ...TEACH_GROUPS[2].keys].sort((a, b) => a - b);
  const tune = [60, 64, 67, 72, 71, 67, 64, 60].map((midi, i) => ({ midi, on: 0.3 + i * 0.5 }));
  const chords = [[48, 55, 64], [53, 60, 69], [55, 62, 71], [48, 60, 76]].flatMap((c, i) => c.map((midi) => ({ midi, on: 0.3 + i * 0.9, len: 0.7 })));
  const sorted = (notes) => notes.map((n) => n.midi).sort((a, b) => a - b);
  const odd = { cents: -12, stretch: 1.6, bright: 0.9 }; // flat, with strings much more stretched than usual, and bright
  let piano = null;
  for (const how of [{}, odd]) {
    const taught = teachRun(keysInARow(midis, RATE, how).sound, RATE, midis);
    assert.ok(taught.ok);
    piano = taught.piano;
    for (const notes of [tune, chords]) {
      const sound = pianoSound(notes, RATE, 4.8, how);
      assert.deepEqual(sorted(listen(sound, RATE, { taught: piano })), sorted(notes));
      // (without teaching, the usual piano is heard right too; the odd one gets notes an octave under the tune)
      if (how !== odd) assert.deepEqual(sorted(listen(sound, RATE)), sorted(notes));
    }
  }
  const how = odd;
  // a taught key's fingerprint; a key under A2 or one never taught keeps the usual one
  const spec = spectrogram(prepare(pianoSound(tune, RATE, 4.8, how), RATE).samples, 24000);
  const key = taughtKey(spec, piano, 60);
  assert.ok(key.taught && key.bins.length > 4 && Math.abs(1200 * Math.log2(key.f0 / 261.6256) + 12) < 4);
  assert.equal(taughtKey(spec, piano, 90), null);
  assert.equal(taughtKey(spec, { ...piano, keys: { 40: piano.keys[60] } }, 40), null);
  assert.equal(taughtKey(spec, null, 60), null);
  assert.ok(TEACH.ringTo > TEACH.ringFrom);
});
