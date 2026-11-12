// The songbook's concert pieces (js/concert.js, js/longpieces.js): two voices in a hand,
// every bar of every level written so far whole and playable, opened by the upright piano,
// bought like any piece, and played with each part at its own speed and held bars held.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeAudio } from './helpers/fake-audio.mjs';
import { readAbcBar, LEVELS } from '../js/arrange.js';
import { signature, SONGBOOK, songbookFor, songBuyCheck, buySong, songsBought, songItemId, SONG_PRICE } from '../js/sheetmusic.js';
import { LONG_PIECES } from '../js/longpieces.js';
import {
  CONCERT, CONCERT_TIER, BAR, FERMATA_HOLD, DYNAMICS, concertBookFor, isLongPiece, longLevels, longLevel, longSections,
  longBars, longNotes, longTimeline, longAbc, longFacts, longChordLabel, longLeadSheet, cancels,
} from '../js/concert.js';
import { shelfSongs } from '../js/studiorules.js';
import { itemById } from '../js/items.js';

// the piano voice plays through the browser's AudioContext: give it one that writes the notes down
const { FakeAudioContext, played, contexts } = fakeAudio();
globalThis.window = { AudioContext: FakeAudioContext };
const { playTimeline, playNotes, barAt } = await import('../js/music.js');

const C = signature('C');
const F = signature('F');
const midis = (r) => r.events.map((e) => e.notes.map((n) => n.midi));
const close = (a, b, what = '') => assert.ok(Math.abs(a - b) < 1e-9, `${what} ${a} is ${b}`);

// ---------- reading two voices ----------

test('two voices in a hand: & starts the next voice from the start of the bar', () => {
  const r = readAbcBar('d4 de & B2 A2 B2', C);
  assert.deepEqual(r.events.map((e) => [e.voice, e.start, e.len]), [[0, 0, 4], [0, 4, 1], [0, 5, 1], [1, 0, 2], [1, 2, 2], [1, 4, 2]]);
  assert.deepEqual(r.lengths, [6, 6]);
  assert.equal(r.length, 6);
  assert.deepEqual(r.errors, []);
  // one voice is as it always was
  const one = readAbcBar('c4 d2', C);
  assert.deepEqual(one.lengths, [6]);
  assert.ok(one.events.every((e) => e.voice === 0 && !e.hidden));
  // a voice too short shows in lengths
  assert.deepEqual(readAbcBar('c6 & C4', C).lengths, [6, 4]);
});

test('x is a rest that isn\'t printed', () => {
  const r = readAbcBar('G,,6 & x2 [D,G,]2 [D,G,]2', C);
  assert.deepEqual(midis(r), [[43], [], [50, 55], [50, 55]]);
  assert.deepEqual(r.events.map((e) => Boolean(e.hidden)), [false, true, false, false]);
  assert.deepEqual(r.lengths, [6, 6]);
  assert.equal(readAbcBar('z6', C).events[0].hidden, undefined, 'z is a rest that is printed');
});

test('accidentals don\'t carry from one voice to the other', () => {
  assert.deepEqual(midis(readAbcBar('^F4 F2 & F6', C)), [[66], [66], [65]]);
  assert.deepEqual(midis(readAbcBar('B6 & =B6', F)), [[70], [71]], 'the key signature still holds in each voice');
});

const piece = (sections) => sections.map((s) => ({ name: 'Part', key: 'C', bpm: 60, ...s }));

test('ties are taken up by the same note where the tied note ends, in either voice and bar', () => {
  const sections = piece([{
    rh: ['c4 c2- & E6', 'c6 & z6', 'G2- z4 & z2 G4'],
    lh: ['C,6', 'C,6', 'C,6'],
    chords: ['C', 'C', 'C'],
  }]);
  const rh = longNotes('x', 'hard', sections).filter((n) => n.hand === 'rh');
  // c2- ties into the next bar's c6; G2- in voice 1 is taken up by voice 2's G4
  assert.deepEqual(rh.map((n) => [n.midi, n.start, n.len]), [[64, 0, 6], [72, 0, 4], [72, 4, 8], [67, 12, 6]]);
  // a tie with nothing to take it up just ends
  const lone = piece([{ rh: ['c6-', 'd6'], lh: ['C,6', 'C,6'], chords: ['C', 'C'] }]);
  assert.deepEqual(longNotes('x', 'hard', lone).filter((n) => n.hand === 'rh').map((n) => [n.midi, n.len]), [[72, 6], [74, 6]]);
});

// ---------- the music written so far ----------

for (const [id, p] of Object.entries(LONG_PIECES)) {
  test(`${p.name}: every bar of every level is whole, reads cleanly and stays on the piano`, () => {
    assert.ok(isLongPiece(id) && id.startsWith('long:'));
    assert.ok(itemById(p.map), `${p.map} is a map`);
    assert.ok(p.name && p.story && !/—/.test(p.story + p.name), 'a name and a story, no long dashes');
    const levels = longLevels(id);
    assert.ok(levels.length >= 1, 'at least one level written');
    assert.deepEqual(levels, LEVELS.filter((l) => p.levels[l]), 'only the levels written');
    const names = longSections(id, levels[0]).map((s) => s.name);
    for (const level of levels) {
      const sections = longSections(id, level);
      assert.deepEqual(sections.map((s) => s.name), names, `${level}: the same parts, in the same order`);
      for (const s of sections) {
        const sig = signature(s.key);
        assert.ok(s.bpm >= 40 && s.bpm <= 200, `${level} ${s.name}: speed ${s.bpm}`);
        assert.equal(s.lh.length, s.rh.length, `${level} ${s.name}: both hands`);
        assert.equal(s.chords.length, s.rh.length, `${level} ${s.name}: a chord a bar`);
        for (const c of s.chords) assert.match(c, /^[A-G][#b]?(m|dim|aug)?\d*(\/[A-G][#b]?)?$/, `${level} ${s.name}: chord ${c}`);
        for (const hand of ['rh', 'lh']) {
          s[hand].forEach((text, b) => {
            const where = `${level} ${s.name} ${hand} bar ${b + 1} "${text}"`;
            const r = readAbcBar(text, sig);
            assert.deepEqual(r.errors, [], where);
            assert.ok(r.lengths.every((len) => Math.abs(len - BAR) < 1e-9), `${where}: ${r.lengths.join(' + ')} eighths`);
            for (const e of r.events) for (const n of e.notes) assert.ok(n.midi >= 21 && n.midi <= 108, `${where}: ${n.midi} is on the piano`);
          });
        }
      }
      // every note joined up and on the keys, and every bar has something in it
      const notes = longNotes(id, level);
      const bars = longBars(id, level).length;
      assert.ok(notes.every((n) => n.len > 0 && n.midi >= 21 && n.midi <= 108));
      assert.ok(notes.every((n) => n.start + n.len <= bars * BAR + 1e-9), 'no note runs past the end');
      assert.match(longFacts(id, level), /^\d+ parts · about \d+ min$/);
      // the score has every bar in both hands, the final bar line only at the end
      const abc = longAbc(id, level, { names: true, perLine: 4 });
      const barsIn = (voice) => abc.split('\n').filter((l) => l.startsWith(`[V:${voice}]`)).join(' ').split(/\|\]|\|\||\|/).length - 1;
      assert.deepEqual([barsIn('R'), barsIn('L')], [bars, bars], `${level}: every bar in both hands`);
      assert.equal(abc.split('|]').length - 1, 2, `${level}: the final bar line in each hand, once`);
      assert.ok(abc.trimEnd().endsWith('|]'));
      assert.equal((abc.match(/\[Q:"/g) || []).length, sections.length, `${level}: each part's name and speed`);
      for (const s of sections.slice(1)) assert.ok(abc.includes(`[K:${s.key}] [Q:"${s.name}" 1/4=${s.bpm}]`), `${level}: ${s.name} starts with its key and speed`);
      assert.equal((abc.match(/\[V:L\] \[K:/g) || []).length, sections.length - 1, 'the left hand changes key too');
      assert.ok(!/\[K:[^\]]*\]/.test(abc.split('\n').filter((l) => l.startsWith('[V:L]')).join('\n').replace(/\[K:[^\]]* clef=bass\]/g, '')), 'and keeps its bass clef');
    }
  });
}

test('the Bubble Waltz concert piece: eight parts, about three minutes at hard', () => {
  const id = 'long:bg-ocean';
  assert.equal(LONG_PIECES[id].map, 'bg-ocean');
  assert.ok(longLevels(id).includes('hard'));
  assert.equal(longSections(id, 'hard').length, 8);
  assert.equal(longBars(id, 'hard').length, 93);
  assert.equal(longFacts(id, 'hard'), '8 parts · about 3 min');
  const keys = new Set(longSections(id, 'hard').map((s) => s.key));
  assert.ok(keys.has('Dm') && keys.has('Fm') && keys.has('Gm'));
});

test('chord names: slash and seventh chords, flats and sharps as signs', () => {
  assert.equal(longChordLabel('Gm/Bb'), 'Gm/B♭');
  assert.equal(longChordLabel('Fm/Ab'), 'Fm/A♭');
  assert.equal(longChordLabel('D/F#'), 'D/F♯');
  assert.equal(longChordLabel('Eb/G'), 'E♭/G');
  assert.equal(longChordLabel('Bbm'), 'B♭m');
  assert.equal(longChordLabel('Cm6'), 'Cm6');
  assert.equal(longChordLabel('A7'), 'A7');
});

test('the score: names on the first voice, note names skip the second voice, naturals on a key change', () => {
  const sections = [
    { name: 'One', key: 'Gm', bpm: 90, rh: ['!p! D4 DE & B,6', 'G6'], lh: ['G,,6', 'G,,6'], chords: ['Gm', 'Eb/G'] },
    { name: 'Two', key: 'Dm', bpm: 100, rh: ['!fermata![FAd]6'], lh: ['D,6'], chords: ['Dm'] },
  ];
  const abc = longAbc('x', 'hard', { names: true, perLine: 4 }, sections);
  assert.ok(abc.includes('[V:R] [Q:"One" 1/4=90] !p! "Gm"D4 DE & B,6 | "E♭/G"G6 ||'), abc);
  assert.ok(abc.includes('w: D D E♭ * | G'), 'the second voice\'s note gets no name');
  assert.ok(abc.includes('[V:R] [K:Dm] [Q:"Two" 1/4=100] !fermata!"Dm"[FAd]6 |]'));
  assert.ok(abc.includes('[V:L] [K:Dm =e clef=bass] D,6 |]'), 'the bass staff shows the E flat going');
  assert.match(abc, /^K:Gm$/m);
  assert.deepEqual(cancels('Fm', 'Gm'), ['=a', '=d']);
  assert.deepEqual(cancels('Dm', 'Fm'), []);
  assert.deepEqual(cancels('D', 'C'), ['=f', '=c']);
  // the plain lead sheet, for when abcjs can't load
  const lead = longLeadSheet('long:bg-ocean', longLevels('long:bg-ocean')[0]);
  assert.equal(lead.length, 8);
  assert.deepEqual(lead.flatMap((s) => s.bars.map((b) => b.n)), [...Array(lead.reduce((n, s) => n + s.bars.length, 0)).keys()], 'bars numbered through the piece');
});

test('the level shown: the one picked when written, else the easiest written', () => {
  const id = 'long:bg-ocean';
  const have = longLevels(id);
  for (const l of LEVELS) assert.equal(longLevel(id, l), have.includes(l) ? l : have[0]);
  assert.equal(longLevel(id, 'nonsense'), have[0]);
  assert.equal(longLevel('bg-meadow', 'easy'), null, 'a song is not a concert piece');
});

// ---------- opening and buying ----------

test('the upright piano opens the concert pieces; a treasure map doesn\'t', () => {
  assert.equal(CONCERT_TIER, 2);
  assert.deepEqual(CONCERT.map((p) => p.id), Object.keys(LONG_PIECES));
  const all = new Set(['bg-ocean', 'bg-meadow']);
  for (const tier of [0, 1]) assert.ok(concertBookFor(tier).every((p) => !p.open && !p.bought), `tier ${tier}: closed`);
  for (const tier of [2, 3]) assert.ok(concertBookFor(tier).every((p) => p.open && !p.secret), `tier ${tier}: open`);
  assert.ok(concertBookFor(1, ['song:bg-ocean']).every((p) => !p.open), 'owning the map song opens nothing');
  // the songs' songbook (the studio and the Note-o-Matic read it) has no concert piece
  assert.equal(SONGBOOK.length, 18);
  assert.ok(!songbookFor(3, all).some((p) => isLongPiece(p.id)));
  assert.ok(!shelfSongs(3, all).some((p) => isLongPiece(p.id)), 'the studio shelf leaves them out');
});

test('a concert piece is bought like any piece: once, for 20 coins', () => {
  const id = 'long:bg-ocean';
  const kid = { owned: ['song:bg-meadow'], spent: 0 };
  const pieceAt = (tier) => concertBookFor(tier, kid.owned).find((p) => p.id === id);
  assert.equal(songBuyCheck(pieceAt(1), 500), 'locked', 'the first piano: not yet');
  assert.equal(buySong(kid, pieceAt(1), 500), false);
  assert.equal(songBuyCheck(pieceAt(2), SONG_PRICE - 1), 'short');
  assert.equal(songBuyCheck(pieceAt(2), SONG_PRICE), 'ok');
  assert.equal(buySong(kid, pieceAt(2), 100), true);
  assert.deepEqual(kid.owned, ['song:bg-meadow', 'song:long:bg-ocean']);
  assert.equal(songItemId(id), 'song:long:bg-ocean');
  assert.equal(kid.spent, SONG_PRICE);
  assert.ok(songsBought(kid.owned).has(id));
  assert.equal(pieceAt(2).bought, true);
  assert.equal(songBuyCheck(pieceAt(2), 100), 'bought');
  assert.equal(buySong(kid, pieceAt(2), 100), false, 'never twice');
  assert.equal(kid.spent, SONG_PRICE);
  // it isn't a shop item: the wardrobe and furniture skip it
  assert.equal(itemById('song:long:bg-ocean'), undefined);
});

// ---------- when it sounds ----------

const timed = [
  { name: 'Slow', key: 'C', bpm: 60, rh: ['!p! c6', 'c4 d2-', '!fermata!d2 e4'], lh: ['C,6', 'C,6', 'C,6'], chords: ['C', 'C', 'C'] },
  { name: 'Quick', key: 'G', bpm: 120, rh: ['g6', '!ff! g6'], lh: ['!f! G,6', 'G,6'], chords: ['G', 'G'] },
];

test('each part at its own speed, a fermata bar held 1.7 times, tied notes joined', () => {
  const { bars, notes, seconds } = longTimeline('x', 'hard', timed);
  // 60 a minute: a bar of 3/4 is 3 seconds; the held bar 3 x 1.7; at 120 a bar is 1.5 seconds
  const want = [0, 3, 6, 6 + 3 * FERMATA_HOLD, 6 + 3 * FERMATA_HOLD + 1.5, 6 + 3 * FERMATA_HOLD + 3];
  want.forEach((t, i) => close(bars[i], t, `bar ${i}`));
  close(seconds, want[5]);
  const rh = notes.filter((n) => n.hand === 'rh');
  const d = rh.find((n) => n.midi === 74);
  close(d.t, 3 + 2, 'd starts on beat 3 of bar 2');
  close(d.dur, 1 + (2 / 6) * 3 * FERMATA_HOLD, 'and is held into the fermata bar, stretched there');
  const e = rh.find((n) => n.midi === 76);
  close(e.t, 6 + (2 / 6) * 3 * FERMATA_HOLD);
  close(e.dur, (4 / 6) * 3 * FERMATA_HOLD);
  const g = rh.filter((n) => n.midi === 79);
  close(g[0].t, want[3]);
  close(g[0].dur, 1.5, 'the quick part');
  // dynamics: from the mark on, across parts; the left hand's mark counts when the right has none
  assert.equal(rh[0].gain, DYNAMICS.p);
  assert.equal(g[0].gain, DYNAMICS.f, 'the f in the left hand of the quick part');
  assert.equal(g[1].gain, DYNAMICS.ff);
  assert.equal(DYNAMICS.mf, 1);
});

test('which bar is playing, when the bars last different times', () => {
  const { bars } = longTimeline('x', 'hard', timed);
  assert.equal(barAt(bars, -0.1), -1, 'before the first note');
  assert.equal(barAt(bars, 0), 0);
  assert.equal(barAt(bars, 2.99), 0);
  assert.equal(barAt(bars, 3), 1);
  assert.equal(barAt(bars, 6 + 3 * FERMATA_HOLD - 0.01), 2, 'still the held bar');
  assert.equal(barAt(bars, 6 + 3 * FERMATA_HOLD + 0.01), 3);
  assert.equal(barAt(bars, 1e6), 4, 'past the end: the last bar');
  assert.equal(barAt([0, 1], 0.5), 0);
});

test('Listen plays a concert piece on the piano voice, louder and softer, and says which bar it\'s on', () => {
  played.length = 0;
  const { notes, bars } = longTimeline('x', 'hard', timed);
  const h = playTimeline(notes, { bars, tempo: 0.5 });
  const a = contexts[contexts.length - 1];
  a.currentTime = 1e6; // past the end: wait a turn for the rest to be scheduled
  return new Promise((resolve) => { setTimeout(resolve, 150); }).then(() => {
    // each note: a triangle and its octave, from t0 = 0.15, twice as long at half speed
    const starts = [...new Set(played.filter((o) => o.f > 0).map((o) => +(o.t - 0.15).toFixed(6)))].sort((x, y) => x - y);
    const want = [...new Set(notes.map((n) => +(n.t / 0.5).toFixed(6)))].sort((x, y) => x - y);
    assert.deepEqual(starts, want);
    assert.ok(h.done());
    a.currentTime = 0.15 + 4 / 0.5 * 0.5 * 2; // 4 seconds of the piece in, at half speed (8 s)
    assert.equal(h.bar(), 1);
    close(h.at(), 4);
    a.currentTime = 0;
    assert.equal(h.bar(), -1, 'before the start');
    h.stop();
    assert.ok(h.done());
  });
});

test('the medium and hard songs play as they did: their handle has no bar of its own', async () => {
  played.length = 0;
  for (const c of contexts) c.currentTime = 0;
  const h = playNotes([{ midi: 60, start: 0, len: 2, hand: 'rh' }, { midi: 48, start: 3, len: 1, hand: 'lh' }], { bpm: 120, beat: 6 });
  assert.equal(h.bar, undefined);
  assert.equal(h.steps, 6);
  close(h.step, 0.25);
  contexts[0].currentTime = 1e6;
  await new Promise((resolve) => { setTimeout(resolve, 150); });
  const t = [...new Set(played.filter((o) => o.f > 0).map((o) => +o.t.toFixed(9)))];
  assert.deepEqual(t, [0.15, 0.9], 'from 0.15 s, an eighth a quarter second');
  assert.ok(h.done());
  h.stop();
});
