import test from 'node:test';
import assert from 'node:assert/strict';
import {
  landGrade, popGrade, comboCards, trickName, recordTrick, trickOfDay, fold, likeA, HEIGHTS,
  TRICKS, TRICK, TWISTS, RARITY, BIKES, LAND, POP_WIN,
} from '../js/bike.js';
import { HILLS, SNOW_KINDS } from '../js/slopes.js';
import { gameFor, GAME_NAMES } from '../js/play.js';
import { itemById, MOVES } from '../js/items.js';

test('a landing within the assist is never a crash, and too far round is', () => {
  assert.equal(landGrade(0), 'perfect');
  assert.equal(landGrade(LAND.perfect), 'perfect');
  assert.equal(landGrade(-20), 'good');
  assert.equal(landGrade(50), 'sketchy');
  assert.equal(landGrade(90), 'crash');
  assert.equal(fold(370), 10);
  assert.equal(fold(-350), 10);
  assert.equal(landGrade(fold(355 - 0)), 'perfect', 'a whole flip that stops 5 degrees short');
});

test('a pop cannot fail: early, late or way off is still a hop', () => {
  assert.equal(popGrade(0.02), 'perfect');
  assert.equal(popGrade(-POP_WIN.perfect), 'perfect');
  assert.equal(popGrade(0.15), 'good');
  assert.equal(popGrade(2), 'hop');
});

test('landings earn the exact combo card, or each part of it', () => {
  assert.deepEqual(comboCards(0, 0, 0), ['hop']);
  assert.deepEqual(comboCards(1, 0, 0), ['backflip']);
  assert.deepEqual(comboCards(1, 1, 0), ['flipspin']);
  assert.deepEqual(comboCards(0, 0, 2), ['superman']);
  assert.deepEqual(comboCards(2, 1, 0), ['double', 'spin']);
  assert.deepEqual(comboCards(5, 0, 0), ['triple']);
  assert.equal(trickName(2, 1, 1), 'Double backflip + 360 + no-hander');
  assert.equal(trickName(0, 0, 0), 'Bunny hop');
});

test('every card has a rarity and a fact, every map has a twist and a card of its own', () => {
  for (const t of TRICKS) {
    assert.ok(RARITY[t.rarity], t.id);
    assert.ok(t.note.length > 20, t.id);
    if (t.map) assert.ok(HILLS[t.map], `${t.id} is on a real hill`);
    if (t.snow) assert.ok(SNOW_KINDS[t.snow], `${t.id} needs a real snow kind`);
  }
  assert.equal(new Set(TRICKS.map((t) => t.id)).size, TRICKS.length);
  for (const id of Object.keys(HILLS)) {
    assert.ok(TWISTS[id], `${id} has a twist`);
    assert.equal(TRICKS.filter((t) => t.map === id).length, 1, `${id} has one map trick`);
  }
});

test('the trick book keeps the first landing, then records higher or longer ones', () => {
  let { book, res } = recordTrick({}, { id: 'backflip', height: 3.2, dist: 10, grade: 'perfect', map: 'bg-meadow', date: '2026-11-21' });
  assert.equal(res, 'first');
  assert.deepEqual(book.backflip, { n: 1, h: 3.2, d: 10, perfect: 1, map: 'bg-meadow', date: '2026-11-21' });
  ({ book, res } = recordTrick(book, { id: 'backflip', height: 2, dist: 8, grade: 'good' }));
  assert.equal(res, null);
  assert.equal(book.backflip.n, 2);
  assert.equal(book.backflip.h, 3.2);
  ({ book, res } = recordTrick(book, { id: 'backflip', height: 4.1, dist: 9, grade: 'perfect' }));
  assert.equal(res, 'record');
  assert.equal(book.backflip.perfect, 2);
  assert.equal(recordTrick(book, { id: 'nope' }).res, null);
});

test('the trick of the day is the same all day and an easy one', () => {
  const t = trickOfDay('2026-11-21');
  assert.equal(t, trickOfDay('2026-11-21'));
  assert.ok(['common', 'uncommon'].includes(TRICK[t].rarity));
  assert.equal(likeA(4.6, HEIGHTS), 'a giraffe');
});

test('better bikes pop higher, flip faster and find golden ramps more', () => {
  for (let i = 1; i < BIKES.length; i += 1) {
    assert.ok(BIKES[i].pop > BIKES[i - 1].pop);
    assert.ok(BIKES[i].flip > BIKES[i - 1].flip);
    assert.ok(BIKES[i].gold > BIKES[i - 1].gold);
  }
});

test('a visitor with a bike plays trick jumps; the bike is gear with three moves', () => {
  assert.equal(gameFor({ bike: 1 }, 'x'), 'tricks');
  assert.equal(GAME_NAMES.tricks, 'Trick jumps');
  for (const v of ['regular', 'good', 'super']) assert.equal(itemById(`sport-bike-${v}`)?.kind, 'bike');
  assert.deepEqual(MOVES.filter((m) => m.kind === 'bike').map((m) => m.id), ['wheelie', 'bunnyhop', 'tailwhip']);
});
