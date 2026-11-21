// The sled's treasure hill: the shared hills (slopes.js), the finds (finds.js) and the game (sledding.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { HILLS, HILL_IDS, hillFor, snowOfDay, snowWords, SNOW_IDS, SURFACES, makeGround, hillSpeed } from '../js/slopes.js';
import {
  FINDS, ALL_FINDS, FIND_MAPS, findOdds, pickFind, conditionFor, recordFind, findPages, findCount, sizeFor, sizeClass,
  SIZES, findOfDay, findPoints, RARITY,
} from '../js/finds.js';
import { findCells, FIND_SHAPES } from '../js/findart.js';
import { gameFor, GAME_NAMES } from '../js/play.js';
import { bestGear, itemById } from '../js/items.js';

// a canvas that does nothing, so the game runs outside a browser
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, drawImage() {} }) }) };
const { Sledding, TWISTS, RUN_LEN, MAGNET, SLED_ZOOM } = await import('../js/sledding.js');

test('every map has a hill, and winter brings snow to the maps that get it', () => {
  assert.equal(HILL_IDS.length, 10);
  for (const id of HILL_IDS) {
    const h = hillFor(id, 'summer');
    assert.ok(SURFACES[h.surface], `${id} surface`);
    assert.ok(TWISTS[id], `${id} has a twist`);
  }
  assert.equal(hillFor('bg-meadow', 'summer').surface, 'grass');
  assert.equal(hillFor('bg-meadow', 'autumn').surface, 'leaves');
  assert.equal(hillFor('bg-meadow', 'winter').surface, 'snow');
  assert.equal(hillFor('bg-sunset', 'winter').surface, 'sand', 'no snow on the beach');
  assert.equal(hillFor('bg-fjord', 'summer').surface, 'glacier');
  assert.ok(hillFor('bg-fjord', 'summer').snowy);
  assert.equal(hillFor('bg-nowhere', 'summer').id, 'bg-meadow');
  assert.ok(HILLS['bg-space'].gravity < 0.5, 'floaty on the moon');
});

test("the day's snow kind is the same all day and changes from day to day", () => {
  assert.equal(snowOfDay('2026-11-21'), snowOfDay('2026-11-21'));
  const seen = new Set();
  for (let d = 1; d <= 30; d += 1) seen.add(snowOfDay(`2026-12-${String(d).padStart(2, '0')}`));
  assert.deepEqual([...seen].sort(), [...SNOW_IDS].sort());
  assert.equal(snowWords('icy', 'sand').name, 'Hard-packed sand');
  assert.equal(snowWords('powder', 'snow').name, 'Fresh powder');
  for (const id of HILL_IDS) for (const k of SNOW_IDS) { const v = hillSpeed(hillFor(id), k); assert.ok(v > 0.6 && v < 1.5, `${id} ${k} ${v}`); }
});

test('the ground runs downhill with ramps', () => {
  const g = makeGround(5);
  assert.ok(g.at(2000) > g.at(0) + 200, 'it goes down');
  assert.ok(g.ramps.length > 10);
  assert.equal(makeGround(5).at(777), g.at(777), 'the same seed, the same hill');
});

test('60 real finds, six a map, each with a picture, a size, and facts', () => {
  assert.equal(FIND_MAPS.length, 10);
  assert.equal(ALL_FINDS.length, 60);
  assert.equal(new Set(ALL_FINDS.map((f) => f.key)).size, 60, 'every find is its own');
  assert.equal(new Set(ALL_FINDS.map((f) => f.name)).size, 60, 'no find is on two maps');
  for (const map of FIND_MAPS) {
    const r = FINDS[map].map((f) => f.rarity);
    assert.deepEqual(r.filter((x) => x === 'super').length, 1, `${map}: one super rare`);
    assert.ok(r.includes('rare'), `${map}: a rare one`);
  }
  for (const f of ALL_FINDS) {
    assert.ok(FIND_SHAPES.includes(f.shape), `${f.key} has a picture`);
    assert.equal(findCells(f).length, 10);
    assert.ok(SIZES[f.key], `${f.key} has a size`);
    assert.ok(f.what.length > 40 && f.wow.length > 30, `${f.key} has facts`);
    assert.ok(SNOW_IDS.includes(f.likes), `${f.key} likes a snow kind`);
  }
});

test('odds: the snow kind, the season, the find of the day and a better sled', () => {
  const base = findOdds('bg-meadow', 'icy', 'summer', 1);
  assert.equal(base['meadow-pinecone'], RARITY.common.weight * 2, 'pinecones like icy days');
  assert.ok(findOdds('bg-meadow', 'icy', 'winter', 1)['meadow-antler'] > base['meadow-antler'], 'antlers in winter');
  assert.ok(base['meadow-antler'] > 0, 'but they still turn up the rest of the year');
  assert.ok(findOdds('bg-meadow', 'icy', 'summer', 3)['meadow-clover'] > base['meadow-clover'], 'a super sled finds rare things more');
  const fod = findOfDay('bg-meadow', '2026-11-21');
  assert.equal(fod, findOfDay('bg-meadow', '2026-11-21'));
  assert.notEqual(ALL_FINDS.find((f) => f.key === fod).rarity, 'super');
  assert.equal(findOdds('bg-meadow', 'icy', 'summer', 1, { day: '2026-11-21' })[fod], base[fod] * 3);
  assert.deepEqual(Object.keys(findOdds('bg-meadow', 'icy', 'summer', 1, { rareOnly: true })).sort(), ['meadow-antler', 'meadow-clover']);
  assert.equal(pickFind({ a: 1, b: 3 }, 0.1), 'a');
  assert.equal(pickFind({ a: 1, b: 3 }, 0.9), 'b');
});

test('condition is earned: rough, fine in the air or on a streak, perfect up high', () => {
  assert.equal(conditionFor({}), 1);
  assert.equal(conditionFor({ air: true }), 2);
  assert.equal(conditionFor({ streak: 3 }), 2);
  assert.equal(conditionFor({ high: true }), 3);
  assert.equal(conditionFor({ perfect: true }), 3);
  assert.equal(findPoints('meadow-clover', 3), Math.round(RARITY.super.points * 2.5));
});

test('sizes: mostly typical, about one in ten a trophy', () => {
  const n = { small: 0, typical: 0, trophy: 0 };
  for (let i = 0; i < 1000; i += 1) n[sizeClass('meadow-geode', sizeFor('meadow-geode', i / 1000))] += 1;
  assert.ok(n.trophy > 60 && n.trophy < 140, JSON.stringify(n));
  assert.ok(n.typical > n.small && n.typical > n.trophy);
  assert.equal(sizeFor('ocean-pearl', 0), 0.15);
});

test('the finds book keeps the best condition, the biggest and a count', () => {
  let got = recordFind({}, { key: 'meadow-geode', q: 1, inches: 4, date: '2026-11-21' });
  assert.ok(got.isNew);
  got = recordFind(got.records, { key: 'meadow-geode', q: 2, inches: 3, date: '2026-11-22' });
  assert.ok(got.better && !got.bigger && !got.isNew);
  got = recordFind(got.records, { key: 'meadow-geode', q: 1, inches: 6, date: '2026-11-23' });
  assert.ok(got.bigger && !got.better);
  assert.deepEqual(got.records['meadow-geode'], { q: 2, in: 6, n: 3, date: '2026-11-22' });
  assert.equal(findCount(got.records).found, 1);
  assert.equal(findPages(got.records)[0].finds.find((f) => f.key === 'meadow-geode').record.n, 3);
});

test('the sled is sports gear, and a visitor with one goes sledding', () => {
  assert.equal(itemById('sport-sled-regular').gems, 40);
  assert.equal(itemById('sport-sled-super').gems, 300);
  assert.deepEqual(bestGear(['sport-sled-good']), { sled: 2 });
  assert.equal(gameFor({ sled: 1 }, 'x'), 'sledding');
  assert.equal(GAME_NAMES.sledding, 'Treasure hill');
});

const run = (map, opts = {}) => {
  const told = [];
  const g = new Sledding({ W: 213, H: 133, map, seed: opts.seed || 3, day: opts.day || '2026-12-08', season: opts.season || 'winter', dry: opts.dry || 0,
    kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { sled: opts.tier || 1 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: {} },
    onFind: (f) => { told.push(f); return null; }, onRun: (r) => { g.ran = r; } });
  g.tap(); g.release();
  let below = 0; let holdUntil = 0;
  for (let i = 0; i < 30 * 140 && g.phase === 'play'; i += 1) {
    const R = g.rider;
    const ahead = g.hazards.find((z) => !z.bounce && !z.hit && z.x > R.x + 4 && z.x < R.x + 22 && (z.surf || 'g') === R.on);
    const gap = g.gaps.find((p) => p.x0 > R.x && p.x0 < R.x + 14);
    if (R.on && (ahead || gap)) { g.tap(); holdUntil = g.t + (gap ? 0.3 : 0.12); }
    if (R.on === 'g' && g.onRamp(R.x) && !R.held) { g.tap(); holdUntil = g.t + 0.6; }
    if (g.meter && !g.meter.zone) g.tap();
    if (R.held && g.t > holdUntil) g.release();
    g.step(1 / 30);
    if (!g.gapAt(R.x) && !R.swing && R.y > g.groundAt(R.x) + 1) below += 1;
  }
  return { g, told, below };
};

test('a run on every hill: down to the bottom, never under the ground, finds reported', () => {
  for (const map of HILL_IDS) {
    for (const season of ['winter', 'summer']) {
      const { g, told, below } = run(map, { season });
      assert.equal(g.phase, 'over', `${map} ${season}: the run ends`);
      assert.ok(g.t > 50 && g.t < 100, `${map} ${season}: about a minute and a half (${g.t.toFixed(0)} s)`);
      assert.equal(below, 0, `${map} ${season}: never under the ground`);
      assert.ok(told.length >= 8, `${map} ${season}: finds (${told.length})`);
      assert.ok(told.every((f) => f.map === map && f.key.startsWith(map.replace('bg-', ''))), `${map}: this hill's finds`);
      assert.equal(told.length, g.haul.length);
      assert.ok(g.points.kid > 0 && g.points.vis > 0);
      assert.ok(g.ran, 'the end of the run is reported');
    }
  }
});

test('the Big Jump holds a rare find, a super rare one after a dry spell', () => {
  const { g } = run('bg-meadow', { dry: 7 });
  assert.ok(g.big, 'the Big Jump happened');
  assert.equal(RARITY[ALL_FINDS.find((f) => f.key === g.big.find.key).rarity].id, 'super');
  const { g: g2 } = run('bg-meadow', { dry: 0, seed: 9 });
  assert.ok(['rare', 'super'].includes(ALL_FINDS.find((f) => f.key === g2.big.find.key).rarity));
});

test('better sleds: they see more, pull finds in, shrug off a bump, and jump twice', () => {
  assert.deepEqual(SLED_ZOOM.map((z) => z > 1), [false, true, true]);
  assert.ok(MAGNET[1] > MAGNET[0]);
  const make = (tier) => new Sledding({ W: 213, H: 133, map: 'bg-meadow', seed: 1, day: '2026-12-08', kid: { name: 'A', buddy: {}, gear: { sled: tier } }, visitor: { name: 'B', buddy: {}, gear: {} } });
  const one = make(1); const two = make(2); const three = make(3);
  assert.ok(two.fieldW > one.fieldW);
  assert.ok(!one.rider.guard && two.rider.guard);
  for (const g of [one, three]) { g.tap(); g.step(0.02); g.rider.x = 300; g.rider.on = 'g'; g.jump(g.rider); g.step(0.1); g.jump(g.rider); }
  assert.equal(one.rider.jumps, 1, 'a regular sled jumps once');
  assert.equal(three.rider.jumps, 2, 'a super sled jumps again in the air');
  // a tumble drops the last find, and it can be grabbed again
  const g = make(1); g.tap(); g.step(0.02);
  g.take(g.rider, { x: g.rider.x, h: 0, key: 'meadow-acorn', surf: null });
  const pts = g.points.kid;
  g.tumble(g.rider);
  assert.ok(g.loose && g.points.kid < pts, 'the find bounces out');
});
