import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, addDays } from '../js/logic.js';
import { CRITTERS } from '../js/critters.js';
import { LITTLE_MAPS, JAR_MAX, newLittle, playsLittle, starsEarned, jarStars, spendStar, nextAnimal, earnSticker, puzzleSize, voiceOf } from '../js/littlerules.js';

const day = '2026-11-25';
function family({ since = addDays(day, -2), on = true } = {}) {
  const s = emptyState();
  const tasks = defaultTasks();
  const kid = { id: 'kid_a', name: 'A', tasks, startDate: addDays(day, -30), buddy: { species: 'cat', outfit: {} }, owned: [] };
  if (on) { kid.littleGames = true; kid.little = newLittle(since); }
  s.kids.push(kid);
  return { s, kid, tasks };
}
const done = (s, key, ids, status = 'done') => {
  s.log[key] = s.log[key] || {};
  s.log[key].kid_a = { tasks: Object.fromEntries(ids.map((id) => [id, { status }])) };
};

test('every map has six real animals, each with a voice', () => {
  const ids = new Set(CRITTERS.map((c) => c.id));
  assert.equal(Object.keys(LITTLE_MAPS).length, 10);
  for (const [map, m] of Object.entries(LITTLE_MAPS)) {
    assert.equal(m.animals.length, 6, map);
    assert.equal(m.voices.length, 6, map);
    assert.equal(new Set(m.animals).size, 6, `${map}: no repeats`);
    for (const a of m.animals) {
      assert.ok(ids.has(a), `${a} is a real critter`);
      assert.equal(CRITTERS.find((c) => c.id === a).map, map, `${a} lives on ${map}`);
    }
  }
  assert.equal(voiceOf('fjord-otter'), 'whistle');
});

test('stars count chores done since the switch went on, not before and not waiting for a parent', () => {
  const { s, kid, tasks } = family();
  done(s, addDays(day, -5), tasks.slice(0, 3).map((t) => t.id)); // before the switch
  done(s, addDays(day, -1), tasks.slice(0, 2).map((t) => t.id));
  done(s, day, [tasks[0].id]);
  s.log[day].kid_a.tasks[tasks[1].id] = { status: 'pending' };
  assert.equal(starsEarned(s, kid, day), 3);
  assert.equal(jarStars(s, kid, day), 3);
});

test('a kid without the switch has no stars and cannot spend', () => {
  const { s, kid, tasks } = family({ on: false });
  done(s, day, tasks.map((t) => t.id));
  assert.equal(playsLittle(kid), false);
  assert.equal(jarStars(s, kid, day), 0);
  assert.equal(spendStar(s, kid, day), false);
});

test('spending takes one star out, and an empty jar says no', () => {
  const { s, kid, tasks } = family();
  done(s, day, tasks.slice(0, 2).map((t) => t.id));
  assert.equal(spendStar(s, kid, day), true);
  assert.equal(jarStars(s, kid, day), 1);
  assert.equal(spendStar(s, kid, day), true);
  assert.equal(spendStar(s, kid, day), false);
  assert.equal(jarStars(s, kid, day), 0);
  assert.equal(kid.little.visits, 2);
});

test('the jar holds ten; using a full jar leaves nine, not all the extra stars', () => {
  const { s, kid, tasks } = family({ since: addDays(day, -3) });
  for (let i = 0; i < 3; i += 1) done(s, addDays(day, -i), tasks.slice(0, 5).map((t) => t.id)); // 15 earned
  assert.equal(jarStars(s, kid, day), JAR_MAX);
  assert.equal(spendStar(s, kid, day), true);
  assert.equal(jarStars(s, kid, day), JAR_MAX - 1);
});

test('new animals come first; after that any of the map\'s six', () => {
  const kid = { little: newLittle(day) };
  const seen = new Set();
  for (let i = 0; i < 6; i += 1) {
    const a = nextAnimal(kid, 'bg-fjord', () => 0.5);
    assert.ok(!seen.has(a));
    seen.add(a);
    earnSticker(kid, a);
  }
  assert.equal(seen.size, 6);
  assert.ok(LITTLE_MAPS['bg-fjord'].animals.includes(nextAnimal(kid, 'bg-fjord', () => 0.99)));
  // an unknown map falls back to the meadow
  assert.ok(LITTLE_MAPS['bg-meadow'].animals.includes(nextAnimal({}, 'bg-nowhere')));
});

test('meeting an animal again fills a heart (up to three); gold stays gold', () => {
  const kid = { little: newLittle(day) };
  assert.deepEqual(earnSticker(kid, 'meadow-frog'), { gold: false, hearts: 0 });
  assert.deepEqual(earnSticker(kid, 'meadow-frog', true), { gold: true, hearts: 1 });
  earnSticker(kid, 'meadow-frog'); earnSticker(kid, 'meadow-frog');
  assert.deepEqual(kid.little.stickers['meadow-frog'], { gold: true, hearts: 3 });
});

test('puzzles grow from 2 to 4 to 6 pieces', () => {
  assert.deepEqual(puzzleSize(0), [2, 1]);
  assert.deepEqual(puzzleSize(3), [2, 2]);
  assert.deepEqual(puzzleSize(8), [3, 2]);
});
