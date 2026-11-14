// A desk song as sheet music (js/composesheet.js): spelled for the key, every bar the right
// length, and the notes read back are the notes the kid wrote.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newSong, makeTune, PATHS, METERS, METER_IDS, tuneLength, BARS } from '../js/composerules.js';
import { deskSongAbc, spell, keySignature, abcKey, pieces, tuneBars, sheetChords } from '../js/composesheet.js';

const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ALTER = { '^^': 2, '^': 1, '=': 0, '_': -1, '__': -2 };
const SIG_OF = (key) => keySignature(key);

/** Read one voice's bars back: [[{ midi|null, len, tie }]], with the key's and the bar's accidentals. */
function readVoice(abc, voice, key) {
  const sig = SIG_OF(key);
  const lines = abc.split('\n').filter((l) => l.startsWith(`[V:${voice}]`)).map((l) => l.slice(5));
  const bars = lines.join(' | ').replace(/\|:|:\|/g, '').split('|').map((b) => b.trim()).filter(Boolean);
  return bars.map((bar) => {
    const held = new Map();
    const out = [];
    const re = /"[^"]*"|\[([^\]]*)\](\d*)|(\^\^|\^|__|_|=)?([A-Ga-gz])([,']*)(\d*)(-?)/g;
    let m;
    while ((m = re.exec(bar))) {
      if (m[0].startsWith('"')) continue;
      if (m[1] !== undefined) { out.push({ chord: true, len: Number(m[2] || 1) }); continue; }
      const [, , , acc, letter, marks, len, tie] = m;
      if (letter === 'z') { out.push({ midi: null, len: Number(len || 1) }); continue; }
      const li = LETTERS.indexOf(letter.toUpperCase());
      let octave = letter === letter.toUpperCase() ? 4 : 5;
      for (const c of marks) octave += c === "'" ? 1 : -1;
      const spot = `${li}${octave}`;
      if (acc) held.set(spot, ALTER[acc]);
      const alter = held.has(spot) ? held.get(spot) : sig[li];
      out.push({ midi: (octave + 1) * 12 + NATURAL[li] + alter, len: Number(len || 1), tie: tie === '-' });
    }
    return out;
  });
}

const songIn = (meter, key, path = 0) => {
  const s = newSong(2);
  Object.assign(s, { meter, key, bars: PATHS[key.mode][path].bars.slice(), bpm: METERS[meter].bpm, tune: Array(tuneLength(meter)).fill(null) });
  return s;
};

test('notes are spelled by scale step, and keys have the right signatures', () => {
  const C = { tonic: 0, mode: 'major' };
  assert.deepEqual(spell(C, 10), { li: 6, alter: -1 }, 'B♭ in C major');
  assert.deepEqual(spell(C, 6), { li: 3, alter: 1 }, 'F♯ in C major');
  assert.deepEqual(spell({ tonic: 2, mode: 'minor' }, 1), { li: 0, alter: 1 }, 'C♯ in D minor');
  assert.deepEqual(spell({ tonic: 6, mode: 'major' }, 5), { li: 2, alter: 1 }, 'E♯ in F♯ major');
  assert.deepEqual(keySignature({ tonic: 9, mode: 'minor' }), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(keySignature({ tonic: 10, mode: 'major' }), [0, 0, -1, 0, 0, 0, -1]);
  assert.equal(abcKey({ tonic: 10, mode: 'major' }), 'Bb');
  assert.equal(abcKey({ tonic: 6, mode: 'minor' }), 'F#m');
  // every key's signature is all sharps or all flats
  for (let t = 0; t < 12; t += 1) for (const mode of ['major', 'minor']) {
    const sig = keySignature({ tonic: t, mode });
    assert.ok(!(sig.includes(1) && sig.includes(-1)), `${t} ${mode}`);
  }
});

test('held notes are cut into lengths that show the beats', () => {
  assert.deepEqual(pieces('4/4', 0, 8), [8]);
  assert.deepEqual(pieces('4/4', 3, 2), [1, 1]);
  assert.deepEqual(pieces('4/4', 2, 4), [2, 2]);
  assert.deepEqual(pieces('3/4', 0, 6), [6]);
  assert.deepEqual(pieces('3/4', 1, 5), [1, 4]);
  assert.deepEqual(pieces('6/8', 2, 2), [1, 1]);
  assert.deepEqual(pieces('6/8', 0, 5), [3, 2]);
  for (const meter of METER_IDS) {
    const st = METERS[meter].steps;
    for (let pos = 0; pos < st; pos += 1) for (let len = 1; pos + len <= st; len += 1) {
      assert.equal(pieces(meter, pos, len).reduce((a, b) => a + b, 0), len);
    }
  }
});

test('the sheet plays back the very notes on the desk, in every key and timing', () => {
  let seed = 3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (const meter of METER_IDS) for (let tonic = 0; tonic < 12; tonic += 1) for (const mode of ['major', 'minor']) {
    const key = { tonic, mode };
    const st = METERS[meter].steps;
    for (const kind of ['made', 'random']) {
      const s = songIn(meter, key, tonic % 3);
      s.tune = kind === 'made' ? makeTune(s, { seed: tonic + 1 }) : s.tune.map(() => { const x = rnd(); return x < 0.45 ? null : x < 0.55 ? 'z' : 48 + Math.floor(rnd() * 37); });
      for (const perLine of [2, 4]) {
        const abc = deskSongAbc(s, { by: 'Ava', perLine });
        const right = readVoice(abc, 'R', key);
        const left = readVoice(abc, 'L', key);
        assert.equal(right.length, BARS);
        assert.equal(left.length, BARS);
        // each bar is a whole bar long, in both hands
        right.forEach((b, i) => assert.equal(b.reduce((a, e) => a + e.len, 0), st, `${meter} ${tonic} ${mode} RH bar ${i + 1}`));
        left.forEach((b, i) => assert.equal(b.reduce((a, e) => a + e.len, 0), st, `${meter} ${tonic} ${mode} LH bar ${i + 1}`));
        // the notes and where they start come back as written
        const back = [];
        let tied = false;
        for (const e of right.flat()) {
          back.push(e.midi === null ? 'z' : tied ? null : e.midi);
          for (let k = 1; k < e.len; k += 1) back.push(null);
          tied = e.tie;
        }
        const want = [];
        let started = false;
        for (const v of s.tune) {
          if (Number.isInteger(v)) started = true;
          want.push(Number.isInteger(v) ? v : v === 'z' || !started ? 'rest' : null);
        }
        // a rest's own steps can come back as several rests: compare what sounds at each step
        const sound = (arr) => { let cur = 'z'; return arr.map((v) => { if (v !== null) cur = v === 'rest' ? 'z' : v; return cur; }); };
        const onsets = (arr) => arr.map((v, i) => (Number.isInteger(v) ? i : -1)).filter((i) => i >= 0);
        assert.deepEqual(sound(back), sound(want), `${meter} ${tonic} ${mode} ${kind}`);
        assert.deepEqual(onsets(back), onsets(want), `${meter} ${tonic} ${mode} ${kind} onsets`);
      }
    }
  }
});

test('the sheet has the name, composer, timing, speed, repeats and chord names', () => {
  const s = songIn('3/4', { tonic: 7, mode: 'major' });
  s.tune = makeTune(s, { seed: 2 });
  s.name = 'Sea\nsong %1';
  s.bpm = 100;
  const abc = deskSongAbc(s, { by: 'Ava' });
  assert.match(abc, /^T:Sea song 1$/m);
  assert.match(abc, /^T:G major · 3\/4$/m);
  assert.match(abc, /^C:Music by Ava$/m);
  assert.match(abc, /^M:3\/4$/m);
  assert.match(abc, /^Q:1\/4=100$/m);
  assert.match(abc, /^K:G$/m);
  assert.match(abc, /^\[V:R\] \|: "G"/m);
  assert.match(abc, /:\|$/m);
  assert.equal((abc.match(/"[^"]+"/g) || []).length, BARS);
  assert.doesNotMatch(deskSongAbc(s), /^C:/m);
  assert.match(deskSongAbc({ ...s, meter: '6/8', tune: Array(48).fill(null) }), /^Q:3\/8=100$/m);
  assert.deepEqual(sheetChords(s).map((c) => c.name), PATHS.major[0].bars.map((rn, i) => sheetChords(s)[i].name));
  assert.equal(sheetChords(s)[0].job, 'home');
  // an empty tune is eight bars of rests
  const empty = songIn('4/4', { tonic: 0, mode: 'major' });
  assert.equal(tuneBars(empty).flat().filter((e) => e.midi !== null).length, 0);
  assert.equal(readVoice(deskSongAbc(empty), 'R', empty.key).flat().every((e) => e.midi === null), true);
});
