import { test } from 'node:test';
import assert from 'node:assert/strict';
import { villageLayout, VILLAGE_THEMES } from '../js/villagemaps.js';
import { placeVillagers, folkCaps, activeQuest, makeGrid, findPath, standSpot, visitorSpots } from '../js/village.js';
import { secretSize } from '../js/treasure-art.js';
import { MAP_THEMES } from '../js/maparts.js';

const task = (i, period, name = `Chore ${i}`) => ({ id: `t${i}`, name, period, st: 'todo' });

test('every map has a village', () => {
  assert.deepEqual([...VILLAGE_THEMES].sort(), Object.keys(MAP_THEMES).sort());
});

// Every place a kid needs to reach can be walked to from where the buddy starts, with
// every villager, visitor, pond, the shopkeeper and the landmark standing in the way.
for (const theme of VILLAGE_THEMES) {
  test(`${theme}: every quest, the chest, the shop, the green and the landmark can be reached`, () => {
    const L = villageLayout(theme);
    const size = secretSize(theme);
    const lm = { ...L.landmark, w: size.w * 2, h: size.h * 2 };
    const folk = [...L.slots.morning.slice(0, 6), ...L.slots.afternoon.slice(0, 6)];
    // the busiest green: a pond and a play patch, four visitors
    const visit = { visitors: ['a', 'b', 'c', 'd'].map((id) => ({ id })), areas: [{ side: 'left', kind: 'pond', members: ['a', 'b'] }, { side: 'right', kind: 'soccer', members: ['c'] }] };
    const spots = visitorSpots(visit, L);
    const grid = makeGrid(L, folk, [
      [L.green.left.x - 2, L.green.left.y - 2, L.green.left.w + 4, L.green.left.h + 4],
      ...Object.values(spots).map((p) => [p.x - 7, p.y - 8, 14, 10]),
      [L.shop.x - 7, L.shop.y - 8, 14, 10],
      [lm.x + 8, lm.y + lm.h * 0.5, lm.w - 16, lm.h * 0.45],
    ]);
    const from = L.start;
    const reach = (what, to) => {
      const path = findPath(grid, from, to);
      assert.ok(path.length, `${theme}: can't walk to ${what} at ${to.x},${to.y}`);
      const end = path[path.length - 1];
      assert.ok(Math.hypot(end.x - to.x, end.y - to.y) < 14, `${theme}: ${what} ends ${Math.round(Math.hypot(end.x - to.x, end.y - to.y))} px away`);
    };
    folk.forEach((s, i) => reach(`quest spot ${i}`, standSpot(grid, s.x, s.y, from.x)));
    reach('the shopkeeper', standSpot(grid, L.shop.x, L.shop.y, from.x));
    reach('the chest', standSpot(grid, L.chest.x, L.chest.y, from.x));
    reach('the landmark', L.landmark.stand);
    Object.entries(spots).forEach(([id, sp]) => reach(`visitor ${id}`, sp.role === 'fish' ? { x: sp.x - sp.face * 22, y: sp.y + 2 } : standSpot(grid, sp.x, sp.y, from.x)));
    reach('the play patch', { x: L.green.right.x + L.green.right.w / 2, y: L.green.right.y + L.green.right.h + 12 });
  });

  test(`${theme}: quest spots stand on open ground, apart from each other and the green`, () => {
    const L = villageLayout(theme);
    const size = secretSize(theme);
    const lm = [L.landmark.x, L.landmark.y, size.w * 2, size.h * 2];
    const all = [...L.slots.morning.slice(0, 6).map((s) => ({ ...s, what: 'morning' })), ...L.slots.afternoon.slice(0, 6).map((s) => ({ ...s, what: 'afternoon' })), { ...L.shop, what: 'shop' }, { ...L.chest, what: 'chest' }];
    const inBox = (x, y, [bx, by, bw, bh], pad = 0) => x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad;
    for (const s of all) {
      assert.ok(!L.blocked(s.x, s.y), `${theme}: ${s.what} spot ${s.x},${s.y} is blocked`);
      for (const side of ['left', 'right']) { const g = L.green[side]; assert.ok(!inBox(s.x, s.y, [g.x, g.y, g.w, g.h], 8), `${theme}: ${s.what} ${s.x},${s.y} is on the green`); }
      assert.ok(!inBox(s.x, s.y, lm, 4), `${theme}: ${s.what} ${s.x},${s.y} is on the landmark`);
      for (const o of all) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.y - s.y) >= 24, `${theme}: ${s.what} ${s.x},${s.y} is too close to ${o.what} ${o.x},${o.y}`);
    }
    assert.ok(lm[0] >= 0 && lm[0] + lm[2] <= L.W && lm[1] + lm[3] <= L.H, `${theme}: the landmark fits`);
    // visitors don't stand in water or walls, and fishers have room on both sides of the pond
    for (const s of L.green.idle) assert.ok(!L.blocked(s.x, s.y), `${theme}: idle visitor spot ${s.x},${s.y} is blocked`);
    assert.ok(L.green.left.x >= 50 && L.green.right.x + L.green.right.w <= L.W - 50, `${theme}: the green leaves room for fishers`);
    for (const side of ['left', 'right']) { const g = L.green[side]; for (const [x, y] of [[g.x, g.y], [g.x + g.w, g.y], [g.x, g.y + g.h], [g.x + g.w, g.y + g.h]]) assert.ok(!L.inWater(x, y, 2) && !L.blockedHard(x, y), `${theme}: the ${side} play spot runs into something at ${x},${y}`); }
  });
}

test('a busy day gives some villagers more than one quest, in plan order', () => {
  const tasks = [...Array.from({ length: 7 }, (_, i) => task(i, 'morning')), ...Array.from({ length: 7 }, (_, i) => task(i + 7, 'afternoon'))];
  tasks[1].name = 'Brush teeth'; tasks[4].name = 'Floss';
  const folk = placeVillagers(tasks, villageLayout('bg-meadow'));
  assert.equal(folk.length, 8);
  assert.equal(new Set(folk.map((p) => p.kind)).size, 8, 'no villager twice');
  assert.equal(folk.reduce((n, p) => n + p.tasks.length, 0), 14, 'every quest is given');
  const beaver = folk.find((p) => p.kind === 'beaver');
  assert.deepEqual(beaver.tasks.map((t) => t.name), ['Brush teeth', 'Floss'], 'teeth then floss, from the beaver');
  for (const p of folk) for (let i = 1; i < p.tasks.length; i += 1) assert.ok(tasks.indexOf(p.tasks[i - 1]) < tasks.indexOf(p.tasks[i]));
});

test('a light day keeps one quest per villager', () => {
  const tasks = [task(0, 'morning'), task(1, 'morning'), task(2, 'afternoon')];
  const folk = placeVillagers(tasks, villageLayout('bg-ocean'));
  assert.deepEqual(folk.map((p) => p.tasks.length), [1, 1, 1]);
});

test('villager counts per half of the day', () => {
  assert.deepEqual(folkCaps(3, 4), [3, 4]);
  assert.deepEqual(folkCaps(10, 0), [6, 0]);
  const [a, b] = folkCaps(9, 9);
  assert.ok(a + b <= 8 && a >= 2 && b >= 2);
});

test('a villager works through its quests: next one up, waiting ones last', () => {
  assert.equal(activeQuest([{ st: 'done' }, { id: 'b', st: 'todo' }]).id, 'b');
  assert.equal(activeQuest([{ id: 'a', st: 'pending' }, { id: 'b', st: 'todo' }]).id, 'b');
  assert.equal(activeQuest([{ id: 'a', st: 'pending' }, { st: 'done' }]).id, 'a');
});

test('piano quests go to the music hall on every map', () => {
  for (const theme of VILLAGE_THEMES) {
    const L = villageLayout(theme);
    const folk = placeVillagers([task(0, 'afternoon', 'Homework'), task(1, 'afternoon', 'Piano practice')], L);
    const piano = folk.find((p) => p.tasks[0].name === 'Piano practice');
    const hall = L.slots.afternoon.find((s) => s.likes?.test('piano'));
    assert.deepEqual([piano.x, piano.y], [hall.x, hall.y], theme);
  }
});
