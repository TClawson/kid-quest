// The December event in the buddy's house: ornament drops (chest, fish, dig, perfect photo),
// tinsel, sibling presents (one each, 1-23 Dec, open from 25 Dec through January) and how they sync.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORNAMENTS, TINSEL_PRICE, DROP_ODDS, mapOrnaments, addOrnament, grantOrnament, chestOrnament, nextRoll, playDrop,
  photoOrnament, tinselSwap, pickMissing, missingOrnaments, xmasHouse,
} from '../js/xmas.js';
import {
  canWrap, canUnwrap, giftCatalogue, wrapGift, receiveGift, unwrapGift, giftList, giftSent, GIFT_MIN, GIFT_MAX,
} from '../js/xmasgifts.js';
import { rng } from '../js/treasure.js';
import { itemById, ownedFor } from '../js/items.js';
import { splitState, migrate, planWrites, diffDocs, AddTo, Increase } from '../js/store.js';

const kid = (id = 'k1', extra = {}) => ({ id, name: id.toUpperCase(), buddy: { species: 'fox', outfit: {} }, owned: [], spent: 0, ...extra });
const meadow = mapOrnaments('bg-meadow').map((o) => o.id);

test('addOrnament: a new one goes in found, a double turns into tinsel', () => {
  const k = kid();
  assert.deepEqual(addOrnament(k, 'orn-acorn'), { id: 'orn-acorn', kind: 'new' });
  assert.deepEqual(addOrnament(k, 'orn-acorn'), { id: 'orn-acorn', kind: 'tinsel' });
  assert.deepEqual(k.xmas, { found: ['orn-acorn'], tinsel: 1 });
  assert.equal(addOrnament(k, 'not-an-ornament'), null);
  // door 25's star goes in found too
  assert.equal(addOrnament(k, 'star-fjord').kind, 'new');
});

test('the chest gives an ornament of the map 1 in 2, only in December, the same on every device', () => {
  let got = 0;
  for (let d = 1; d <= 31; d += 1) for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const day = `2026-12-${String(d).padStart(2, '0')}`;
    const k = kid(id);
    const res = chestOrnament(k, 'bg-ocean', day, rng(`${id}|${day}|xmas-chest`));
    const again = chestOrnament(kid(id), 'bg-ocean', day, rng(`${id}|${day}|xmas-chest`));
    assert.deepEqual(res, again, 'seeded by kid and day');
    if (res) { got += 1; assert.equal(ORNAMENTS.find((o) => o.id === res.id).map, 'bg-ocean'); }
  }
  assert.ok(Math.abs(got / 248 - DROP_ODDS.chest) < 0.1, String(got / 248));
  assert.equal(chestOrnament(kid(), 'bg-ocean', '2026-11-30', () => 0), null, 'not in November');
});

test('fish 1 in 8 and digs 1 in 6: counted on the kid so each roll is seeded', () => {
  const k = kid();
  const day = '2026-12-05';
  assert.equal(nextRoll(k, 'fish', day), 0);
  assert.equal(nextRoll(k, 'fish', day), 1);
  assert.equal(nextRoll(k, 'dig', day), 0);
  assert.equal(nextRoll(k, 'fish', '2026-12-06'), 0, 'a new day starts again');
  for (const [source, odds] of [['fish', 1 / 8], ['dig', 1 / 6]]) {
    let n = 0;
    const N = 6000;
    for (let i = 0; i < N; i += 1) if (playDrop(kid(), source, 'bg-meadow', day, rng(`k|${day}|xmas-${source}|${i}`))) n += 1;
    assert.ok(Math.abs(n / N - odds) < 0.015, `${source} ${n / N}`);
  }
  assert.equal(playDrop(kid(), 'fish', 'bg-meadow', '2027-01-02', () => 0), null, 'not after December');
});

test('the first perfect photo of a December critter: a missing ornament of its map, once per map a year', () => {
  const k = kid('k', { xmas: { found: meadow.slice(0, 3) } });
  const critter = { map: 'bg-meadow', december: true };
  assert.equal(photoOrnament(k, critter, 'good', '2026-12-03'), null, 'only a perfect one');
  assert.equal(photoOrnament(k, { map: 'bg-meadow' }, 'perfect', '2026-12-03'), null, 'only a December critter');
  const res = photoOrnament(k, critter, 'perfect', '2026-12-03', () => 0.5);
  assert.deepEqual(res, { id: meadow[3], kind: 'new' }, 'the one missing');
  assert.equal(photoOrnament(k, critter, 'perfect', '2026-12-09'), null, 'once a year');
  assert.deepEqual(k.xmas.photo, ['2026:bg-meadow']);
  // next December it works again; with all 4 it's a tinsel
  assert.equal(photoOrnament(k, critter, 'perfect', '2027-12-01').kind, 'tinsel');
});

test('tinsel: 3 buys any missing ornament from any map, never a star or one they have', () => {
  const k = kid('k', { xmas: { found: ['orn-acorn'], tinsel: 2 } });
  assert.equal(tinselSwap(k, 'orn-starwhale'), false, 'not enough');
  k.xmas.tinsel = TINSEL_PRICE + 1;
  assert.equal(tinselSwap(k, 'orn-acorn'), false, 'has it');
  assert.equal(tinselSwap(k, 'star-galaxy'), false, 'stars are not for tinsel');
  assert.equal(tinselSwap(k, 'orn-starwhale'), true, 'a locked map\'s super-rare');
  assert.deepEqual(k.xmas, { found: ['orn-acorn', 'orn-starwhale'], tinsel: 1 });
  assert.equal(missingOrnaments(k.xmas.found).length, 38);
  // pickMissing (advent doors): from any map, only missing ones
  for (let i = 0; i < 50; i += 1) assert.ok(!k.xmas.found.includes(pickMissing(k.xmas.found, rng(`p${i}`))));
  assert.equal(ORNAMENTS.find((o) => o.id === pickMissing([], () => 0.3, { rarity: 'super' })).rarity, 'super');
  assert.equal(pickMissing(ORNAMENTS.map((o) => o.id)), null);
});

test('grantOrnament: rolls on the map and gives it (doubles to tinsel)', () => {
  const k = kid('k', { xmas: { found: meadow } });
  const res = grantOrnament(k, 'bg-meadow', rng('x'));
  assert.equal(res.kind, 'tinsel');
  assert.equal(k.xmas.tinsel, 1);
});

// ---------- presents ----------

const fam = () => {
  const a = kid('a', { xmas: { found: ['orn-acorn', 'orn-owl', 'orn-moose'] } });
  const b = kid('b', { buddy: { species: 'bear', outfit: {} }, buddyOwned: { bear: ['hat-cap-blue'] }, xmas: { found: ['orn-acorn'] } });
  return { a, b, bBuddy: { id: 'b', name: 'B', buddy: b.buddy, owned: b.owned, buddyOwned: b.buddyOwned, xmasFound: b.xmas.found } };
};

test('presents are wrapped 1-23 Dec and open from 25 Dec through January', () => {
  assert.equal(canWrap('2026-11-30'), false);
  assert.equal(canWrap('2026-12-01'), true);
  assert.equal(canWrap('2026-12-23'), true);
  assert.equal(canWrap('2026-12-24'), false);
  const g = { year: '2026' };
  assert.equal(canUnwrap(g, '2026-12-24'), false);
  assert.equal(canUnwrap(g, '2026-12-25'), true);
  assert.equal(canUnwrap(g, '2027-01-20'), true, 'still in January');
  assert.equal(canUnwrap(g, '2027-02-01'), false);
  assert.equal(canUnwrap({ ...g, opened: '2026-12-25' }, '2026-12-26'), false);
});

test('the catalogue: 20-60 coins, accessories the sibling lacks, the giver\'s ornaments, seed packets', () => {
  const { a, bBuddy } = fam();
  const cat = giftCatalogue(a, bBuddy, rng('cat'));
  assert.ok(cat.every((c) => c.cost >= GIFT_MIN && c.cost <= GIFT_MAX), JSON.stringify(cat.map((c) => c.cost)));
  const colors = cat.filter((c) => c.kind === 'color');
  assert.equal(colors.length, 3);
  for (const c of colors) { const i = itemById(c.item); assert.ok(i.base && i.color); assert.notEqual(c.item, 'hat-cap-blue', 'one the bear has'); }
  const orns = cat.filter((c) => c.kind === 'ornament').map((c) => c.item);
  assert.equal(orns.length, 3);
  assert.equal(orns[2], 'orn-acorn', 'one the sibling has comes last');
  assert.deepEqual(cat.filter((c) => c.kind === 'seed').map((c) => c.cost), [20, 25, 40]);
  // the same every time it opens
  assert.deepEqual(giftCatalogue(a, bBuddy, rng('cat')), cat);
});

test('one present for each sibling a year: coins checked and spent, a parent gives one free', () => {
  const { a, b, bBuddy } = fam();
  const choice = giftCatalogue(a, bBuddy, rng('c')).find((c) => c.kind === 'ornament');
  assert.match(wrapGift(a, bBuddy, choice, 'stars', '2026-12-24', { coins: 100 }).error, /23 December/);
  assert.match(wrapGift(a, bBuddy, choice, 'stars', '2026-12-10', { coins: 1 }).error, /coins/);
  assert.match(wrapGift(a, { id: 'a' }, choice, 'stars', '2026-12-10', { coins: 100 }).error, /Who/);
  const { gift } = wrapGift(a, bBuddy, choice, 'stars', '2026-12-10', { coins: 100 });
  assert.equal(gift.id, '2026-a-b');
  assert.equal(gift.shape, 'round');
  assert.equal(a.spent, choice.cost);
  assert.equal(giftSent(a, 'b', '2026-12-11'), true);
  assert.match(wrapGift(a, bBuddy, choice, 'stars', '2026-12-11', { coins: 100 }).error, /already/);
  assert.equal(receiveGift(b, gift), true);
  assert.equal(receiveGift(b, gift), false, 'once');
  // the family list marks who has theirs
  const list = giftList(a, [{ id: 'a' }, { id: 'b' }, { id: 'c' }], '2026-12-11');
  assert.deepEqual(list.map((x) => [x.id, x.sent]), [['b', true], ['c', false]]);
  // a parent wraps one in the little one's name: free
  const little = kid('l');
  const seed = giftCatalogue(little, bBuddy, rng('l')).find((c) => c.kind === 'seed');
  const p = wrapGift(little, bBuddy, seed, 'plaid', '2026-12-12', { coins: 0, byParent: true });
  assert.equal(p.gift.by, 'parent');
  assert.equal(little.spent, 0);
  // a copy of an ornament the giver doesn't have is refused
  assert.match(wrapGift(kid('z'), bBuddy, { kind: 'ornament', item: 'orn-owl', cost: 60 }, 'candy', '2026-12-12', { coins: 100 }).error, /only give/);
});

test('unwrapping from Christmas morning gives what is inside', () => {
  const { a, b, bBuddy } = fam();
  const cat = giftCatalogue(a, bBuddy, rng('u'));
  const orn = cat.find((c) => c.kind === 'ornament' && c.item === 'orn-owl') || { kind: 'ornament', item: 'orn-owl', n: 1, cost: 60 };
  const { gift } = wrapGift(a, bBuddy, orn, 'candy', '2026-12-02', { coins: 999 });
  receiveGift(b, gift);
  assert.equal(xmasHouse({ kids: [] }, b, '2026-12-20').gifts[0].open, false);
  assert.equal(unwrapGift(b, gift.id, '2026-12-24'), null, 'not before Christmas');
  assert.equal(xmasHouse({ kids: [] }, b, '2026-12-25').gifts[0].open, true);
  const res = unwrapGift(b, gift.id, '2026-12-25');
  assert.deepEqual(res.got, { kind: 'ornament', item: 'orn-owl' });
  assert.ok(b.xmas.found.includes('orn-owl'));
  assert.equal(b.xmasGifts[gift.id].opened, '2026-12-25');
  assert.equal(unwrapGift(b, gift.id, '2026-12-26'), null, 'once');
  assert.equal(xmasHouse({ kids: [] }, b, '2026-12-26').gifts.length, 0);

  // a color accessory goes to the buddy; seeds into the garden; one owned meanwhile turns into coins
  const c = kid('c', { buddy: { species: 'bear', outfit: {} } });
  const color = cat.find((x) => x.kind === 'color');
  const seed = cat.find((x) => x.kind === 'seed');
  receiveGift(c, { id: 'g1', year: '2026', kind: 'color', item: color.item, n: 1, cost: color.cost });
  receiveGift(c, { id: 'g2', year: '2026', kind: 'seed', item: seed.item, n: seed.n, cost: seed.cost });
  receiveGift(c, { id: 'g3', year: '2026', kind: 'color', item: color.item, n: 1, cost: 30 });
  assert.equal(unwrapGift(c, 'g1', '2027-01-03').got.kind, 'color');
  assert.ok(ownedFor(c).includes(color.item));
  assert.equal(unwrapGift(c, 'g2', '2027-01-03').got.n, seed.n);
  assert.equal(c.garden.seeds[seed.item], seed.n);
  assert.deepEqual(unwrapGift(c, 'g3', '2027-01-03').got, { kind: 'coins', item: color.item, coins: 30 });
  assert.equal(c.spent, -30);
});

test('the house: presents under the tree in December, still there in January with the tree packed away', () => {
  const k = kid('k', { xmas: { found: ['orn-acorn'] } });
  receiveGift(k, { id: '2026-a-k', year: '2026', kind: 'seed', item: 'seed-rose', n: 3, cost: 20, shape: 'tall', paper: 'dots', fromName: 'Ava', fromBuddy: 'fox' });
  const dec = xmasHouse({ kids: [] }, k, '2026-12-14');
  assert.equal(dec.gifts[0].from, "Ava's fox");
  assert.ok(dec.tree);
  const jan = xmasHouse({ kids: [] }, k, '2027-01-05');
  assert.equal(jan.tree, null, 'the tree is packed away');
  assert.equal(jan.gifts.length, 1);
  assert.equal(jan.gifts[0].open, true);
  unwrapGift(k, '2026-a-k', '2027-01-05');
  assert.equal(xmasHouse({ kids: [] }, k, '2027-01-06'), null, 'nothing left in January');
  assert.deepEqual(k.xmas.found, ['orn-acorn'], 'ornaments stay saved');
  // the 3-year-old's tree: big picture baubles
  const little = xmasHouse({ kids: [] }, kid('l', { xmas: { found: ['orn-owl'] } }), '2026-12-14', { little: true });
  assert.equal(little.tree.big[0], 'orn-owl');
  assert.equal(little.tree.big.length, 4);
});

test('ornaments, photo maps and tinsel sync as additions and changes, never a whole old list', () => {
  const mk = (k) => splitState(migrate({ kids: [{ id: 'k1', name: 'Ed', tasks: [], ...k }], log: {} }));
  const before = mk({ xmas: { found: ['orn-acorn'], tinsel: 2, photo: [] } });
  const after = mk({ xmas: { found: ['orn-acorn', 'orn-owl'], tinsel: 3, photo: ['2026:bg-meadow'] }, xmasGifts: { '2026-a-k1': { id: '2026-a-k1' } } });
  const plan = planWrites(diffDocs(before, after), before, after);
  const fields = Object.fromEntries(plan.find((w) => w.path === 'kids/k1').fields.map(([p, v]) => [p.join('.'), v]));
  assert.deepEqual(fields['xmas.found'], new AddTo(['orn-owl']));
  assert.deepEqual(fields['xmas.photo'], new AddTo(['2026:bg-meadow']));
  assert.deepEqual(fields['xmas.tinsel'], new Increase(1));
  assert.ok(fields['xmasGifts.2026-a-k1'], 'a present is its own field');
});

test('a kid\'s first ornament or first present is sent a field at a time', () => {
  const mk = (k) => splitState(migrate({ kids: [{ id: 'k1', name: 'Ed', tasks: [], ...k }], log: {} }));
  const before = mk({});
  const after = mk({ xmas: { found: ['orn-owl'], tinsel: 1 }, xmasGifts: { '2026-a-k1': { id: '2026-a-k1' } } });
  const plan = planWrites(diffDocs(before, after), before, after);
  const fields = Object.fromEntries(plan.find((w) => w.path === 'kids/k1').fields.map(([p, v]) => [p.join('.'), v]));
  assert.deepEqual(Object.keys(fields).sort(), ['xmas.found', 'xmas.tinsel', 'xmasGifts.2026-a-k1']);
  assert.deepEqual(fields['xmas.found'], new AddTo(['orn-owl']));
});
