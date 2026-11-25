// The December carols (js/carols.js): free in the songbook in December (Denver days), kept by a
// kid who opened one then, never map songs (no map, studio shelf or Note-o-Matic list has them),
// and written out like every other piece: easy from the loop, medium and hard by the arrangement
// rules, a closing bar where the loop ends in the air, a sheet header with the composer and the
// arranger, the printed speed, and a PDF at each level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAROLS, CAROL_ARRANGER } from '../js/carols.js';
import { SONGS, SHOW_SONGS, barChords } from '../js/songs.js';
import {
  SONGBOOK, CAROLBOOK, carolbookFor, keepCarol, isCarol, carolHeader, carolTempo, songbookFor,
  songById, songAbc, meterOf, keyInfo, barEvents, stars, songsBought, songItemId, buySong,
} from '../js/sheetmusic.js';
import { hasLevel, arrangementAbc, arrangementNotes, versionOf } from '../js/arrange.js';
import { ARRANGEMENTS } from '../js/arrangements.js';
import { shelfSongs } from '../js/studiorules.js';
import { printSheets, printAbc, sheetFor } from '../js/printsheets.js';
import { checkArrangement, easyDensity } from './helpers/arrangement-check.mjs';

const IDS = ['xmas-jingle', 'xmas-deck', 'xmas-wish', 'xmas-housetop', 'xmas-tree', 'xmas-bells', 'xmas-silent'];
const ids = (list) => list.map((p) => p.id).sort();

test('seven carols, each with a loop, medium and hard, and a title and composer', () => {
  assert.deepEqual(Object.keys(CAROLS).sort(), [...IDS].sort());
  assert.deepEqual(ids(CAROLBOOK), [...IDS].sort());
  for (const id of IDS) {
    const c = CAROLS[id];
    assert.ok(c.title && c.composer && c.song.lead.length >= 16, id);
    assert.equal(c.song.lead.length, c.song.chords.length, `${id}: a chord a bar`);
    for (const level of ['easy', 'medium', 'hard']) assert.ok(hasLevel(id, level), `${id} ${level}`);
    assert.equal(versionOf(id, 'song'), null, 'only medium and hard are versions');
  }
  assert.equal(CAROL_ARRANGER, 'Tailleur Claude & Son (arr.)');
  assert.equal(CAROLS['xmas-bells'].subtitle, 'Shchedryk');
});

test('in the songbook only in December (Denver days), open and free', () => {
  for (const day of ['2026-11-30', '2027-01-01', '2026-07-04']) assert.deepEqual(carolbookFor(day, []), [], `${day}: none`);
  for (const day of ['2026-12-01', '2026-12-25', '2026-12-31']) {
    const book = carolbookFor(day, []);
    assert.deepEqual(ids(book), [...IDS].sort(), `${day}: all seven`);
    assert.ok(book.every((p) => p.kind === 'carol' && p.open && p.bought && p.free && !p.kept && !p.secret));
  }
});

test('a carol opened in December is kept: in kid.owned, free, and in the songbook after December', () => {
  const kid = { owned: ['song:bg-meadow'], spent: 20 };
  assert.equal(keepCarol(kid, 'xmas-silent', '2026-11-30'), false, 'not before December');
  assert.equal(keepCarol(kid, 'xmas-silent', '2027-01-01'), false, 'not after');
  assert.equal(keepCarol(kid, 'bg-ocean', '2026-12-10'), false, 'only carols');
  assert.deepEqual(kid.owned, ['song:bg-meadow']);
  assert.equal(keepCarol(kid, 'xmas-silent', '2026-12-10'), true);
  assert.equal(keepCarol(kid, 'xmas-silent', '2026-12-11'), false, 'once');
  assert.deepEqual(kid.owned, ['song:bg-meadow', 'song:xmas-silent']);
  assert.equal(kid.spent, 20, 'nothing spent');
  // after December: only the kept carol, still open (no coins, no piano needed)
  const jan = carolbookFor('2027-01-05', kid.owned);
  assert.deepEqual(jan.map((p) => [p.id, p.open, p.bought, p.kept]), [['xmas-silent', true, true, true]]);
  assert.ok(carolbookFor('2026-12-12', kid.owned).find((p) => p.id === 'xmas-silent').kept);
  // the next December brings the rest back, free
  assert.equal(carolbookFor('2027-12-01', kid.owned).length, 7);
  // a kept carol is a 'song:' id like a bought song, and a carol can't be bought with coins
  assert.ok(songsBought(kid.owned).has('xmas-silent'));
  assert.equal(songItemId('xmas-silent'), 'song:xmas-silent');
  assert.equal(buySong({ owned: [], spent: 0 }, carolbookFor('2026-12-05', []).find((p) => p.id === 'xmas-deck'), 100), false, 'never charged');
});

test('carols are not map songs: no map, piano tier, studio shelf or Note-o-Matic list has them', () => {
  for (const id of IDS) {
    assert.ok(isCarol(id));
    assert.ok(!(id in SONGS) && !(id in SHOW_SONGS) && !(id in ARRANGEMENTS), id);
  }
  assert.ok(!SONGBOOK.some((p) => isCarol(p.id)), 'the songs\' songbook (piano tiers, studio, Note-o-Matic) has none');
  assert.ok(!songbookFor(3, new Set(['bg-meadow'])).some((p) => isCarol(p.id)));
  assert.ok(!shelfSongs(3, new Set(['bg-meadow'])).some((p) => isCarol(p.id)), 'not on the studio shelf');
  assert.ok(!isCarol('bg-meadow') && !isCarol('constructor') && !isCarol(undefined));
});

test('each carol on paper: every bar, its key and time, and it ends at home', () => {
  for (const p of CAROLBOOK) {
    const song = songById(p.id);
    const raw = CAROLS[p.id].song;
    assert.equal(song.lead.length, raw.lead.length + (raw.ending ? 1 : 0));
    assert.equal(p.bars, song.lead.length);
    const steps = meterOf(song).steps;
    song.lead.forEach((bar, b) => assert.equal(barEvents(bar).reduce((n, e) => n + e.len, 0), steps, `${p.name} bar ${b + 1}`));
    for (const hands of ['roots', 'chords']) {
      const abc = songAbc(p.id, { hands, perLine: 4 });
      assert.match(abc, new RegExp(`^K:${song.key}$`, 'm'));
      assert.match(abc, new RegExp(`^M:${steps === 6 ? '3/4' : '4/4'}$`, 'm'));
      const barsIn = (voice) => abc.split('\n').filter((l) => l.startsWith(`[V:${voice}]`)).join(' ').split('|').length - 1;
      assert.deepEqual([barsIn('R'), barsIn('L')], [song.lead.length, song.lead.length], `${p.name} ${hands}: every bar`);
    }
    const { tonic, mode } = keyInfo(song.key);
    const home = `${tonic}${mode === 'minor' ? 'm' : ''}`;
    assert.equal(barChords(song.chords[song.chords.length - 1], steps, 2).pop().name, home, `${p.name} ends on ${home}`);
    assert.ok(stars(p.level) >= 1 && stars(p.level) <= 3);
  }
  // Carol of the Bells ends in the air in the game: on paper a held closing A
  assert.ok(CAROLS['xmas-bells'].song.ending);
  assert.match(songAbc('xmas-bells', { hands: 'roots' }), /!fermata!"Am"A6 \|\]/);
  assert.ok(!songAbc('xmas-jingle', { hands: 'roots' }).includes('fermata'));
});

for (const id of IDS) {
  test(`${CAROLS[id].title}: medium and hard follow the arrangement rules, each harder than the last`, () => {
    let lower = easyDensity(id);
    for (const level of ['medium', 'hard']) {
      const r = checkArrangement(id, level, CAROLS[id][level], lower);
      assert.deepEqual(r.errors, [], `${level}:\n${r.errors.join('\n')}`);
      lower = r.stats.density;
      const abc = arrangementAbc(id, level, { names: true, perLine: 4 });
      const barsIn = (voice) => abc.split('\n').filter((l) => l.startsWith(`[V:${voice}]`)).join(' ').split('|').length - 1;
      assert.deepEqual([barsIn('R'), barsIn('L')], [songById(id).lead.length, songById(id).lead.length], 'every bar in both hands');
      assert.ok(arrangementNotes(id, level).length > songById(id).lead.length, 'notes to play for Listen');
    }
  });
}

test('the sheet header: title, subtitle, composer, arranger; the printed speed is sheetTempo', () => {
  assert.deepEqual(carolHeader('xmas-bells'), ['T:Carol of the Bells', 'T:Shchedryk', 'C:Mykola Leontovych (1916)', 'C:Tailleur Claude & Son (arr.)']);
  assert.deepEqual(carolHeader('xmas-jingle', 'Easy · C major'), ['T:Jingle Bells', 'T:Easy · C major', 'C:James Lord Pierpont (1857)', 'C:Tailleur Claude & Son (arr.)']);
  assert.deepEqual(carolHeader('bg-meadow'), []);
  assert.equal(carolTempo('xmas-jingle'), 132);
  assert.equal(carolTempo('xmas-bells'), 144);
  assert.equal(carolTempo('xmas-housetop'), CAROLS['xmas-housetop'].song.bpm, 'no sheetTempo: the loop\'s speed');
  assert.equal(carolTempo('bg-meadow'), null);
  const bells = printAbc(sheetFor('xmas-bells', 'hard'));
  assert.match(bells, /^X:1\nT:Carol of the Bells\nT:Shchedryk\nT:Hard · A minor\nC:Mykola Leontovych \(1916\)\nC:Tailleur Claude & Son \(arr\.\)\nQ:1\/4=144\nM:3\/4\n/);
  assert.match(printAbc(sheetFor('xmas-deck', 'easy')), /\nQ:1\/4=120\n/);
  assert.match(printAbc(sheetFor('xmas-silent', 'medium')), /\nQ:1\/4=96\n/);
  assert.ok(!printAbc(sheetFor('xmas-deck', 'easy')).includes('Music by'), 'not "Music by": the composer is the carol\'s');
});

test('every carol prints at every level', () => {
  const sheets = printSheets().filter((s) => s.kind === 'carol');
  assert.equal(sheets.length, 21);
  for (const id of IDS) for (const level of ['easy', 'medium', 'hard']) assert.match(sheetFor(id, level)?.file || '', /^sheets\/[a-z-]+-(easy|medium|hard)-[0-9a-f]{6}\.pdf$/, `${id} ${level}`);
});
