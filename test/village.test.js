import { test } from 'node:test';
import assert from 'node:assert/strict';
import { villageLayout, VILLAGE_THEMES } from '../js/villagemaps.js';
import { placeVillagers, folkCaps, activeQuest, makeGrid, findPath, standSpot, visitorSpots, landmarkBlock, arrowSpots, labelSpot, bubbleSpot, ARROW_BAND, arrivalStart } from '../js/village.js';
import { VILLAGER_KINDS, headRows, villagerGrid } from '../js/villageart.js';
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
    const lm = { ...L.landmark, w: L.landmark.w ?? size.w * 2, h: L.landmark.h ?? size.h * 2 };
    const folk = [...L.slots.morning.slice(0, 6), ...L.slots.afternoon.slice(0, 6), L.coach];
    // the busiest green: a pond and a play patch, four visitors
    const visit = { visitors: ['a', 'b', 'c', 'd'].map((id) => ({ id })), areas: [{ side: 'left', kind: 'pond', members: ['a', 'b'] }, { side: 'right', kind: 'soccer', members: ['c'] }] };
    const spots = visitorSpots(visit, L);
    const grid = makeGrid(L, folk, [
      [L.green.left.x - 2, L.green.left.y - 2, L.green.left.w + 4, L.green.left.h + 4],
      ...Object.values(spots).map((p) => [p.x - 7, p.y - 8, 14, 10]),
      [L.shop.x - 7, L.shop.y - 8, 14, 10],
      landmarkBlock(lm),
    ]);
    const from = L.start;
    const reach = (what, to) => {
      const path = findPath(grid, from, to);
      assert.ok(path.length, `${theme}: can't walk to ${what} at ${to.x},${to.y}`);
      const end = path[path.length - 1];
      assert.ok(Math.hypot(end.x - to.x, end.y - to.y) < 14, `${theme}: ${what} ends ${Math.round(Math.hypot(end.x - to.x, end.y - to.y))} px away`);
    };
    folk.forEach((s, i) => reach(`quest spot ${i}`, standSpot(grid, s.x, s.y, from.x)));
    reach('the coach', standSpot(grid, L.coach.x, L.coach.y, from.x));
    reach('the shopkeeper', standSpot(grid, L.shop.x, L.shop.y, from.x));
    reach('the chest', standSpot(grid, L.chest.x, L.chest.y, from.x));
    reach('the landmark', L.landmark.stand);
    reach('the music house door', L.music.door);
    Object.entries(spots).forEach(([id, sp]) => reach(`visitor ${id}`, sp.role === 'fish' ? { x: sp.x - sp.face * 22, y: sp.y + 2 } : standSpot(grid, sp.x, sp.y, from.x)));
    reach('the play patch', { x: L.green.right.x + L.green.right.w / 2, y: L.green.right.y + L.green.right.h + 12 });
    // each visitor can walk in for the day: from past an edge or from a path, at least a little way off
    for (const [id, sp] of Object.entries(spots)) {
      const start = arrivalStart(L, grid, sp);
      assert.ok(start, `${theme}: visitor ${id} has somewhere to walk in from`);
      assert.ok(Math.hypot(start.x - sp.x, start.y - sp.y) >= 20, `${theme}: visitor ${id} walks in from further off than ${Math.round(Math.hypot(start.x - sp.x, start.y - sp.y))} px`);
      const path = findPath(grid, start, sp);
      const end = path[path.length - 1];
      assert.ok(end && Math.hypot(end.x - sp.x, end.y - sp.y) < 20, `${theme}: visitor ${id} can walk in to its spot`);
    }
  });

  test(`${theme}: quest spots stand on open ground, apart from each other and the green`, () => {
    const L = villageLayout(theme);
    const size = secretSize(theme);
    const lm = [L.landmark.x, L.landmark.y, L.landmark.w ?? size.w * 2, L.landmark.h ?? size.h * 2];
    const all = [...L.slots.morning.slice(0, 6).map((s) => ({ ...s, what: 'morning' })), ...L.slots.afternoon.slice(0, 6).map((s) => ({ ...s, what: 'afternoon' })), { ...L.shop, what: 'shop' }, { ...L.chest, what: 'chest' }, { ...L.coach, what: 'coach' }];
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

// The coach gives the bonus exercise: a villager of its own, on every map, never one of the
// usual villagers.
test('the coach: its own art, 16 pixels wide, and not one of the usual villagers', () => {
  assert.ok(!VILLAGER_KINDS.includes('coach'));
  const grid = villagerGrid('coach');
  assert.ok(grid.every((row) => row.length === 16), 'every row is 16 wide');
  assert.notDeepEqual(grid, villagerGrid('bunny'), 'a body of its own');
  assert.ok(headRows('coach') > 0);
  for (const theme of VILLAGE_THEMES) assert.ok(villageLayout(theme).coach, `${theme} has a coach`);
});

test('arrows to quests off screen sit on the edges, apart, and out of the Today button\'s corner', () => {
  const vw = 400; const vh = 600;
  const list = [
    { id: 'on', sx: 200, sy: 300 },
    { id: 'a', sx: 50, sy: 900 }, { id: 'b', sx: 60, sy: 950 }, { id: 'c', sx: 90, sy: 1000 },
    { id: 'up', sx: 200, sy: -100 },
  ];
  const out = arrowSpots(list, vw, vh, { w: 160, h: 60 });
  assert.deepEqual(out.map((a) => a.id).sort(), ['a', 'b', 'c', 'up'], 'only the ones off screen');
  const bottom = out.filter((a) => a.edge === 'bottom').sort((x, y) => x.left - y.left);
  assert.equal(bottom.length, 3);
  for (const a of bottom) assert.ok(a.left >= 160 + 8 + 26, `${a.id} is clear of the Today button`);
  for (let i = 1; i < bottom.length; i += 1) assert.ok(bottom[i].left - bottom[i - 1].left >= 50, 'and of each other');
  for (const a of out) assert.ok(a.left >= 0 && a.left <= vw && a.top >= 0 && a.top <= vh, `${a.id} is on screen`);
  assert.equal(out.find((a) => a.id === 'up').edge, 'top');
});

test('a visitor\'s speech bubble stays clear of the arrows along the edges and the HUD', () => {
  const vw = 412; const vh = 915;
  const safe = { l: ARROW_BAND, r: vw - ARROW_BAND, t: 110 + ARROW_BAND, b: vh - ARROW_BAND };
  const hud = [{ x: 4, y: 820, w: 180, h: 95 }, { x: 330, y: 830, w: 80, h: 85 }];
  const inside = (r) => r.x >= safe.l && r.x + 140 <= safe.r && r.y >= safe.t && r.y + 40 <= safe.b;
  const clear = (r) => !hud.some((a) => r.x < a.x + a.w && r.x + 140 > a.x && r.y < a.y + a.h && r.y + 40 > a.y);
  // room over the head: it stays there
  assert.deepEqual(bubbleSpot({ cx: 200, top: 400, below: 520, w: 140, h: 40 }, safe, hud), { x: 130, y: 400, below: false });
  // too low (in the arrows' band at the bottom): it moves up just enough
  const low = bubbleSpot({ cx: 260, top: 830, below: 950, w: 140, h: 40 }, safe, hud);
  assert.deepEqual(low, { x: 190, y: vh - ARROW_BAND - 40, below: false });
  // and higher still where it would sit on the Today button
  const lowLeft = bubbleSpot({ cx: 200, top: 830, below: 950, w: 140, h: 40 }, safe, hud);
  assert.ok(lowLeft && !lowLeft.below && inside(lowLeft) && clear(lowLeft), JSON.stringify(lowLeft));
  // under the HUD's top row: it goes under the visitor's feet instead
  const high = bubbleSpot({ cx: 200, top: 100, below: 220, w: 140, h: 40 }, safe, hud);
  assert.ok(high?.below && high.y === 220, JSON.stringify(high));
  // near a side edge: it slides in, and its tail still reaches the visitor
  const side = bubbleSpot({ cx: 80, top: 400, below: 520, w: 140, h: 40 }, safe, hud);
  assert.ok(side.x === ARROW_BAND && side.x <= 80 - 6, JSON.stringify(side));
  // over a HUD button: it steps up or sideways off it
  const hudHit = bubbleSpot({ cx: 100, top: 790, below: 900, w: 140, h: 40 }, safe, hud);
  assert.ok(hudHit && inside(hudHit) && clear(hudHit), JSON.stringify(hudHit));
  // nowhere to go (a visitor in the corner, under the arrows): none, so it keeps quiet
  assert.equal(bubbleSpot({ cx: 20, top: 880, below: 1000, w: 140, h: 40 }, safe, hud), null);
});

test('a quest-time sign moves out from under a speech bubble', () => {
  const L = villageLayout('bg-meadow');
  const sign = [200, 300, 'Morning quests'];
  assert.deepEqual(labelSpot(sign, [], L), sign, 'stays put with nothing in the way');
  const moved = labelSpot(sign, [[185, 296, 30, 12]], L);
  assert.notDeepEqual(moved.slice(0, 2), [200, 300]);
  assert.equal(moved[2], 'Morning quests');
});

test('a quest-time sign stays whole in the view it opens with (a narrow phone)', () => {
  const L = villageLayout('bg-meadow');
  const sign = [158, 216, '⬆ 🌅 Morning quests'];
  // a bubble on the sign's left: a wide view moves it as before; a phone's window keeps it inside
  const win = { l: 151, r: 297 };
  const [x, , text] = labelSpot(sign, [[100, 200, 60, 30]], L, { w: 70, win });
  assert.ok(x - 37 >= win.l && x + 37 <= win.r, `whole in the window (${x})`);
  assert.equal(text, sign[2]);
});
