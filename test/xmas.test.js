import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORNAMENTS, STARS, RARITY, TINSEL_PRICE, mapOrnaments, rollOrnament, starsWon, xmasHouse } from '../js/xmas.js';
import { ITEMS, itemById, inSeason, LEGACY_LEVEL } from '../js/items.js';

// a seeded random, so the drop counts are the same every run
const seeded = (seed = 7) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

test('40 ornaments, 4 a map: 2 common, 1 rare, 1 super-rare; a star for each map', () => {
  assert.equal(ORNAMENTS.length, 40);
  assert.equal(STARS.length, 10);
  for (const s of STARS) {
    const list = mapOrnaments(s.map);
    assert.deepEqual(list.map((o) => o.rarity).sort(), ['common', 'common', 'rare', 'super'], s.map);
  }
  // design v2: common 35% each, rare 20%, super-rare 10%; 3 tinsel buys a missing one
  assert.deepEqual([RARITY.common.chance, RARITY.rare.chance, RARITY.super.chance], [0.35, 0.2, 0.1]);
  assert.equal(TINSEL_PRICE, 3);
});

test('drops follow the rarity chances, from that map only', () => {
  const rand = seeded();
  const count = {};
  for (let i = 0; i < 20000; i += 1) {
    const { id } = rollOrnament('bg-meadow', [], rand);
    count[id] = (count[id] || 0) + 1;
  }
  for (const o of mapOrnaments('bg-meadow')) {
    const share = count[o.id] / 20000;
    assert.ok(Math.abs(share - RARITY[o.rarity].chance) < 0.015, `${o.id} ${share}`);
  }
  assert.equal(Object.keys(count).length, 4);
});

test('a double rolls again once, half the time, and a double that stays one is marked', () => {
  const list = mapOrnaments('bg-fjord').map((o) => o.id);
  const have = list.slice(0, 3);
  const rand = seeded(3);
  let doubles = 0;
  for (let i = 0; i < 20000; i += 1) if (rollOrnament('bg-fjord', have, rand).double) doubles += 1;
  // missing only the super-rare (10%): a double is 0.9 then (0.5 + 0.5 * 0.9) = 0.855 of drops
  assert.ok(Math.abs(doubles / 20000 - 0.855) < 0.015, String(doubles / 20000));
  assert.equal(rollOrnament('bg-fjord', list, () => 0.01).double, true);
});

test('a map\'s 4 ornaments win its star; a star picked at door 25 counts too', () => {
  const meadow = mapOrnaments('bg-meadow').map((o) => o.id);
  assert.deepEqual(starsWon(meadow.slice(0, 3)), []);
  assert.deepEqual(starsWon(meadow), ['star-meadow']);
  assert.deepEqual(starsWon([...meadow, 'star-fjord']), ['star-meadow', 'star-fjord']);
});

test('the tree wears a won star only: the one picked, else the first won', () => {
  const meadow = mapOrnaments('bg-meadow').map((o) => o.id);
  const kid = (xmas) => ({ id: 'k', name: 'A', xmas });
  const state = { kids: [] };
  assert.equal(xmasHouse(state, kid({ found: meadow, star: 'star-fjord' }), '2026-12-10').tree.star, 'star-meadow');
  assert.equal(xmasHouse(state, kid({ found: [...meadow, 'star-fjord'], star: 'star-fjord' }), '2026-12-10').tree.star, 'star-fjord');
  assert.equal(xmasHouse(state, kid({ found: meadow.slice(0, 3) }), '2026-12-10').tree.star, null);
  assert.equal(xmasHouse(state, kid({ found: meadow }), '2027-01-01'), null, 'packed away after December');
});

test('holiday outfits: sold in December only, design v2 prices, never handed out free', () => {
  const holiday = ITEMS.filter((i) => i.holiday);
  assert.equal(holiday.length, 10, '7 pieces and 3 more scarf colors');
  const price = Object.fromEntries(holiday.map((i) => [i.id, i.price]));
  assert.deepEqual(price, {
    'hat-santa': 100, 'hat-elf': 85, 'hat-antlers': 85, 'hat-earmuffs': 60, 'neck-knitscarf': 55,
    'neck-knitscarf-green': 55, 'neck-knitscarf-blue': 55, 'neck-knitscarf-purple': 55, 'neck-xmas-sweater': 140, 'hand-mittens': 40,
  });
  for (const i of holiday) {
    assert.equal(inSeason(i, '2026-12-01'), true, i.id);
    assert.equal(inSeason(i, '2026-12-31'), true, i.id);
    assert.equal(inSeason(i, '2026-11-30'), false, i.id);
    assert.equal(inSeason(i, '2027-01-01'), false, i.id);
    assert.equal(LEGACY_LEVEL(i), Infinity, i.id);
  }
  assert.equal(inSeason(itemById('hat-cap'), '2026-07-04'), true, 'everything else is sold all year');
});
