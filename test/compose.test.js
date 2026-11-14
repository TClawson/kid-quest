// The composing desk's music (js/composerules.js): timings, keys, the tune maker and songs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METERS, METER_IDS, PATHS, CHORDS, HELP, helpOpen, homeNotes, newSong, cleanSong, tuneLength, loopSeconds,
  makeTune, startTune, leaningNotes, convertTune, moveTune, swapBars, chordName, chordDef, keyName, hearChords,
  hearTune, songEvents, gridRows, SHAPES, RHYTHMS, BARS, freeSongSlot, chordsAt,
} from '../js/composerules.js';

const songIn = (meter, key, path = 0) => {
  const s = newSong(0);
  s.meter = meter;
  s.key = key;
  s.bars = PATHS[key.mode][path].bars.slice();
  s.bpm = METERS[meter].bpm;
  s.tune = Array(tuneLength(meter)).fill(null);
  return s;
};

test('every timing makes a loop of about thirty seconds at its own speed', () => {
  for (const id of METER_IDS) {
    const m = METERS[id];
    assert.ok(Math.abs(loopSeconds(id, m.bpm) - 30) < 0.5, `${id}: ${loopSeconds(id, m.bpm)}`);
    assert.ok(m.min <= m.bpm && m.bpm <= m.max);
  }
});

test('help opens with the pianos, and each level shows more keys and chords', () => {
  assert.deepEqual([1, 2, 3].map(helpOpen), [0, 1, 2]);
  assert.equal(HELP.length, 3);
  for (const mode of ['major', 'minor']) {
    assert.equal(homeNotes(mode, 0).length, 3);
    assert.equal(homeNotes(mode, 1).length, 6);
    assert.equal(homeNotes(mode, 2).length, 12);
    assert.ok(chordsAt(mode, 0).length < chordsAt(mode, 1).length && chordsAt(mode, 1).length < chordsAt(mode, 2).length);
    // every ready path uses only lots-of-help chords
    for (const p of PATHS[mode]) for (const rn of p.bars) assert.equal(chordDef(mode, rn).lvl, 0, `${p.name} ${rn}`);
  }
});

test('chord and key names are spelled for the key', () => {
  assert.equal(keyName({ tonic: 5, mode: 'major' }), 'F major');
  assert.equal(chordName({ tonic: 5, mode: 'major' }, chordDef('major', 'IV')), 'B♭');
  assert.equal(chordName({ tonic: 9, mode: 'minor' }, chordDef('minor', 'V')), 'E');
  assert.equal(chordName({ tonic: 2, mode: 'minor' }, chordDef('minor', 'VI')), 'B♭');
  assert.equal(chordName({ tonic: 7, mode: 'major' }, chordDef('major', 'V7')), 'D7');
  assert.equal(chordName({ tonic: 0, mode: 'major' }, chordDef('major', '♭VII')), 'B♭');
  assert.equal(chordName({ tonic: 2, mode: 'major' }, chordDef('major', '♭VII')), 'C');
});

test('the tune maker lands every big beat on a chord note, in every timing, mood, shape and rhythm', () => {
  for (const meter of METER_IDS) for (const key of [{ tonic: 0, mode: 'major' }, { tonic: 9, mode: 'minor' }, { tonic: 10, mode: 'major' }, { tonic: 6, mode: 'minor' }]) {
    for (let path = 0; path < 3; path += 1) for (const shape of Object.keys(SHAPES)) for (const rhythm of Object.keys(RHYTHMS)) {
      const s = songIn(meter, key, path);
      for (let seed = 1; seed < 4; seed += 1) {
        s.tune = makeTune(s, { shape, rhythm, seed });
        assert.equal(s.tune.length, tuneLength(meter));
        assert.equal(leaningNotes(s).size, 0, `${meter} ${keyName(key)} ${shape} ${rhythm} ${seed}`);
        assert.ok(s.tune.every((v) => v === null || (Number.isInteger(v) && v >= 48 && v <= 84)));
        // bar 1 always starts with a note, and a home ending ends on the home note
        assert.ok(Number.isInteger(s.tune[0]));
        const last = s.tune.slice(7 * METERS[meter].steps).find(Number.isInteger);
        if (chordDef(key.mode, s.bars[7]).job === 'home') assert.equal(last % 12, key.tonic);
      }
    }
  }
});

test('some help writes only bars 1 and 5', () => {
  const s = songIn('3/4', { tonic: 7, mode: 'major' });
  const t = startTune(s, { shape: 'climb', rhythm: 'busy', seed: 2 });
  const st = METERS['3/4'].steps;
  t.forEach((v, i) => {
    const bar = Math.floor(i / st);
    if (bar !== 0 && bar !== 4) assert.ok(v === null || (v === 'z' && i % st === 0), `step ${i}`);
  });
  assert.ok(t.slice(0, st).some(Number.isInteger));
  assert.ok(t.slice(4 * st, 5 * st).some(Number.isInteger));
});

test('changing timing keeps the notes in their bars', () => {
  const s = songIn('4/4', { tonic: 0, mode: 'major' });
  s.tune = makeTune(s, { seed: 5 });
  const t = convertTune(s.tune, '4/4', '6/8');
  assert.equal(t.length, tuneLength('6/8'));
  for (let b = 0; b < BARS; b += 1) assert.equal(t[b * 6], s.tune[b * 8], `bar ${b + 1} keeps its first note`);
  assert.deepEqual(convertTune(t, '6/8', '3/4'), t);
});

test('switching to minor moves the tune and chords by job', () => {
  const s = songIn('4/4', { tonic: 0, mode: 'major' }, 1);
  s.tune = makeTune(s, { seed: 2 });
  const minor = { tonic: 9, mode: 'minor' };
  const t = moveTune(s.tune, s.key, minor);
  assert.ok(t.filter(Number.isInteger).every((n) => [9, 11, 0, 2, 4, 5, 7].includes(n % 12)));
  assert.deepEqual(swapBars(['I', 'vi', 'IV', 'V'], 'major', 'minor', 0), ['i', 'VI', 'iv', 'V']);
  assert.deepEqual(swapBars(['i', 'VII', 'VI', 'V'], 'minor', 'major', 0), ['I', 'I', 'vi', 'V']); // ♭VII needs little help
  assert.deepEqual(swapBars(['i', 'VII', 'VI', 'V'], 'minor', 'major', 2), ['I', '♭VII', 'vi', 'V']);
});

test('a song read back is tidied', () => {
  assert.equal(cleanSong(null), null);
  const s = cleanSong({ key: { tonic: 99, mode: 'lydian' }, meter: '5/4', bars: ['X'], tune: 'no', bpm: 999, name: '  A very very very very long song name indeed  ', help: 7 });
  assert.deepEqual(s.key, { tonic: 0, mode: 'major' });
  assert.equal(s.meter, '4/4');
  assert.equal(s.bars.length, 8);
  assert.equal(s.tune.length, 64);
  assert.equal(s.bpm, METERS['4/4'].max);
  assert.ok(s.name.length <= 28);
  assert.equal(s.help, 0);
  const good = songIn('6/8', { tonic: 2, mode: 'minor' }, 2);
  good.tune = makeTune(good, { seed: 9 });
  good.name = 'Sea song';
  assert.deepEqual(cleanSong(JSON.parse(JSON.stringify(good))), good);
  assert.equal(freeSongSlot([good, null, null]), 1);
  assert.equal(freeSongSlot([good, good]), -1);
});

test('the song plays both passes, with drums and the second time changed', () => {
  for (const meter of METER_IDS) {
    const s = songIn(meter, { tonic: 4, mode: 'minor' });
    s.tune = makeTune(s, { seed: 1 });
    s.drums = 'second';
    s.second = 'high';
    const ev = songEvents(s);
    const loop = loopSeconds(meter, s.bpm);
    assert.ok(ev.every((e) => e.t >= 0 && e.t < loop + 0.01), meter);
    const drums = ev.filter((e) => e.drum);
    assert.ok(drums.length > 0 && drums.every((e) => e.t >= loop / 2 - 0.01), 'drums only the second time');
    const tune1 = ev.filter((e) => e.voice === 'piano' && e.v === 0.2 && e.t < loop / 2);
    const tune2 = ev.filter((e) => e.voice === 'piano' && e.v === 0.2 && e.t >= loop / 2);
    assert.equal(tune1.length, tune2.length);
    assert.equal(tune2[0].m - tune1[0].m, 12);
    for (const g of ['steady', 'bouncy', 'rolling']) { s.groove = g; assert.ok(songEvents(s).length > 0); }
  }
});

test('the desk says something about any chords and tune', () => {
  for (const mode of ['major', 'minor']) for (const p of PATHS[mode]) {
    const s = songIn('4/4', { tonic: 0, mode: mode }, PATHS[mode].indexOf(p));
    assert.ok(hearChords(s).length >= 3);
    assert.match(hearTune(s)[0], /No notes yet/);
    s.tune = makeTune(s, { seed: 4 });
    assert.ok(hearTune(s).length >= 3);
  }
  // the little-help grid has every note; the others only the key's
  const s = songIn('4/4', { tonic: 0, mode: 'major' });
  assert.equal(gridRows(s, 2).length, 22);
  assert.ok(gridRows(s, 0).every((m) => [0, 2, 4, 5, 7, 9, 11].includes(m % 12)));
  assert.equal(CHORDS.major[0].rn, 'I');
});
