// A composing desk song in the recording studio (js/composestudio.js): the tune and its chords
// as a studio tune, both passes when they fit in thirty seconds, and it goes into a mix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newSong, makeTune, PATHS, METERS, METER_IDS, tuneLength, BARS, voicing, chordDef } from '../js/composerules.js';
import { songAsTune, studioCount, studioPasses, STUDIO_VOICE } from '../js/composestudio.js';
import { addTune, newMix, maxBars, badges, cleanMix } from '../js/studiorules.js';

const songIn = (meter, key = { tonic: 0, mode: 'major' }) => {
  const s = newSong(0);
  Object.assign(s, { meter, key, bars: PATHS[key.mode][1].bars.slice(), bpm: METERS[meter].bpm, tune: Array(tuneLength(meter)).fill(null) });
  s.tune = makeTune(s, { seed: 4 });
  return s;
};

test('a desk song with no notes does not go to the studio', () => {
  const s = newSong(0);
  assert.equal(songAsTune(s), null);
});

test('every timing counts the way the studio does', () => {
  assert.deepEqual(studioCount('4/4', 128), { meter: 4, bpm: 128 });
  assert.deepEqual(studioCount('3/4', 96), { meter: 3, bpm: 96 });
  assert.deepEqual(studioCount('6/8', 64), { meter: 3, bpm: 96 }); // a dotted-quarter beat is three eighths
});

test('the tune and its chords go in both times round, with the second time up high', () => {
  for (const meter of METER_IDS) for (const key of [{ tonic: 7, mode: 'major' }, { tonic: 2, mode: 'minor' }]) {
    const s = songIn(meter, key);
    s.second = 'high';
    s.voice = 'flute';
    const t = songAsTune(s, { id: 'x' });
    const st = METERS[meter].steps;
    const len = tuneLength(meter);
    assert.equal(t.reading, 'band');
    assert.equal(t.voice, STUDIO_VOICE.flute);
    assert.equal(t.beats, len);
    assert.equal(studioPasses(s), 2);
    const [tune, band] = t.parts;
    const first = tune.notes.filter((n) => n.at < len);
    const second = tune.notes.filter((n) => n.at >= len);
    assert.equal(first.length, s.tune.filter(Number.isInteger).length);
    assert.deepEqual(second.map((n) => [n.at - len, n.len, n.midi - 12]), first.map((n) => [n.at, n.len, n.midi]));
    // each note starts where it was written and lasts until the next one
    for (const n of first) {
      assert.equal(s.tune[n.at], n.midi);
      assert.ok(s.tune.slice(n.at + 1, n.at + n.len).every((v) => v === null));
    }
    // the band holds each bar's chord, as the desk voices it
    for (let b = 0; b < BARS; b += 1) {
      const { bass, tones } = voicing(key, chordDef(key.mode, s.bars[b]));
      assert.deepEqual(band.notes.filter((n) => n.at === b * st).map((n) => n.midi), [bass, ...tones]);
    }
    // in a new mix: the whole thing fits, at the song's speed
    const r = addTune(newMix(), 0, t, 0);
    assert.equal(r.error, null);
    assert.equal(r.note, '');
    assert.equal(r.ids.length, 2);
    assert.equal(r.mix.bpm, studioCount(meter, s.bpm).bpm);
    assert.equal(r.mix.bars, 2 * BARS);
    assert.ok(r.mix.bars <= maxBars(r.mix.bpm, r.mix.meter));
  }
});

test('a slow song goes in once round, so it fits the studio', () => {
  const s = songIn('4/4');
  s.bpm = METERS['4/4'].min;
  assert.equal(studioPasses(s), 1);
  const t = songAsTune(s);
  assert.equal(t.beats, tuneLength('4/4') / 2);
  const r = addTune(newMix(), 0, t, 0);
  assert.equal(r.error, null);
  assert.equal(r.note, '');
  assert.equal(r.mix.bars, BARS);
  // the same notes the second time when the song keeps it the same
  const same = songIn('3/4');
  same.second = 'same';
  const u = songAsTune(same);
  const len = tuneLength('3/4');
  assert.deepEqual(u.parts[0].notes.filter((n) => n.at >= len).map((n) => n.midi), u.parts[0].notes.filter((n) => n.at < len).map((n) => n.midi));
});

test('a desk song in a mix keeps its name, and earns the composer sticker (not the recording ones)', () => {
  const s = songIn('4/4');
  s.name = 'Sea Song';
  const t = songAsTune(s);
  assert.equal(t.desk, 'Sea Song');
  const { mix } = addTune(newMix(), 0, t, 0);
  const kept = cleanMix(JSON.parse(JSON.stringify(mix)));
  assert.deepEqual(kept.tracks.flat().map((c) => c.desk), ['Sea Song', 'Sea Song']);
  const ids = badges(kept).map((b) => b.id);
  assert.ok(ids.includes('composer'));
  for (const id of ['take', 'notes', 'leader']) assert.ok(!ids.includes(id), id);
});
