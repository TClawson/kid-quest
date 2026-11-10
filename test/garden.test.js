import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, addDays } from '../js/logic.js';
import {
  SEEDS, KINDS, DECOR, GARDEN_SPOTS, seedById, gardenOf, plant, digUp, relink, harvest, plantInfo, sellPrice,
  houseHarvest, gardenView, gardenLayout, placeDecor, watered, setWatered, thirsty, BEDS, TREES,
} from '../js/gardenrules.js';
import { itemById } from '../js/items.js';

const day = '2026-11-11'; // a Wednesday
const every = [0, 1, 2, 3, 4, 5, 6];

function setup() {
  const s = emptyState();
  const kid = { id: 'k1', name: 'Ava', tasks: [{ id: 'bed', name: 'Make bed', period: 'morning', days: every }, { id: 'run', name: 'Run', period: 'exercise', days: every }], startDate: addDays(day, -200), owned: [], spent: 0 };
  s.kids.push(kid);
  return { s, kid };
}
const mark = (s, key, id = 'bed', status = 'done') => { s.log[key] ||= {}; s.log[key].k1 ||= { tasks: {} }; s.log[key].k1.tasks[id] = { status }; };
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('planting pays for the seed and needs a chore and the right spot', () => {
  const { kid } = setup();
  assert.equal(plant(kid, 'beds', 0, 'seed-tulip', 'nope', day), 'Pick one of your chores for it.');
  assert.equal(plant(kid, 'beds', 0, 'seed-tulip', 'run', day), 'Pick one of your chores for it.', 'not the bonus exercise');
  assert.match(plant(kid, 'beds', 0, 'seed-apple', 'bed', day), /tree spots/);
  assert.match(plant(kid, 'trees', 0, 'seed-tulip', 'bed', day), /beds/);
  assert.equal(plant(kid, 'beds', 0, 'seed-tulip', 'bed', day), null);
  assert.equal(kid.spent, 5);
  assert.match(plant(kid, 'beds', 0, 'seed-carrot', 'bed', day), /already/);
  const g = gardenOf(kid);
  assert.equal(g.beds.length, BEDS);
  assert.equal(g.trees.length, TREES);
  assert.deepEqual(g.beds[0], { id: 'p1', seed: 'seed-tulip', task: 'bed', planted: day });
});

test('seeds are cheap: flowers 5, vegetables 10, trees 25', () => {
  for (const s of SEEDS) assert.equal(s.price, { flower: 5, veg: 10, tree: 25 }[s.kind]);
});

test('a plant grows one step per day its chore is marked done, and today counts once done', () => {
  const { s, kid } = setup();
  const start = addDays(day, -5);
  plant(kid, 'beds', 0, 'seed-tulip', 'bed', start);
  for (let i = 5; i >= 1; i -= 1) mark(s, addDays(day, -i), 'bed', i === 3 ? 'todo' : 'pending'); // pending counts
  let info = plantInfo(s, kid, gardenOf(kid).beds[0], day);
  assert.equal(info.done, 4);
  assert.equal(info.scheduled, 5);
  assert.equal(info.ripe, false);
  mark(s, day);
  info = plantInfo(s, kid, gardenOf(kid).beds[0], day);
  assert.equal(info.done, 5);
  assert.ok(info.doneToday);
});

test('a missed day droops it until the chore is done again, and never kills it', () => {
  const { s, kid } = setup();
  plant(kid, 'beds', 0, 'seed-carrot', 'bed', addDays(day, -3));
  mark(s, addDays(day, -3)); mark(s, addDays(day, -2));
  let info = plantInfo(s, kid, gardenOf(kid).beds[0], day);
  assert.ok(info.droopy, 'yesterday was missed');
  assert.equal(info.done, 2);
  mark(s, day);
  info = plantInfo(s, kid, gardenOf(kid).beds[0], day);
  assert.ok(!info.droopy, 'perks up once done today');
  // an excused day doesn't droop it
  const { s: s2, kid: k2 } = setup();
  plant(k2, 'beds', 0, 'seed-carrot', 'bed', addDays(day, -3));
  mark(s2, addDays(day, -2));
  s2.log[addDays(day, -1)] = { k1: { tasks: {}, excused: true } };
  assert.ok(!plantInfo(s2, k2, gardenOf(k2).beds[0], day).droopy);
  // planted today: nothing to droop about
  const { s: s3, kid: k3 } = setup();
  plant(k3, 'beds', 1, 'seed-carrot', 'bed', day);
  assert.ok(!plantInfo(s3, k3, gardenOf(k3).beds[1], day).droopy);
});

test('stages climb to ripe: flowers in 7 done-days, vegetables in 21', () => {
  for (const [seed, days] of [['seed-daisy', 7], ['seed-pumpkin', 21]]) {
    const { s, kid } = setup();
    plant(kid, 'beds', 0, seed, 'bed', addDays(day, -(days - 1)));
    const seen = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      mark(s, addDays(day, -i));
      seen.push(plantInfo(s, kid, gardenOf(kid).beds[0], addDays(day, -i)));
    }
    const K = KINDS[seedById(seed).kind];
    assert.ok(seen.slice(0, -1).every((x) => !x.ripe && x.stage < K.stages - 1));
    assert.ok(seen.at(-1).ripe);
    assert.equal(seen.at(-1).stage, K.stages - 1);
    for (let i = 1; i < seen.length; i += 1) assert.ok(seen[i].stage >= seen[i - 1].stage);
  }
});

test('harvest: keep puts it in the house for a while, sell gives about the seed price', () => {
  const { s, kid } = setup();
  plant(kid, 'beds', 0, 'seed-tulip', 'bed', addDays(day, -6));
  plant(kid, 'beds', 1, 'seed-sunflower', 'bed', addDays(day, -6));
  assert.equal(harvest(s, kid, 0, 'keep', day), 'Not grown yet.');
  for (let i = 6; i >= 0; i -= 1) mark(s, addDays(day, -i));
  const spent = kid.spent;
  const sold = harvest(s, kid, 1, 'sell', day);
  assert.equal(sold.coins, 6, 'every day done: 15% more, rounded');
  assert.equal(kid.spent, spent - 6);
  assert.equal(gardenOf(kid).beds[1], null);
  const kept = harvest(s, kid, 0, 'keep', day);
  assert.equal(kept.kept.until, addDays(day, 6), 'flowers stay a week');
  assert.deepEqual(houseHarvest(s, kid, addDays(day, 6)).vases, ['seed-tulip']);
  assert.deepEqual(houseHarvest(s, kid, addDays(day, 7)).vases, []);
  // vegetables stay two weeks
  plant(kid, 'beds', 2, 'seed-carrot', 'bed', addDays(day, -20));
  for (let i = 20; i >= 0; i -= 1) mark(s, addDays(day, -i));
  harvest(s, kid, 2, 'keep', day);
  assert.deepEqual(houseHarvest(s, kid, addDays(day, 13)).baskets, ['seed-carrot']);
  assert.deepEqual(houseHarvest(s, kid, addDays(day, 14)).baskets, []);
});

test('the sell price moves with care, 15% either way', () => {
  const seed = seedById('seed-pumpkin');
  assert.equal(sellPrice({ seed, kind: 'veg', done: 21, scheduled: 21 }), 12);
  assert.equal(sellPrice({ seed, kind: 'veg', done: 21, scheduled: 42 }), 10);
  assert.equal(sellPrice({ seed, kind: 'veg', done: 0, scheduled: 10 }), 9);
  assert.equal(sellPrice({ seed: seedById('seed-apple'), kind: 'tree', done: 60, scheduled: 60 }), 0, 'trees are never sold');
});

test('a fruit tree is never harvested; once grown it fills the house fruit bowl every few days', () => {
  const { s, kid } = setup();
  plant(kid, 'trees', 0, 'seed-apple', 'bed', addDays(day, -70));
  for (let i = 70; i >= 0; i -= 1) mark(s, addDays(day, -i));
  const info = plantInfo(s, kid, gardenOf(kid).trees[0], day);
  assert.ok(info.ripe);
  assert.equal(info.fruit, 1 + Math.floor((71 - 60) / 3));
  assert.equal(harvest(s, kid, 0, 'keep', day), 'Nothing to pick there.', 'beds only');
  assert.deepEqual(houseHarvest(s, kid, day).bowl, Array(4).fill('seed-apple'));
  assert.deepEqual(houseHarvest(s, kid, addDays(day, -30)).bowl, [], 'not grown yet then (no habit star yet either)');
});

test('dig up and relink', () => {
  const { s, kid } = setup();
  plant(kid, 'beds', 3, 'seed-tomato', 'bed', day);
  kid.tasks.push({ id: 'teeth', name: 'Teeth', period: 'morning', days: every });
  assert.ok(relink(kid, 'beds', 3, 'teeth', day));
  assert.equal(gardenOf(kid).beds[3].task, 'teeth');
  kid.tasks = kid.tasks.filter((t) => t.id !== 'teeth');
  assert.equal(plantInfo(s, kid, gardenOf(kid).beds[3], day).task, null, 'its chore is gone');
  assert.ok(digUp(kid, 'beds', 3));
  assert.equal(gardenOf(kid).beds[3], null);
  assert.ok(!digUp(kid, 'beds', 3));
});

test('decorations: basic fence and can are free; bought ones go in their spot', () => {
  const { kid } = setup();
  let lay = gardenLayout(kid);
  assert.equal(lay.fence.id, 'garden-fence-basic');
  assert.equal(lay.can.id, 'garden-can-basic');
  assert.equal(lay.water, null);
  const bath = DECOR.find((d) => d.id === 'garden-birdbath');
  kid.gardenDecor = placeDecor(kid, bath);
  assert.equal(gardenLayout(kid).water, null, 'not owned yet');
  kid.owned.push(bath.id);
  assert.equal(gardenLayout(kid).water.id, bath.id);
  kid.gardenDecor = placeDecor(kid, bath);
  assert.equal(gardenLayout(kid).water, null, 'tapping again takes it out');
  for (const d of DECOR) assert.ok(GARDEN_SPOTS.some((sp) => sp.id === d.spot));
  lay = gardenLayout(kid);
});

test('critters come with blooms, the bee house and the birdbath', () => {
  const { s, kid } = setup();
  assert.deepEqual(gardenView(s, kid, day).critters, { butterflies: 0, bees: 0, bird: false });
  plant(kid, 'beds', 0, 'seed-tulip', 'bed', addDays(day, -6));
  for (let i = 6; i >= 0; i -= 1) mark(s, addDays(day, -i));
  kid.owned.push('garden-beehouse', 'garden-birdbath');
  kid.gardenDecor = { bees: 'garden-beehouse', water: 'garden-birdbath' };
  const c = gardenView(s, kid, day).critters;
  assert.equal(c.butterflies, 1);
  assert.equal(c.bees, 2);
  assert.equal(c.bird, true);
});

test('watering is only for show, per device, and waits for the kid', () => {
  const { s, kid } = setup();
  const st = memStore();
  plant(kid, 'beds', 0, 'seed-tulip', 'bed', day);
  let view = gardenView(s, kid, day);
  assert.deepEqual(thirsty(view, 'k1', day, st), []);
  mark(s, day);
  view = gardenView(s, kid, day);
  assert.deepEqual(thirsty(view, 'k1', day, st), ['p1']);
  setWatered('k1', day, ['p1'], st);
  assert.deepEqual(thirsty(view, 'k1', day, st), []);
  assert.equal(watered('k1', addDays(day, 1), st).size, 0, 'a new day starts dry');
});

test('decorations are not in the buddy shop item list by accident', () => {
  for (const d of DECOR) assert.equal(itemById(d.id)?.slot ?? 'garden', 'garden');
});
