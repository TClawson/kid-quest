import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAbcBar, arrangementNotes, arrangementAbc, hasLevel, LEVELS } from '../js/arrange.js';
import { ARRANGEMENTS } from '../js/arrangements.js';
import { SONGBOOK, signature, songById, SWING_MARK } from '../js/sheetmusic.js';
import { swingAt, stepChords } from '../js/music.js';
import { checkArrangement, easyDensity } from './helpers/arrangement-check.mjs';

const C = signature('C');
const F = signature('F');
const midis = (r) => r.events.map((e) => e.notes.map((n) => n.midi));

// ---------- reading a bar ----------

test('a bar of ABC: notes, octaves, lengths, chords, rests and ties', () => {
  const r = readAbcBar('C, C c c\' z2 [CEG]2', C);
  assert.deepEqual(midis(r), [[48], [60], [72], [84], [], [60, 64, 67]]);
  assert.deepEqual(r.events.map((e) => e.len), [1, 1, 1, 1, 2, 2]);
  assert.equal(r.length, 8);
  assert.deepEqual(readAbcBar('c3/2 d/2 e/ f// g4', C).events.map((e) => e.len), [1.5, 0.5, 0.5, 0.25, 4]);
  const t = readAbcBar('c4- c2 d2-', C);
  assert.deepEqual(t.events.map((e) => e.tie), [true, false, true]);
  assert.deepEqual(readAbcBar('!p! (c2 d2) .e2 "x"f2', C).events.map((e) => e.len), [2, 2, 2, 2], 'slurs, dynamics, staccato and annotations are skipped');
  assert.equal(readAbcBar('  !mf! z8', C).first, 7, 'where the music starts (for the chord name)');
});

test('accidentals: the key signature, and accidentals held for the bar in their own octave', () => {
  assert.deepEqual(midis(readAbcBar('B b', F)), [[70], [82]], 'B flat from the key');
  assert.deepEqual(midis(readAbcBar('=B B b', F)), [[71], [71], [82]], 'a natural holds, in its octave only');
  assert.deepEqual(midis(readAbcBar('^F F [F^c] c', C)), [[66], [66], [66, 73], [73]]);
  assert.deepEqual(midis(readAbcBar('^^F __B', C)), [[67], [69]]);
});

test('what a bar can\'t have is reported', () => {
  assert.match(readAbcBar('(3cde c6', C).errors.join(), /triplets/);
  assert.match(readAbcBar('c>d c6', C).errors.join(), /broken rhythm/);
  assert.match(readAbcBar('[c2e2] c6', C).errors.join(), /own length/);
  assert.match(readAbcBar('c q', C).errors.join(), /can't read/);
});

// ---------- the versions ----------

test('ties join into one note to play, across the bar line too', () => {
  const notes = arrangementNotes('x', 'medium', null);
  assert.deepEqual(notes, [], 'no version, nothing to play');
  const id = Object.keys(ARRANGEMENTS)[0];
  const song = songById(id);
  const steps = song.beat || 8;
  const version = { rh: song.lead.map((_, b) => (b === 0 ? 'c4 c4-' : b === 1 ? `c2 z${steps - 2}` : `z${steps}`)), lh: song.lead.map(() => `C,${steps}`) };
  const rh = arrangementNotes(id, 'medium', version).filter((n) => n.hand === 'rh');
  assert.deepEqual(rh.map((n) => [n.start, n.len]), [[0, 4], [4, 6]]);
});

for (const [id, versions] of Object.entries(ARRANGEMENTS)) {
  const name = songById(id)?.name || id;
  test(`${name}: the medium and hard versions follow the rules, and each is harder than the last`, () => {
    assert.ok(SONGBOOK.some((p) => p.id === id), `${id} is in the songbook`);
    let lower = easyDensity(id);
    for (const level of ['medium', 'hard']) {
      assert.ok(versions[level], `${level} is written`);
      const r = checkArrangement(id, level, versions[level], lower);
      assert.deepEqual(r.errors, [], `${level}:\n${r.errors.join('\n')}`);
      lower = r.stats.density;
      const abc = arrangementAbc(id, level, { names: true, perLine: 4 });
      const barsIn = (voice) => abc.split('\n').filter((l) => l.startsWith(`[V:${voice}]`)).join(' ').split('|').length - 1;
      assert.deepEqual([barsIn('R'), barsIn('L')], [songById(id).lead.length, songById(id).lead.length], 'every bar in both hands');
      assert.match(abc, new RegExp(`^K:${songById(id).key}$`, 'm'));
      assert.equal(abc.split('\n').includes(SWING_MARK), Boolean(songById(id).swing), 'Swing is written when the game swings the song');
    }
  });
}

test('two chords in one bar: each has its name on the page, and the left hand follows both', () => {
  // Phoenix Fire bar 4 (F, then E) and Dragon King Fanfare bar 2 (F, then B flat)
  for (const [id, bar, names, tones] of [['show:bg-volcano', 3, ['"F"', '"E"'], [[5, 9, 0], [4, 8, 11]]], ['show:bg-castle', 1, ['"F"', '"B♭"'], [[5, 9, 0], [10, 2, 5]]]]) {
    for (const level of ['medium', 'hard']) {
      const abc = arrangementAbc(id, level, { perLine: 8 });
      const right = abc.split('\n').find((l) => l.startsWith('[V:R]')).split('|')[bar];
      assert.deepEqual(right.match(/"[^"]+"/g), names, `${id} ${level}: ${right}`);
      // the second name sits on the note that starts the second half of the bar
      const half = readAbcBar(right.slice(0, right.indexOf(names[1])), signature(songById(id).key));
      assert.equal(half.length, 4, `${id} ${level}: the second chord's name is on beat 3`);
      // and the left hand's notes belong to the chord of their half
      for (const n of arrangementNotes(id, level).filter((x) => x.hand === 'lh' && Math.floor(x.start / 8) === bar)) {
        assert.ok(tones[Math.floor((n.start % 8) / 4)].includes(n.midi % 12), `${id} ${level}: left-hand note ${n.midi} at eighth ${(n.start % 8) + 1}`);
      }
    }
  }
  // a version with nothing starting where the second chord starts is turned down
  const version = { rh: [...ARRANGEMENTS['show:bg-volcano'].medium.rh], lh: ARRANGEMENTS['show:bg-volcano'].medium.lh };
  version.rh[3] = '[FAc]2 B6';
  assert.match(checkArrangement('show:bg-volcano', 'medium', version).errors.join('\n'), /bar 4: nothing starts on eighth 5, where the E chord starts/);
});

test('the game plays both chords of a shared bar, each for its half', () => {
  const F = [5, 9, 12];
  const E = [4, 8, 11];
  assert.deepEqual(stepChords('F', 8), Array(8).fill(F));
  assert.deepEqual(stepChords('F E', 8), [F, F, F, F, E, E, E, E]);
  assert.deepEqual(stepChords('F E', 6), [F, F, F, E, E, E]);
});

test('levels: easy always, medium and hard where written', () => {
  assert.deepEqual(LEVELS, ['easy', 'medium', 'hard']);
  assert.ok(SONGBOOK.every((p) => hasLevel(p.id, 'easy')));
  for (const id of Object.keys(ARRANGEMENTS)) assert.ok(hasLevel(id, 'medium') && hasLevel(id, 'hard'));
});

test('swing: every second eighth comes late, and the beats stay put', () => {
  assert.equal(swingAt(3.5, 0), 3.5, 'no swing leaves the music alone');
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is ${b}`);
  close(swingAt(0, 0.25), 0);
  close(swingAt(1, 0.25), 1.25); // the off eighth, as the game plays it
  close(swingAt(2, 0.25), 2);
  close(swingAt(7, 0.25), 7.25);
  close(swingAt(0.5, 0.25), 0.625); // sixteenths share out the long and the short eighth
  close(swingAt(1.5, 0.25), 1.625);
  // a note keeps its place between its neighbours, and a bar keeps its length
  for (let x = 0; x < 8; x += 0.25) assert.ok(swingAt(x + 0.25, 0.28) > swingAt(x, 0.28));
  close(swingAt(8, 0.28), 8);
});
