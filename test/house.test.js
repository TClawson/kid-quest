import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, addDays, snapshotToday } from '../js/logic.js';
import { HOUSE_CHORES, houseRole, setHouseRole, houseTask, houseChores, floorDays, messLevel, shelfLevel, isInside, setInside } from '../js/houserules.js';
import { FURNITURE, HOME_SPOTS, homeLayout, placeFurniture, isPlaced, furnitureById } from '../js/furniture.js';
import { ITEMS, SLOTS, isUnlocked, LEGACY_LEVEL, addOwned } from '../js/items.js';
import { weekOf, recordWeekBest, weekBest, leaderboard, BOARD_GAMES } from '../js/leaderboard.js';

const day = '2026-11-11'; // a Wednesday

function kidWith(tasks) {
  const s = emptyState();
  const kid = { id: 'k1', name: 'Ava', tasks, startDate: addDays(day, -30), owned: [] };
  s.kids.push(kid);
  return { s, kid };
}
const mark = (s, key, task, status = 'done') => { s.log[key] ||= {}; s.log[key].k1 ||= { tasks: {} }; s.log[key].k1.tasks[task.id] = { status }; };

// ---------- house chores (linked by the parents, never guessed) ----------

test('the house only reads task.house, never the name', () => {
  const plain = [{ id: 'a', name: 'Make bed', period: 'morning', days: [0, 1, 2, 3, 4, 5, 6] }, { id: 'b', name: 'Brush teeth', period: 'morning', days: [0, 1, 2, 3, 4, 5, 6] }, { id: 'c', name: 'Clean bedroom floor', period: 'morning', days: [0, 1, 2, 3, 4, 5, 6] }];
  const { s, kid } = kidWith(plain);
  const h = houseChores(s, kid, day);
  assert.deepEqual([h.bed, h.teeth, h.floor, h.mess], [null, null, null, 0], 'unlinked tasks leave the house tidy');
  assert.equal(houseRole(plain[0]), null);
  plain[1].house = 'teeth';
  assert.equal(houseRole(plain[1]), 'teeth');
  assert.equal(houseChores(s, kid, day).teeth.id, 'b');
  // a weird name still works once linked
  plain[2].name = 'Operation Lego';
  plain[2].house = 'floor';
  assert.equal(houseChores(s, kid, day).floor.name, 'Operation Lego');
  assert.equal(houseRole({ house: 'roof' }), null, 'unknown roles are ignored');
});

test('only one task per kid holds each house role', () => {
  const tasks = [{ id: 'a', name: 'Make bed', house: 'bed' }, { id: 'b', name: 'Tidy bunk' }, { id: 'c', name: 'Teeth', house: 'teeth' }];
  const cleared = setHouseRole(tasks, 'b', 'bed');
  assert.deepEqual(cleared.map((t) => t.id), ['a']);
  assert.equal(tasks[0].house, undefined);
  assert.equal(tasks[1].house, 'bed');
  assert.equal(tasks[2].house, 'teeth', 'other roles stay');
  assert.deepEqual(setHouseRole(tasks, 'b', null), []);
  assert.equal('house' in tasks[1], false, 'unlinking removes the field');
  assert.deepEqual(setHouseRole(tasks, 'zzz', 'bed'), []);
});

test('house presets make linked morning tasks; new kids start linked', () => {
  for (const c of HOUSE_CHORES) {
    const t = houseTask(c.id, `t-${c.id}`);
    assert.equal(t.house, c.id);
    assert.equal(t.period, 'morning');
    assert.equal(t.name, c.name);
  }
  const roles = defaultTasks().map((t) => t.house).filter(Boolean).sort();
  assert.deepEqual(roles, ['bed', 'floor', 'teeth']);
});

test('a chore counts once the kid says it is done (a parent may still check it)', () => {
  const tasks = defaultTasks();
  const { s, kid } = kidWith(tasks);
  const bed = tasks.find((t) => t.house === 'bed');
  const teeth = tasks.find((t) => t.house === 'teeth');
  mark(s, day, bed, 'pending');
  mark(s, day, teeth, 'done');
  const h = houseChores(s, kid, day);
  assert.equal(h.bed.done, true);
  assert.equal(h.teeth.done, true);
  assert.equal(h.floor.done, false);
});

test('the floor gets messier the longer it goes', () => {
  const tasks = defaultTasks();
  const floor = tasks.find((t) => t.house === 'floor');
  const { s, kid } = kidWith(tasks);
  mark(s, addDays(day, -1), floor);
  assert.equal(floorDays(s, kid, day), 1);
  mark(s, day, floor);
  assert.equal(floorDays(s, kid, day), 0, 'done today: tidy');
  delete s.log[day];
  delete s.log[addDays(day, -1)];
  mark(s, addDays(day, -3), floor);
  assert.equal(floorDays(s, kid, day), 3);
  // an excused day doesn't count, and neither does a day the task wasn't on the list
  s.log[addDays(day, -1)] = { k1: { tasks: {}, excused: true } };
  assert.equal(floorDays(s, kid, day), 2);
  floor.days = [1, 2, 3, 4, 5]; // weekdays only: Sunday (day - 3) is now off
  delete s.log[addDays(day, -3)];
  mark(s, addDays(day, -4), floor); // Saturday... also off, so keep looking back
  mark(s, addDays(day, -5), floor); // Friday: done
  assert.equal(floorDays(s, kid, day), 2, 'today and Monday (Tuesday excused, the weekend off)');
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(messLevel), [0, 1, 2, 2, 3, 3]);
});

test('past days find the floor task by id even before it was linked', () => {
  const tasks = defaultTasks().map(({ house, ...t }) => t);
  const { s, kid } = kidWith(tasks);
  kid.startDate = addDays(day, -2);
  // yesterday's snapshot was taken before the parent linked it
  snapshotToday(s, kid, addDays(day, -1));
  snapshotToday(s, kid, addDays(day, -2));
  const floor = tasks.find((t) => t.name === 'Clear bedroom floor');
  setHouseRole(kid.tasks, floor.id, 'floor');
  assert.equal(floorDays(s, kid, day), 3);
  assert.equal(houseChores(s, kid, day).mess, 2);
});

test('a kid with no floor chore always has a tidy floor', () => {
  const { s, kid } = kidWith([{ id: 'x', name: 'Piano', period: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6] }]);
  assert.equal(floorDays(s, kid, day), 0);
});

test('trophy shelf: empty, a few, mostly full, full', () => {
  assert.deepEqual([0, 1, 7, 8, 14, 15, 20].map((n) => shelfLevel(n, 15)), [0, 1, 1, 2, 2, 3, 3]);
});

test('inside or outside: a new day starts inside, otherwise it stays where it was left', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(isInside('k1', day, storage), false, 'the very first time, outside by the house');
  setInside('k1', day, true, storage);
  assert.equal(isInside('k1', day, storage), true);
  setInside('k1', day, false, storage);
  assert.equal(isInside('k1', day, storage), false);
  assert.equal(isInside('k1', addDays(day, 1), storage), true, 'the next morning, inside');
  assert.equal(isInside('k2', day, storage), false, 'each kid on their own');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(isInside('k1', day, broken), false, 'no storage: still works');
});

// ---------- furniture ----------

test('furniture is in the shop under Home, with unique ids, and shared by every buddy', () => {
  assert.ok(SLOTS.some((s) => s.id === 'home'));
  const ids = new Set(ITEMS.map((i) => i.id));
  for (const f of FURNITURE) {
    assert.ok(ids.has(f.id), f.id);
    assert.ok(HOME_SPOTS.some((s) => s.id === f.spot), f.id);
    assert.equal(LEGACY_LEVEL(f), Infinity, 'never handed out free to old kids');
    if (f.price) assert.ok(f.price >= 30 && f.price <= 400, f.id);
  }
  for (const spot of ['bed', 'table', 'couch', 'chair', 'corner', 'lamp', 'rug', 'art']) assert.ok(FURNITURE.filter((f) => f.spot === spot && f.price).length >= 3, spot);
  const kid = { owned: [], buddy: { species: 'fox', outfit: {} } };
  addOwned(kid, furnitureById('home-couch'));
  assert.deepEqual(kid.owned, ['home-couch'], 'furniture belongs to the kid, not one buddy');
  assert.equal(isUnlocked(furnitureById('home-bed-basic'), { owned: [] }), true, 'basic bed is free');
  assert.equal(isUnlocked(furnitureById('home-couch-red-plain'), { owned: ['home-couch'] }), false, 'each version is bought on its own');
});

test('placing furniture: one piece a spot, basic bed and table are the fallback', () => {
  const kid = { owned: ['home-couch', 'home-bed-quilt'], home: {} };
  let lay = homeLayout(kid);
  assert.equal(lay.bed.id, 'home-bed-basic');
  assert.equal(lay.table.id, 'home-table-basic');
  assert.equal(lay.couch, null);
  kid.home = placeFurniture(kid, furnitureById('home-couch'));
  kid.home = placeFurniture(kid, furnitureById('home-bed-quilt'));
  lay = homeLayout(kid);
  assert.equal(lay.couch.id, 'home-couch');
  assert.equal(lay.bed.id, 'home-bed-quilt');
  assert.ok(isPlaced(kid, furnitureById('home-couch')));
  kid.home = placeFurniture(kid, furnitureById('home-couch'));
  assert.equal(homeLayout(kid).couch, null, 'tap again to take it out');
  kid.home = placeFurniture(kid, furnitureById('home-bed-quilt'));
  assert.equal(homeLayout(kid).bed.id, 'home-bed-basic', 'the bed goes back to the basic one');
  kid.home = placeFurniture(kid, furnitureById('home-bed-basic'));
  assert.equal(homeLayout(kid).bed.id, 'home-bed-basic', 'the basic bed stays');
  assert.equal(homeLayout({ owned: [], home: { couch: 'home-couch', bed: 'nope' } }).couch, null, 'pieces not owned are left out');
});

// ---------- leaderboard ----------

test('weeks run Sunday to Saturday', () => {
  assert.equal(weekOf('2026-11-08'), '2026-11-08'); // a Sunday
  assert.equal(weekOf('2026-11-14'), '2026-11-08'); // Saturday
  assert.equal(weekOf('2026-11-15'), '2026-11-15');
});

test('weekly bests only go up, and reset on Sunday', () => {
  let kid = { gameBests: null };
  kid.gameBests = recordWeekBest(kid, 'soccer', 12, '2026-11-10');
  kid.gameBests = recordWeekBest(kid, 'soccer', 9, '2026-11-11');
  kid.gameBests = recordWeekBest(kid, 'tag', 20.5, '2026-11-11');
  assert.deepEqual(kid.gameBests, { week: '2026-11-08', best: { soccer: 12, tag: 20.5 } });
  const same = recordWeekBest(kid, 'soccer', 3, '2026-11-12');
  assert.equal(same, kid.gameBests, 'no change, same object');
  assert.equal(weekBest(kid, 'soccer', '2026-11-14'), 12);
  assert.equal(weekBest(kid, 'soccer', '2026-11-15'), 0, 'a new week');
  kid = { ...kid, gameBests: recordWeekBest(kid, 'hockey', 2, '2026-11-15') };
  assert.deepEqual(kid.gameBests, { week: '2026-11-15', best: { hockey: 2 } });
});

test('the leaderboard lists every kid, best first, sharing places on ties', () => {
  const kids = [
    { id: 'a', name: 'Ava', playBest: { soccer: 30, tag: 12 }, gameBests: { week: '2026-11-08', best: { soccer: 10 } } },
    { id: 'b', name: 'Ben', playBest: { soccer: 30 }, gameBests: { week: '2026-11-01', best: { soccer: 50 } } },
    { id: 'c', name: 'Cy', playBest: { soccer: 41 }, gameBests: { week: '2026-11-08', best: { soccer: 15 } } },
  ];
  const all = leaderboard(kids, 'all', '2026-11-11');
  assert.equal(all.length, BOARD_GAMES.length);
  const soccer = all.find((g) => g.game.id === 'soccer').rows;
  assert.deepEqual(soccer.map((r) => [r.name, r.score, r.place]), [['Cy', 41, 1], ['Ava', 30, 2], ['Ben', 30, 2]]);
  const week = leaderboard(kids, 'week', '2026-11-11').find((g) => g.game.id === 'soccer').rows;
  assert.deepEqual(week.map((r) => [r.name, r.score, r.place]), [['Cy', 15, 1], ['Ava', 10, 2], ['Ben', 0, 0]], "last week's scores don't count");
  const hockey = all.find((g) => g.game.id === 'hockey').rows;
  assert.ok(hockey.every((r) => r.place === 0 && r.score === 0), 'nobody has played: everyone listed with no score');
});
