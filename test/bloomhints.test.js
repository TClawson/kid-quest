import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloomHint, hintPool } from '../js/bloomhints.js';

const base = { yesterday: 'mid', dayBefore: 'mid', today: 'mid', wilt: 0, prevWilt: 0, goodDays: 5, newTrees: 0, newBlooms: 0, newMature: 0, grew: false };
const lines = (h) => new Set(Array.from({ length: 200 }, (_, i) => bloomHint(h, `d|v|${i}`)).filter(Boolean));

test('the same seed gives the same line, and different seeds rotate', () => {
  const h = { ...base, yesterday: 'good', grew: true };
  assert.equal(bloomHint(h, 'a|b|1'), bloomHint(h, 'a|b|1'));
  assert.ok(lines(h).size > 1);
});

test('villagers only say something about half the time, but always when the plants wilt', () => {
  const some = Array.from({ length: 200 }, (_, i) => bloomHint({ ...base, yesterday: 'good', grew: true }, `s${i}`));
  assert.ok(some.some((x) => x === '') && some.some((x) => x));
  for (let i = 0; i < 100; i += 1) assert.match(bloomHint({ ...base, wilt: 2, yesterday: 'bad' }, `w${i}`), /wilting|drooping|droopy/);
});

test('each situation has its own lines', () => {
  assert.ok(hintPool({ ...base, yesterday: 'bad' }).every((l) => /tough|worried/.test(l)));
  assert.ok([...lines({ ...base, yesterday: 'mid' })].every((l) => /grow|waiting|Nothing/.test(l)));
  assert.ok([...lines({ ...base, yesterday: 'good', newMature: 1 })].every((l) => /60/.test(l)));
  assert.ok([...lines({ ...base, yesterday: 'good', newBlooms: 2 })].every((l) => /flower|bloom/i.test(l)));
  assert.ok([...lines({ ...base, yesterday: 'good', prevWilt: 1 })].every((l) => /perking|standing/.test(l)));
  assert.equal(bloomHint({ ...base, goodDays: 0 }, 'x'), '');
  assert.equal(bloomHint(null, 'x'), '');
});

test('lines never name a kid', () => {
  for (const pool of [hintPool({ ...base, wilt: 1 }), hintPool({ ...base, yesterday: 'bad' }), hintPool({ ...base, yesterday: 'good', grew: true })]) {
    for (const l of pool) assert.ok(!/\b(Ava|Ben|you missed|he |she )/i.test(l));
  }
});
