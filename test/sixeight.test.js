// Songs in 6/8 (songs.js: beat 6 with meter '6/8'): two beats of three eighths. The sheet
// music writes them in 6/8 (notes and rests never hide the second beat, eighths beamed in
// threes, the speed in dotted quarters), two chords can share a bar, the piano versions are
// checked against the same beats, and the game plays them at the same speed as it always
// has: an eighth lasts 30 / bpm seconds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, barChords, songBeat, songTempo } from '../js/songs.js';
import { meterOf, splitLength, songAbc, songById, difficulty, SONGBOOK } from '../js/sheetmusic.js';
import { arrangementAbc, arrangementNotes } from '../js/arrange.js';
import { printAbc } from '../js/printsheets.js';
import { sourceOf } from '../js/studiorules.js';
import { checkArrangement, easyDensity } from './helpers/arrangement-check.mjs';
import { fakeAudio } from './helpers/fake-audio.mjs';

const { FakeAudioContext, played, contexts } = fakeAudio();
globalThis.window = { AudioContext: FakeAudioContext };
const { playPiece, stepChords } = await import('../js/music.js');

// a little jig for these tests only (each test file has its own copy of the songs)
const R = 0;
const F = 2;
const ID = 'x-jig';
SONGS[ID] = {
  name: 'Test Jig', key: 'D', bpm: 114, beat: 6, meter: '6/8',
  lead: ['D5 - F#5 A5 - F#5', 'G5 - - E5 - -', 'F#5 - - - A5 -', '. . A4 - - .', 'B4 C#5 D5 E5 F#5 G5', 'D5 - - - - -'],
  chords: ['D', 'G A', 'D', 'A', 'G A', 'D'],
  bass: [[R, 2, 2.8], null, null, [F, 2, 2.8], null, null],
  drums: [['k.....', '......', 'h..h..']],
};
const MEDIUM = {
  rh: ['[Fd]2 f [fa]2 f', '[Bg]3 [ce]3', 'f3- f [fa]2', 'z2 A- A2 z', 'Bcd efg', '[FAd]6'],
  lh: ['D,A,F, A,F,A,', 'G,,D,B,, A,,E,C,', 'D,A,F, A,F,A,', 'A,,E,C, E,C,E,', 'G,,D,B,, A,,E,C,', '[D,A,]6'],
};

test('a 6/8 song: six steps a bar in two beats of three; the songbook has none of its own yet', () => {
  const jig = meterOf(SONGS[ID]);
  assert.deepEqual(jig, { steps: 6, meter: '6/8', beat: 3, middle: 3 });
  assert.equal(songBeat(SONGS[ID]), 3);
  // six steps without meter: '6/8' are still a waltz, and eight are 4/4
  assert.deepEqual(meterOf({ beat: 6 }), { steps: 6, meter: '3/4', beat: 2, middle: null });
  assert.deepEqual(meterOf({}), { steps: 8, meter: '4/4', beat: 2, middle: 4 });
  assert.equal(songBeat({ beat: 6 }), 2);
  assert.throws(() => meterOf({ beat: 8, meter: '6/8' }), /six steps a bar/);
  for (const p of SONGBOOK) assert.notEqual(meterOf(songById(p.id)).meter, '6/8', p.name);
});

test('the speed on the page: dotted quarters in 6/8, quarters otherwise', () => {
  assert.deepEqual(songTempo(SONGS[ID]), { unit: '3/8', bpm: 76 });
  assert.deepEqual(songTempo({ bpm: 100, beat: 6 }), { unit: '1/4', bpm: 100 });
  assert.deepEqual(songTempo({ bpm: 132 }), { unit: '1/4', bpm: 132 });
  assert.match(printAbc({ id: ID, level: 'easy', name: 'Test Jig', kind: 'map' }), /^Q:3\/8=76$/m);
  assert.match(printAbc({ id: 'bg-ocean', level: 'easy', name: 'Bubble Waltz', kind: 'map' }), /^Q:1\/4=100$/m);
});

test('notes and rests in 6/8 never hide the second beat', () => {
  const jig = meterOf(SONGS[ID]);
  assert.deepEqual(splitLength(0, 6, jig), [6], 'a note that fills the bar');
  assert.deepEqual(splitLength(0, 3, jig), [3], 'a beat');
  assert.deepEqual(splitLength(3, 3, jig), [3]);
  assert.deepEqual(splitLength(0, 2, jig), [2]);
  assert.deepEqual(splitLength(1, 2, jig), [2], 'short, long inside a beat stays one note');
  assert.deepEqual(splitLength(0, 4, jig), [3, 1], 'from the first beat over the middle: tied');
  assert.deepEqual(splitLength(0, 5, jig), [3, 2]);
  assert.deepEqual(splitLength(2, 2, jig), [1, 1]);
  assert.deepEqual(splitLength(2, 3, jig), [1, 2]);
  assert.deepEqual(splitLength(1, 5, jig), [2, 3]);
  // rests
  assert.deepEqual(splitLength(0, 6, jig, true), [6], 'a whole bar of rest');
  assert.deepEqual(splitLength(0, 3, jig, true), [3]);
  assert.deepEqual(splitLength(0, 2, jig, true), [2]);
  assert.deepEqual(splitLength(1, 2, jig, true), [2]);
  assert.deepEqual(splitLength(2, 4, jig, true), [1, 3]);
  assert.deepEqual(splitLength(0, 5, jig, true), [3, 2]);
  // the other meters split as they always have
  const four = meterOf({});
  const waltz = meterOf({ beat: 6 });
  assert.deepEqual(splitLength(2, 4, four), [4]);
  assert.deepEqual(splitLength(3, 5, four), [1, 4]);
  assert.deepEqual(splitLength(0, 6, four, true), [4, 2]);
  assert.deepEqual(splitLength(1, 7, four, true), [1, 2, 4]);
  assert.deepEqual(splitLength(0, 4, waltz), [4], 'a half note in a waltz');
  assert.deepEqual(splitLength(2, 4, waltz, true), [2, 2]);
  assert.deepEqual(splitLength(0, 6, waltz, true), [6]);
});

test('two chords share a 6/8 bar, a beat each; three can\'t', () => {
  assert.deepEqual(barChords('G A', 6, 3), [{ name: 'G', pos: 0, len: 3 }, { name: 'A', pos: 3, len: 3 }]);
  assert.throws(() => barChords('G A D', 6, 3), /can't share a bar of 2 beats/);
  assert.throws(() => barChords('G A', 6), /can't share a bar of 3 beats/, 'a waltz bar still can\'t be halved');
  const G = [7, 11, 14];
  const A = [9, 13, 16];
  assert.deepEqual(stepChords('G A', 6, 3), [G, G, G, A, A, A]);
  assert.throws(() => stepChords('G A', 6), /can't share/);
});

test('the easy sheet in 6/8: the meter, eighths beamed in threes, ties over the middle, both chord names', () => {
  const abc = songAbc(ID, { hands: 'melody', perLine: 3 });
  assert.match(abc, /^M:6\/8$/m);
  assert.match(abc, /^K:D$/m);
  const bars = abc.split('\n').slice(4).join(' ').split('|').map((b) => b.trim());
  assert.deepEqual(bars.slice(0, 6), ['"D"d2 f a2 f', '"G"g3 "A"e3', '"D"f3- f a2', '"A"z2 A- A2 z', '"G"Bcd "A"efg', '"D"d6']);
  // with the left hand: a chord held for its beat, or for the bar
  const both = songAbc(ID, { hands: 'chords', perLine: 3, names: true });
  const left = both.split('\n').filter((l) => l.startsWith('[V:L]')).join(' ');
  assert.ok(left.includes('[D,F,A,]6 | [G,,B,,D,]3 [A,,C,E,]3 | [D,F,A,]6'), left);
  assert.ok(both.includes('w: D F♯ A F♯ | G E | F♯ * A'));
  assert.ok(songAbc(ID, { hands: 'roots' }).includes('G,,3 A,,3'));
  // a plain beat (a dotted quarter) isn't a tricky rhythm in 6/8
  const plain = { ...SONGS[ID], lead: Array(6).fill('D5 - - A5 - -'), chords: Array(6).fill('D') };
  const dotted = { ...plain, meter: undefined };
  assert.ok(difficulty(plain) < difficulty(dotted), 'the same notes count as dotted rhythms in a waltz');
});

test('a piano version in 6/8 is checked on its two beats and written in 6/8', () => {
  const r = checkArrangement(ID, 'medium', MEDIUM, easyDensity(ID));
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.melodyKept, 100);
  assert.equal(r.stats.chordTones, 100, 'each half of a shared bar on its own chord');
  // nothing starting on the second beat of a shared bar, where the second chord's name sits, is turned down
  const late = { rh: MEDIUM.rh.map((b, k) => (k === 1 ? '[Bg]4 [ce]2' : b)), lh: MEDIUM.lh };
  assert.match(checkArrangement(ID, 'medium', late).errors.join('\n'), /bar 2: nothing starts on eighth 4, where the A chord starts/);
  // a bar must be six eighths long
  const long = { rh: MEDIUM.rh.map((b, k) => (k === 5 ? '[FAd]8' : b)), lh: MEDIUM.lh };
  assert.match(checkArrangement(ID, 'medium', long).errors.join('\n'), /bar 6: 8 eighths, needs 6/);
  const abc = arrangementAbc(ID, 'medium', { perLine: 3 }, MEDIUM);
  assert.match(abc, /^M:6\/8$/m);
  assert.ok(abc.includes('"G"[Bg]3 "A"[ce]3'), 'the second chord name on the second beat');
  const notes = arrangementNotes(ID, 'medium', MEDIUM);
  assert.equal(Math.max(...notes.map((n) => n.start + n.len)), 36, 'six bars of six eighths');
});

test('the game plays a 6/8 song an eighth at a time, the chords changing on the second beat', async () => {
  for (const c of contexts) c.currentTime = 0;
  played.length = 0;
  const h = playPiece(ID);
  assert.equal(h.beat, 6);
  assert.ok(Math.abs(h.step - 30 / 114) < 1e-12, 'an eighth lasts 30 / bpm seconds');
  contexts[0].currentTime = 1e6;
  await new Promise((resolve) => { setTimeout(resolve, 150); });
  h.stop();
  const at = (n) => Math.round((n.t - 0.15) / h.step);
  const notes = played.filter((n) => !n.noise && !n.swept).map((n) => ({ midi: n.midi, step: at(n) }));
  // the tune's first bar: D5 F#5 A5 F#5 on eighths 1, 3, 4 and 6
  assert.deepEqual(notes.filter((n) => n.midi >= 62 && n.step < 6).map((n) => [n.step, n.midi]), [[0, 74], [2, 78], [3, 81], [5, 78]]);
  // the bass: the root on the first beat, the fifth on the second. In bar 2 (G, then A) that
  // is G, then the fifth of A
  const bass = (step) => Math.min(...notes.filter((n) => n.step === step).map((n) => n.midi));
  assert.deepEqual([0, 3, 6, 9].map(bass), [38, 45, 43, 52]);
  // a kick on each bar's first eighth, hats on both beats
  const kicks = played.filter((n) => n.swept).map(at);
  assert.deepEqual(kicks, [0, 6, 12, 18, 24, 30]);
  assert.deepEqual(played.filter((n) => n.noise).map(at).slice(0, 4), [0, 3, 6, 9]);
});

test('the recording studio counts a 6/8 song in three, at the same speed', () => {
  const src = sourceOf(ID);
  assert.deepEqual([src.bpm, src.meter, src.beats], [114, 3, 18]);
});
