// The songbook's concert pieces (js/concert.js, js/longpieces.js): two voices in a hand,
// every bar of every level written so far whole (in its part's meter) and playable, opened by
// the upright piano, bought like any piece, and played with each part at its own speed (which
// may slide), held bars held, short notes short and rolled chords rolled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeAudio } from './helpers/fake-audio.mjs';
import { readAbcBar, LEVELS } from '../js/arrange.js';
import { signature, SONGBOOK, songbookFor, songBuyCheck, buySong, songsBought, songItemId, SONG_PRICE } from '../js/sheetmusic.js';
import { LONG_PIECES } from '../js/longpieces.js';
import {
  CONCERT, CONCERT_TIER, FERMATA_HOLD, SHORT, ROLL_STEP, DYNAMICS, concertBookFor, isLongPiece, longLevels, longLevel, longSections,
  longBars, longNotes, longTimeline, longAbc, longFacts, longChordLabel, longLeadSheet, cancels, barEighths, beatEighths, barBpm, sectionMeter,
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
        assert.ok(['3/4', '4/4', '6/8'].includes(sectionMeter(s)), `${level} ${s.name}: meter ${s.meter}`);
        if (s.bpmTo != null) assert.ok(s.bpmTo >= 40 && s.bpmTo <= 200, `${level} ${s.name}: speed to ${s.bpmTo}`);
        for (const [b, words] of Object.entries(s.marks || {})) assert.ok(Number(b) < s.rh.length && words && !/["—]/.test(words), `${level} ${s.name}: words "${words}" over bar ${b}`);
        for (const c of s.chords) assert.match(c, /^[A-G][#b]?(m|dim|aug|sus)?\d*(\/[A-G][#b]?)?$/, `${level} ${s.name}: chord ${c}`);
        for (const hand of ['rh', 'lh']) {
          s[hand].forEach((text, b) => {
            const where = `${level} ${s.name} ${hand} bar ${b + 1} "${text}"`;
            const r = readAbcBar(text, sig);
            assert.deepEqual(r.errors, [], where);
            assert.ok(r.lengths.every((len) => Math.abs(len - barEighths(s)) < 1e-9), `${where}: ${r.lengths.join(' + ')} eighths in ${sectionMeter(s)}`);
            for (const e of r.events) for (const n of e.notes) assert.ok(n.midi >= 21 && n.midi <= 108, `${where}: ${n.midi} is on the piano`);
          });
        }
      }
      // every note joined up and on the keys, and every bar has something in it
      const notes = longNotes(id, level);
      const bars = longBars(id, level).length;
      const eighths = sections.reduce((sum, s) => sum + s.rh.length * barEighths(s), 0);
      assert.ok(notes.every((n) => n.len > 0 && n.midi >= 21 && n.midi <= 108));
      assert.ok(notes.every((n) => n.start + n.len <= eighths + 1e-9), 'no note runs past the end');
      assert.match(longFacts(id, level), /^\d+ parts · about \d+ min$/);
      // the score has every bar in both hands, the final bar line only at the end
      const abc = longAbc(id, level, { names: true, perLine: 4 });
      const barsIn = (voice) => abc.split('\n').filter((l) => l.startsWith(`[V:${voice}]`)).join(' ').split(/\|\]|\|\||\|/).length - 1;
      assert.deepEqual([barsIn('R'), barsIn('L')], [bars, bars], `${level}: every bar in both hands`);
      assert.equal(abc.split('|]').length - 1, 2, `${level}: the final bar line in each hand, once`);
      assert.ok(abc.trimEnd().endsWith('|]'));
      assert.equal((abc.match(/\[Q:"/g) || []).length, sections.length, `${level}: each part's name and speed`);
      assert.match(abc, new RegExp(`^M:${sectionMeter(sections[0])}$`, 'm'), `${level}: the first part's meter`);
      sections.slice(1).forEach((s, k) => {
        const meter = sectionMeter(s) === sectionMeter(sections[k]) ? '' : `[M:${sectionMeter(s)}] `;
        const tempo = `${sectionMeter(s) === '6/8' ? '3/8' : '1/4'}=${s.bpm}`;
        assert.ok(abc.includes(`[K:${s.key}] ${meter}[Q:"${s.name}" ${tempo}]`), `${level}: ${s.name} starts with its key, meter (when it changes) and speed`);
      });
      const changes = sections.filter((s, k) => k && sectionMeter(s) !== sectionMeter(sections[k - 1])).length;
      assert.equal((abc.match(/\[M:/g) || []).length, 2 * changes, `${level}: each meter change in both hands`);
      assert.equal((abc.match(/\[V:L\] \[K:/g) || []).length, sections.length - 1, 'the left hand changes key too');
      assert.ok(!/\[K:[^\]]*\]/.test(abc.split('\n').filter((l) => l.startsWith('[V:L]')).join('\n').replace(/\[K:[^\]]* clef=bass\]/g, '')), 'and keeps its bass clef');
      // the timeline has every bar, and the right length of each
      const { bars: starts } = longTimeline(id, level);
      assert.equal(starts.length, bars + 1);
      longBars(id, level).forEach((b, k) => close(starts[k + 1] - starts[k], b.length * (60 / b.beat) / b.bpm * (b.fermata ? FERMATA_HOLD : 1), `${level} bar ${k}`));
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

test('the Forest Village concert piece: seven parts in 4/4 and 6/8, 90 bars at hard and medium, 84 at easy', () => {
  const id = 'long:bg-meadow';
  const p = LONG_PIECES[id];
  assert.equal(p.name, 'Forest Village/The Walk to the Oak');
  assert.equal(p.map, 'bg-meadow');
  assert.match(p.story, /^A long piece in seven parts: /);
  assert.deepEqual(CONCERT.map((x) => x.id), ['long:bg-ocean', id], 'the second concert piece, after the Bubble Waltz');
  assert.equal(CONCERT[1].parts, 7);
  assert.equal(CONCERT[1].tier, CONCERT_TIER);
  assert.deepEqual(longLevels(id), ['easy', 'medium', 'hard']);
  // medium keeps every bar of hard; easy is six bars shorter. Every level has the same parts
  // in the same meters and ends on the same rolled chord
  assert.deepEqual(longSections(id, 'medium').map((s) => s.rh.length), [9, 16, 6, 16, 10, 20, 13]);
  assert.deepEqual(longSections(id, 'easy').map((s) => s.rh.length), [8, 16, 6, 16, 8, 18, 12]);
  assert.equal(longBars(id, 'easy').length, 84);
  for (const level of ['easy', 'medium']) {
    assert.deepEqual(longSections(id, level).map((s) => s.name), longSections(id, 'hard').map((s) => s.name), level);
    assert.deepEqual(longSections(id, level).map(sectionMeter), ['4/4', '4/4', '4/4', '6/8', '4/4', '4/4', '4/4'], level);
    assert.deepEqual(longTimeline(id, level).notes.filter((n) => n.hand === 'rh').slice(-3).map((n) => n.midi), [84, 91, 96], `${level}: the last chord`);
  }
  assert.equal(longFacts(id, 'medium'), '7 parts · about 4 min');
  assert.equal(longFacts(id, 'easy'), '7 parts · about 3 min');
  const sections = longSections(id, 'hard');
  assert.deepEqual(sections.map((s) => s.name), ['Before Sunrise', 'Forest Village', 'The Path into the Woods', 'The Great Oak', 'Fireflies', 'Dance of the Lights', 'Home by Starlight']);
  assert.deepEqual(sections.map((s) => s.rh.length), [9, 16, 6, 16, 10, 20, 13]);
  assert.equal(longBars(id, 'hard').length, 90);
  assert.deepEqual(sections.map(sectionMeter), ['4/4', '4/4', '4/4', '6/8', '4/4', '4/4', '4/4']);
  assert.equal(sections[3].key, 'Ddor');
  // about three and a half minutes: "about 4 min"
  const { seconds } = longTimeline(id, 'hard');
  assert.ok(seconds > 205 && seconds < 220, `${seconds} seconds`);
  assert.equal(longFacts(id, 'hard'), '7 parts · about 4 min');
  // the path slows from 132 to 81 over all its bars; the coda from 132 to 66 over five
  [132, 121.8, 111.6, 101.4, 91.2, 81].forEach((bpm, k) => close(barBpm(sections[2], k), bpm, `the path's bar ${k}`));
  assert.deepEqual([0, 1, 2, 3, 4, 5, 12].map((k) => barBpm(sections[6], k)), [132, 115.5, 99, 82.5, 66, 66, 66]);
  // the oak's song: a dotted quarter at 54, two to a bar
  const oak = longBars(id, 'hard').find((b) => b.section === 3);
  assert.deepEqual([oak.length, oak.beat, oak.bpm], [6, 3, 54]);
  // the last chord is rolled, from the lowest note up
  const last = longTimeline(id, 'hard').notes.filter((n) => n.hand === 'rh').slice(-3);
  assert.deepEqual(last.map((n) => n.midi), [84, 91, 96]);
  close(last[1].t - last[0].t, ROLL_STEP);
  close(last[2].t - last[0].t, 2 * ROLL_STEP);
  // the score: the meter changes to 6/8 for the oak and back, both hands
  const abc = longAbc(id, 'hard', { perLine: 4 });
  assert.match(abc, /^M:4\/4$/m);
  assert.ok(abc.includes('[V:R] [K:Ddor] [M:6/8] [Q:"The Great Oak" 3/8=54] !p! "Dm"F2A d2c'));
  assert.ok(abc.includes('[V:L] [K:Ddor clef=bass] [M:6/8] D,,A,,F, A,F,A,,'));
  assert.ok(abc.includes('[V:R] [K:C] [M:4/4] [Q:"Fireflies" 1/4=81] !pp! "^getting faster little by little""Gsus4"z4 .g z z2'));
  assert.ok(abc.includes('[V:L] [K:C clef=bass] [M:4/4] G,,2 D,2 [G,C]4'));
  assert.ok(abc.includes('!p! "F"[FA]4 "Fm"[F_A]4'), 'the second chord name in a bar, as written');
  assert.equal(longLeadSheet(id, 'hard').length, 7);
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

test('the score: meter changes in both hands, a 6/8 speed in dotted quarters, words over bars, short notes and a rolled chord', () => {
  const sections = [
    { name: 'One', meter: '4/4', key: 'C', bpm: 100, marks: { 1: 'with pedal' }, rh: ['!p! c8', '.c2 .[ce]2 g4'], lh: ['C,8', 'C,8'], chords: ['C', 'C'] },
    { name: 'Two', meter: '4/4', key: 'C', bpm: 90, rh: ['c8'], lh: ['C,8'], chords: ['C'] },
    { name: 'Three', meter: '6/8', key: 'Ddor', bpm: 54, rh: ['F2A d2c'], lh: ['D,6'], chords: ['Dm'] },
    { name: 'Four', key: 'Dm', bpm: 80, rh: ['d6'], lh: ['D,6'], chords: ['Dm'] },
    { name: 'Five', meter: '4/4', key: 'C', bpm: 81, marks: { 0: 'slowing' }, rh: ['z2 !arpeggio![CEG]6'], lh: ['C,8'], chords: ['C'] },
  ];
  const abc = longAbc('x', 'hard', { perLine: 4, names: true }, sections);
  assert.match(abc, /^M:4\/4$/m, 'the first part\'s meter in the head');
  assert.ok(abc.includes('[V:R] [Q:"One" 1/4=100] !p! "C"c8 | "^with pedal""C".c2 .[ce]2 g4 ||'), 'the words over their bar, with the chord name before the staccato dot');
  assert.ok(abc.includes('\nw: C | C E G\n'), 'note names as before');
  assert.ok(abc.includes('[V:R] [K:C] [Q:"Two" 1/4=90] "C"c8 ||'), 'no meter when it stays the same');
  assert.ok(abc.includes('[V:R] [K:Ddor] [M:6/8] [Q:"Three" 3/8=54] "Dm"F2A d2c ||'));
  assert.ok(abc.includes('[V:L] [K:Ddor clef=bass] [M:6/8] D,6 ||'));
  assert.ok(abc.includes('[V:R] [K:Dm] [M:3/4] [Q:"Four" 1/4=80] "Dm"d6 ||'), 'a part with no meter is in 3/4');
  assert.ok(abc.includes('[V:L] [K:Dm clef=bass] [M:3/4] D,6 ||'));
  assert.ok(abc.includes('[V:R] [K:C] [M:4/4] [Q:"Five" 1/4=81] "^slowing""C"z2 !arpeggio![CEG]6 |]'));
  assert.equal((abc.match(/\[M:/g) || []).length, 6, 'three changes, each in both hands');
  // a piece in 3/4 all through says nothing more than it did
  const waltz = longAbc('x', 'hard', {}, [{ name: 'W', key: 'C', bpm: 90, rh: ['c6'], lh: ['C,6'], chords: ['C'] }, { name: 'X', key: 'C', bpm: 90, rh: ['c6'], lh: ['C,6'], chords: ['C'] }]);
  assert.match(waltz, /^M:3\/4$/m);
  assert.ok(!waltz.includes('[M:') && !waltz.includes('"^'));
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

test('bar lengths and beats: eight eighths in 4/4, six in 3/4 and 6/8, whose beat is a dotted quarter', () => {
  assert.equal(barEighths({}), 6, 'no meter: 3/4');
  assert.equal(barEighths({ meter: '3/4' }), 6);
  assert.equal(barEighths({ meter: '4/4' }), 8);
  assert.equal(barEighths({ meter: '6/8' }), 6);
  assert.deepEqual([beatEighths({}), beatEighths({ meter: '4/4' }), beatEighths({ meter: '6/8' })], [2, 2, 3]);
  assert.throws(() => barEighths({ meter: '5/4' }));
  // at 60: a bar of 4/4 lasts 4 seconds, of 3/4 3, of 6/8 2 (a dotted quarter a second)
  const sections = [
    { name: 'A', meter: '4/4', key: 'C', bpm: 60, rh: ['c8', 'z4 d4'], lh: ['C,8', 'C,8'], chords: ['C', 'C'] },
    { name: 'B', meter: '6/8', key: 'C', bpm: 60, rh: ['e6', 'z3 f3'], lh: ['C,6', 'C,6'], chords: ['C', 'C'] },
    { name: 'C', key: 'C', bpm: 60, rh: ['g6'], lh: ['C,6'], chords: ['C'] },
  ];
  const bars = longBars('x', 'hard', sections);
  assert.deepEqual(bars.map((b) => [b.meter, b.length, b.beat, b.at]), [['4/4', 8, 2, 0], ['4/4', 8, 2, 8], ['6/8', 6, 3, 16], ['6/8', 6, 3, 22], ['3/4', 6, 2, 28]]);
  const rh = longNotes('x', 'hard', sections).filter((n) => n.hand === 'rh');
  assert.deepEqual(rh.map((n) => [n.midi, n.start, n.len]), [[72, 0, 8], [74, 12, 4], [76, 16, 6], [77, 25, 3], [79, 28, 6]]);
  const t = longTimeline('x', 'hard', sections);
  [0, 4, 8, 10, 12, 15].forEach((x, k) => close(t.bars[k], x, `bar ${k}`));
  const at = (midi) => t.notes.find((n) => n.midi === midi && n.hand === 'rh');
  close(at(74).t, 6, 'the d on beat 3 of the second 4/4 bar');
  close(at(74).dur, 2);
  close(at(77).t, 11, 'the f on the second beat of the 6/8 bar');
  close(at(77).dur, 1);
  close(at(79).dur, 3);
});

test('a speed that slides: a step a bar, over the whole part or over its first rampBars bars', () => {
  const part = (o) => ({ name: 'P', meter: '4/4', key: 'C', bpm: 120, bpmTo: 60, rh: Array(o.n).fill('c8'), lh: Array(o.n).fill('C,8'), chords: Array(o.n).fill('C'), ...o });
  // over all four bars: 120, 100, 80, 60 (a 4/4 bar lasts 240 / bpm seconds)
  const whole = part({ n: 4 });
  assert.deepEqual([0, 1, 2, 3].map((k) => barBpm(whole, k)), [120, 100, 80, 60]);
  const a = longTimeline('x', 'hard', [whole]);
  [0, 2, 4.4, 7.4, 11.4].forEach((x, k) => close(a.bars[k], x, `bar ${k}`));
  // over the first three bars of five: 120, 90, 60, then 60 on
  const ramped = part({ n: 5, rampBars: 3 });
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => barBpm(ramped, k)), [120, 90, 60, 60, 60]);
  const b = longTimeline('x', 'hard', [ramped]);
  [0, 2, 2 + 8 / 3, 6 + 8 / 3, 10 + 8 / 3, 14 + 8 / 3].forEach((x, k) => close(b.bars[k], x, `bar ${k}`));
  // a note keeps its bar's speed all through
  const n = b.notes.find((x) => x.hand === 'rh' && Math.abs(x.t - 2) < 1e-9);
  close(n.dur, 8 / 3);
  // rampBars longer than the part: over the whole part; a part of one bar keeps its bpm
  assert.equal(barBpm(part({ n: 4, rampBars: 9 }), 3), 60);
  assert.equal(barBpm(part({ n: 1 }), 0), 120);
  assert.equal(barBpm({ ...whole, bpmTo: undefined }, 3), 120, 'no slide');
  // in 6/8 the slide counts dotted quarters: at 40 a bar lasts 3 seconds
  const slow = part({ n: 2, meter: '6/8', bpm: 60, bpmTo: 40, rh: ['c6', 'c6'], lh: ['C,6', 'C,6'], chords: ['C', 'C'] });
  close(longTimeline('x', 'hard', [slow]).seconds, 2 + 3);
});

test('short notes sound for 45% of their length; a rolled chord starts 0.09 s a note from the lowest', () => {
  const r = readAbcBar('.c2 .[ce]2 g2 !arpeggio![ecG]2', C);
  assert.deepEqual(r.events.map((e) => [Boolean(e.short), Boolean(e.roll)]), [[true, false], [true, false], [false, false], [false, true]]);
  assert.deepEqual(r.events.map((e) => [e.from, e.col]), [[0, 1], [4, 5], [11, 11], [14, 24]], 'from: where its own marks start');
  assert.deepEqual(r.lengths, [8]);
  assert.equal(SHORT, 0.45);
  assert.equal(ROLL_STEP, 0.09);
  const sections = [{ name: 'P', meter: '4/4', key: 'C', bpm: 60, rh: ['.c2 .[ce]2 g2 !arpeggio![ecG]2'], lh: ['C,8'], chords: ['C'] }];
  const rh = longNotes('x', 'hard', sections).filter((n) => n.hand === 'rh');
  assert.deepEqual(rh.map((n) => [n.midi, n.start, n.len, n.roll]), [[72, 0, 0.9, undefined], [72, 2, 0.9, undefined], [76, 2, 0.9, undefined], [79, 4, 2, undefined], [67, 6, 2, 0], [72, 6, 2, 1], [76, 6, 2, 2]]);
  const t = longTimeline('x', 'hard', sections).notes.filter((n) => n.hand === 'rh');
  close(t[0].dur, 0.45, 'an eighth is half a second at 60: a short quarter sounds 0.45 s');
  const rolled = t.slice(-3);
  rolled.forEach((n, k) => { close(n.t, 3 + k * ROLL_STEP, `rolled note ${k}`); close(n.dur, 1, 'each as long as written'); });
  // a short note tied on stops short, as on the reference page: the tie isn't taken up
  const tied = longNotes('x', 'hard', [{ ...sections[0], rh: ['.c4- c4'] }]).filter((n) => n.hand === 'rh');
  assert.deepEqual(tied.map((n) => [n.start, n.len]), [[0, 1.8], [4, 4]]);
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
