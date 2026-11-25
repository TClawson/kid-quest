import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SANTA_PRIZES, rollSanta, santaDue, santaFlies, presentsWaiting, openSanta, lettersKept,
  doorState, doorsToday, missedDoors, rollDoor, rollLittleDoor, openDoor, xmasPay, xmasGames,
  outfitColors, outfitsMissing, DOOR_TABLE, STAR_DOOR, MAX_DOORS_A_DAY,
} from '../js/advent.js';
import { ORNAMENTS, rollAnyOrnament } from '../js/xmas.js';
import { SANTA_NOTES, santaNote } from '../js/santanotes.js';
import { emptyState, totalCoins, totalGems } from '../js/logic.js';

const OK = { open: true, left: 0 };
const kid = (extra = {}) => ({ id: 'kid_ava', name: 'Ava', ...extra });

test('Santa brings 3 gems, 10 coins or 2 extra games, at equal odds, the same on every device', () => {
  assert.deepEqual(SANTA_PRIZES, { gems: { gems: 3 }, coins: { coins: 10 }, plays: { games: 2 } });
  const count = { gems: 0, coins: 0, plays: 0 };
  for (let i = 0; i < 3000; i += 1) count[rollSanta(`kid_${i}`, '2026-12-05')] += 1;
  for (const k of Object.keys(count)) assert.ok(Math.abs(count[k] / 3000 - 1 / 3) < 0.04, `${k} ${count[k]}`);
  assert.equal(rollSanta('kid_ava', '2026-12-05'), rollSanta('kid_ava', '2026-12-05'));
  // the little one: a sticker or a coin shower
  const little = new Set(Array.from({ length: 200 }, (_, i) => rollSanta(`k${i}`, '2026-12-05', true)));
  assert.deepEqual([...little].sort(), ['shower', 'sticker']);
});

test('Santa flies once a December day; the present waits by the door until opened', () => {
  const k = kid();
  assert.equal(santaDue(k, '2026-11-30'), false, 'not in November');
  assert.equal(santaDue(k, '2027-01-01'), false, 'not in January');
  assert.equal(santaDue(k, '2026-12-03'), true);
  const rec = santaFlies(k, '2026-12-03');
  assert.equal(rec.prize, rollSanta('kid_ava', '2026-12-03'));
  assert.equal(santaDue(k, '2026-12-03'), false, 'a second device sees he has flown');
  santaFlies(k, '2026-12-03');
  assert.equal(Object.keys(k.xmas.santa).length, 1);
  // not opened: it is still by the door the next day, with the next day's present
  santaFlies(k, '2026-12-04');
  assert.deepEqual(presentsWaiting(k, '2026-12-04'), ['2026-12-03', '2026-12-04']);
  assert.equal(xmasPay(k).coins + xmasPay(k).gems, 0, 'nothing counts until it is opened');
  openSanta(k, '2026-12-03', '2026-12-04');
  assert.deepEqual(presentsWaiting(k, '2026-12-04'), ['2026-12-04']);
  assert.equal(openSanta(k, '2026-12-03', '2026-12-04'), null, 'opened only once');
  assert.deepEqual(lettersKept(k), ['2026-12-03']);
  // presents go back to the North Pole with the decorations
  assert.deepEqual(presentsWaiting(k, '2027-01-01'), []);
});

test('Santa\'s prizes count once opened: coins and gems in the totals, games on the day opened', () => {
  const k = kid({ xmas: { santa: {
    '2026-12-01': { prize: 'coins', opened: '2026-12-01' },
    '2026-12-02': { prize: 'gems', opened: '2026-12-03' },
    '2026-12-03': { prize: 'plays', opened: '2026-12-03' },
    '2026-12-04': { prize: 'coins' }, // not opened
    '2026-12-05': { prize: 'shower', opened: '2026-12-05' }, // the little one's
  } } });
  assert.deepEqual(xmasPay(k), { coins: 20, gems: 3 });
  assert.equal(xmasGames(k, '2026-12-03'), 2);
  assert.equal(xmasGames(k, '2026-12-02'), 0);
  // and logic.js's totals add them
  const s = emptyState();
  s.kids.push({ ...k, tasks: [], startDate: '2026-12-01' });
  assert.equal(totalCoins(s, s.kids[0], '2026-12-05'), 20);
  assert.equal(totalGems(s, s.kids[0], '2026-12-05'), 3);
  // the little one's present has no letter
  assert.deepEqual(lettersKept(k), ['2026-12-01', '2026-12-02', '2026-12-03']);
});

test('31 letters from Santa, one a day', () => {
  assert.equal(SANTA_NOTES.length, 31);
  for (let d = 1; d <= 31; d += 1) assert.ok(santaNote(d)?.note.length > 40, `day ${d}`);
  assert.equal(santaNote(32), null);
});

test('a door opens once today\'s chores are done and approved', () => {
  const k = kid();
  assert.deepEqual(doorState(k, '2026-12-11', 11, { open: false, left: 2 }), { ok: false, why: 'chores' });
  assert.deepEqual(doorState(k, '2026-12-11', 11, { open: false, left: 0 }), { ok: false, why: 'waiting' });
  assert.deepEqual(doorState(k, '2026-12-11', 11, OK), { ok: true });
  assert.deepEqual(doorState(k, '2026-12-11', 12, OK), { ok: false, why: 'later' });
  assert.deepEqual(doorState(k, '2026-11-30', 1, OK), { ok: false, why: 'over' });
  assert.deepEqual(doorState(k, '2027-01-01', 1, OK), { ok: false, why: 'over' });
});

test('at most 2 doors a day; missed doors wait until 31 December', () => {
  const k = kid();
  assert.deepEqual(missedDoors(k, '2026-12-11'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  openDoor(k, '2026-12-11', 11, { kind: 'coins', coins: 20 });
  openDoor(k, '2026-12-11', 3, { kind: 'coins', coins: 20 });
  assert.equal(doorsToday(k, '2026-12-11'), MAX_DOORS_A_DAY);
  assert.deepEqual(doorState(k, '2026-12-11', 4, OK), { ok: false, why: 'max' });
  assert.deepEqual(doorState(k, '2026-12-11', 11, OK), { ok: false, why: 'opened' });
  assert.deepEqual(doorState(k, '2026-12-12', 4, OK), { ok: true }, 'tomorrow, two more');
  assert.ok(!missedDoors(k, '2026-12-12').includes(3));
  // after Christmas the missed doors still open, until 31 December
  assert.deepEqual(doorState(k, '2026-12-31', 24, OK), { ok: true });
  assert.deepEqual(missedDoors(k, '2026-12-31').length, 22);
  assert.deepEqual(missedDoors(k, '2027-01-01'), []);
});

test('door 25 needs no chores, opens with earlier doors shut, and doesn\'t count toward the two', () => {
  const k = kid();
  assert.deepEqual(doorState(k, '2026-12-24', STAR_DOOR, OK), { ok: false, why: 'later' });
  assert.deepEqual(doorState(k, '2026-12-25', STAR_DOOR, { open: false, left: 5 }), { ok: true });
  openDoor(k, '2026-12-25', 24, { kind: 'coins', coins: 20 });
  openDoor(k, '2026-12-25', 23, { kind: 'coins', coins: 20 });
  assert.deepEqual(doorState(k, '2026-12-25', STAR_DOOR, OK), { ok: true });
  openDoor(k, '2026-12-25', STAR_DOOR, { kind: 'star', id: 'star-fjord', coins: 100 });
  assert.ok(k.xmas.found.includes('star-fjord'), 'the star goes with the ornaments (xmas.js starsWon)');
  assert.equal(xmasPay(k).coins, 140);
});

test('door prizes follow the table, seeded by kid and door', () => {
  const count = {};
  const N = 4000;
  for (let i = 0; i < N; i += 1) {
    const p = rollDoor({ kidId: `kid_${i}`, year: '2026', n: 1 + (i % 24), found: [], owned: ['neck-knitscarf', 'hat-santa'] });
    count[p.kind] = (count[p.kind] || 0) + 1;
    if (p.kind === 'coins') assert.ok(p.coins >= 20 && p.coins <= 60 && p.coins % 5 === 0, String(p.coins));
  }
  for (const [kind, share] of DOOR_TABLE) assert.ok(Math.abs(count[kind] / N - share) < 0.025, `${kind} ${count[kind] / N}`);
  const a = rollDoor({ kidId: 'kid_ava', year: '2026', n: 7 });
  assert.deepEqual(rollDoor({ kidId: 'kid_ava', year: '2026', n: 7 }), a);
});

test('an ornament door gives an ornament from any map, one the kid is missing', () => {
  const found = ORNAMENTS.filter((o) => o.map !== 'bg-fjord').map((o) => o.id);
  const maps = new Set();
  for (let i = 0; i < 500; i += 1) {
    const id = rollAnyOrnament(found, Math.random);
    assert.ok(!found.includes(id));
    maps.add(ORNAMENTS.find((o) => o.id === id).map);
  }
  assert.deepEqual([...maps], ['bg-fjord']);
  const mapOf = (id) => ORNAMENTS.find((o) => o.id === id).map;
  const any = new Set(Array.from({ length: 400 }, () => mapOf(rollAnyOrnament([], Math.random))));
  assert.equal(any.size, 10);
  assert.equal(rollAnyOrnament(ORNAMENTS.map((o) => o.id)), null);
  // with every ornament found, an ornament door gives coins
  for (let i = 0; i < 300; i += 1) {
    const p = rollDoor({ kidId: `k${i}`, year: '2026', n: 2, found: ORNAMENTS.map((o) => o.id) });
    assert.notEqual(p.kind, 'ornament');
    if (p.kind === 'golden') assert.ok(!p.id);
  }
});

test('outfit doors: a color of a holiday outfit the kid owns, else coins; golden doors fall back', () => {
  assert.deepEqual(outfitColors([]), []);
  assert.deepEqual(outfitColors(['neck-knitscarf']).map((i) => i.id), ['neck-knitscarf-green', 'neck-knitscarf-blue', 'neck-knitscarf-purple']);
  assert.deepEqual(outfitColors(['neck-knitscarf-blue']).map((i) => i.id), ['neck-knitscarf-green', 'neck-knitscarf-purple']);
  let outfits = 0;
  for (let i = 0; i < 2000; i += 1) {
    const none = rollDoor({ kidId: `k${i}`, year: '2026', n: 3, owned: [] });
    assert.notEqual(none.kind, 'outfit', 'no holiday outfit owned: coins instead');
    const p = rollDoor({ kidId: `k${i}`, year: '2026', n: 3, owned: ['neck-knitscarf'] });
    if (p.kind === 'outfit') { outfits += 1; assert.match(p.item, /^neck-knitscarf-/); assert.ok(p.color); }
  }
  assert.ok(outfits > 60);
  // golden: a super-rare missing ornament, else a holiday outfit piece the kid lacks, else gems
  const all = ORNAMENTS.map((o) => o.id);
  const allOutfits = outfitsMissing([]).map((i) => i.id);
  for (let i = 0; i < 3000; i += 1) {
    const g = rollDoor({ kidId: `g${i}`, year: '2026', n: 9, found: all, owned: [] });
    if (g.kind === 'golden') assert.ok(allOutfits.includes(g.item));
    const h = rollDoor({ kidId: `g${i}`, year: '2026', n: 9, found: all, owned: allOutfits });
    if (h.kind === 'golden') assert.equal(h.gems, 5);
    const s = rollDoor({ kidId: `g${i}`, year: '2026', n: 9 });
    if (s.kind === 'golden') assert.equal(ORNAMENTS.find((o) => o.id === s.id).rarity, 'super');
  }
});

test('opening a door keeps its prize on the kid; an ornament goes on the tree', () => {
  const k = kid({ xmas: { found: ['orn-acorn'] } });
  openDoor(k, '2026-12-02', 2, { kind: 'ornament', id: 'orn-puffin' });
  openDoor(k, '2026-12-02', 1, { kind: 'gem', gems: 3 });
  assert.deepEqual(k.xmas.found, ['orn-acorn', 'orn-puffin']);
  assert.deepEqual(k.xmas.doors['2026'][2], { kind: 'ornament', id: 'orn-puffin', on: '2026-12-02' });
  assert.deepEqual(xmasPay(k), { coins: 0, gems: 3 });
  openDoor(k, '2026-12-03', 3, { kind: 'game', games: 1 });
  assert.equal(xmasGames(k, '2026-12-03'), 1);
});

test('the little one\'s doors give her a sticker, an animal she hasn\'t met first', () => {
  const animals = ['a', 'b', 'c'];
  for (let n = 1; n <= 24; n += 1) assert.equal(rollLittleDoor({ kidId: 'mia', year: '2026', n, animals, met: { a: {}, b: {} } }).animal, 'c');
  assert.ok(animals.includes(rollLittleDoor({ kidId: 'mia', year: '2026', n: 4, animals, met: { a: {}, b: {}, c: {} } }).animal));
});
