import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutsFor, makeCourse, racePoints, SECTIONS, RACE_LEN, BAND } from '../js/skirace.js';
import { COURSES, ALL_SHORTCUTS, skiGear, SHORTCUT_KINDS } from '../js/skicourses.js';
import { recordRace, badgeFor, hillCount, hillBest } from '../js/skibook.js';
import { HILLS, SNOW_IDS, rng as seeded, hash } from '../js/slopes.js';
// (the first number from similar seeds is alike, so skip it, as makeCourse does)
const rng = (n) => { const r = seeded(hash(`t:${n}`)); r(); r(); return r; };
import { gameFor } from '../js/play.js';

test('every hill has six shortcuts: four common, one uncommon, one legendary on its own snow', () => {
  for (const id of Object.keys(HILLS)) {
    const list = COURSES[id]?.shortcuts;
    assert.ok(list, `${id} has a course`);
    assert.equal(list.length, 6, id);
    assert.equal(list.filter((s) => s.rarity === 'common').length, 4, id);
    assert.equal(list.filter((s) => s.rarity === 'uncommon').length, 1, id);
    const legend = list.filter((s) => s.rarity === 'legendary');
    assert.equal(legend.length, 1, id);
    assert.ok(SNOW_IDS.includes(legend[0].snow), `${id} legendary has a snow kind`);
    assert.equal(new Set(list.map((s) => s.id)).size, 6, `${id} ids are unique`);
    for (const s of list) {
      assert.ok(SHORTCUT_KINDS.includes(s.kind), `${id}/${s.id} kind`);
      assert.ok(s.fact.length > 20, `${id}/${s.id} has a fact`);
      assert.ok(['tracks', 'sparkle', 'sign', 'gap'].includes(s.clue), `${id}/${s.id} clue`);
    }
  }
  assert.equal(ALL_SHORTCUTS.length, 60);
});

test('three shortcuts open a race, the legendary one only on its snow kind', () => {
  const legend = COURSES['bg-fjord'].shortcuts.find((s) => s.rarity === 'legendary');
  const other = SNOW_IDS.find((k) => k !== legend.snow);
  let seen = 0;
  for (let i = 0; i < 400; i += 1) {
    const picks = shortcutsFor('bg-fjord', other, 3, new Set(), rng(i + 1));
    assert.equal(picks.length, 3);
    assert.equal(new Set(picks).size, 3);
    assert.ok(!picks.includes(legend));
    if (shortcutsFor('bg-fjord', legend.snow, 3, new Set(), rng(i + 1)).includes(legend)) seen += 1;
  }
  // super skis: about 20% on its day
  assert.ok(seen > 40 && seen < 130, `legendary seen ${seen} of 400`);
});

test('better skis find the legendary shortcut more often', () => {
  const legend = COURSES['bg-meadow'].shortcuts.find((s) => s.rarity === 'legendary');
  const rate = (tier) => { let n = 0; for (let i = 0; i < 2000; i += 1) if (shortcutsFor('bg-meadow', legend.snow, tier, new Set(), rng(i * 7 + 3)).includes(legend)) n += 1; return n / 2000; };
  const [a, b, c] = [rate(1), rate(2), rate(3)];
  assert.ok(a < b && b < c, `${a} ${b} ${c}`);
  assert.ok(skiGear(3).boosts === 2 && skiGear(2).boosts === 1 && skiGear(1).boosts === 0);
});

test('the first slot leans toward a shortcut not found yet', () => {
  const commons = COURSES['bg-castle'].shortcuts.filter((s) => s.rarity !== 'legendary');
  const found = new Set(commons.slice(0, 4).map((s) => s.id));
  let fresh = 0;
  for (let i = 0; i < 300; i += 1) if (shortcutsFor('bg-castle', 'icy', 1, found, rng(i + 9)).some((s) => !found.has(s.id))) fresh += 1;
  // the last one left is the uncommon one: about half the races, not a third
  assert.ok(fresh > 120, `an unfound one turned up in ${fresh} of 300 races`);
});

test('a course: lanes start inside the trail and stay on the hill', () => {
  for (const map of Object.keys(HILLS)) {
    const c = makeCourse({ map, season: 'winter', snow: 'icy', tier: 1, found: new Set(), seed: `t|${map}` });
    assert.equal(c.sections.length, SECTIONS.length);
    for (const s of c.sections) {
      const mouth = s.sx + 24;
      assert.ok(Math.abs(s.yc - c.center(mouth)) < c.halfWidth(mouth), `${map}: the way in is reachable from the trail`);
      assert.ok(s.yc - s.hw > 0 && s.yc + s.hw < BAND, `${map}: lane on the hill`);
    }
    for (let x = 0; x < RACE_LEN; x += 50) {
      assert.ok(c.center(x) - c.halfWidth(x) >= 0 && c.center(x) + c.halfWidth(x) <= BAND, `${map}: trail on the hill at ${x}`);
    }
    assert.ok(c.gates.length > 5, `${map} has gates`);
    assert.ok(c.trees.length > 500, `${map} has a forest`);
  }
});

test('the shortcut book: found, clean and gold badges, snow stamps, best times', () => {
  assert.equal(badgeFor(false, true), 'bronze');
  assert.equal(badgeFor(true, false), 'silver');
  assert.equal(badgeFor(true, true), 'gold');
  let r = recordRace({}, { map: 'bg-meadow', snow: 'icy', time: 40.2, won: false, runs: [{ id: 'fox-den', clean: false, secs: 4 }] }, '2026-12-01');
  assert.equal(r.news[0].first, true);
  assert.equal(r.news[0].badge, 'bronze');
  assert.equal(r.bestTime, true);
  const before = r.book;
  r = recordRace(before, { map: 'bg-meadow', snow: 'powder', time: 44, won: true, runs: [{ id: 'fox-den', clean: true, secs: 3.5 }, { id: 'nope', clean: true }] }, '2026-12-02');
  assert.equal(before['bg-meadow'].found['fox-den'].badge, 'bronze', 'the old book is not changed');
  const e = r.book['bg-meadow'].found['fox-den'];
  assert.equal(e.badge, 'gold');
  assert.deepEqual(e.snows, ['icy', 'powder']);
  assert.equal(e.best, 3.5);
  assert.equal(e.day, '2026-12-01', 'keeps the day it was found');
  assert.equal(r.news.length, 1, 'unknown ids are ignored');
  assert.equal(r.news[0].up, true);
  assert.deepEqual(hillCount(r.book, 'bg-meadow'), { found: 1, total: 6 });
  assert.equal(hillBest(r.book, 'bg-meadow'), 40.2);
  // a slower race on the same snow is not a best
  assert.equal(recordRace(r.book, { map: 'bg-meadow', snow: 'icy', time: 50, won: true, runs: [] }, '2026-12-03').bestTime, false);
});

test('skis make the ski race a visitor game; faster races score more', () => {
  assert.equal(gameFor({ skis: 1 }), 'race');
  assert.ok(racePoints(30) > racePoints(40));
  assert.ok(racePoints(200) >= 1);
});
