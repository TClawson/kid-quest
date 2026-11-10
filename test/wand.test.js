import test from 'node:test';
import assert from 'node:assert/strict';
import { wandPower, itemById, isWorn, ownedFor, addOwned } from '../js/items.js';
import { wandCells, sparkAt, wandSide, buddySvg } from '../js/avatar.js';
import { buildRig, render, Brain } from '../js/rig.js';
import { playLook } from '../js/play.js';

test('wand power is the share of today done, with nothing to do counting as all done', () => {
  assert.equal(wandPower(null), 0);
  assert.equal(wandPower({ done: 0, total: 4 }), 0);
  assert.equal(wandPower({ done: 2, total: 4 }), 0.5);
  assert.equal(wandPower({ done: 5, total: 4 }), 1);
  assert.equal(wandPower({ done: 0, total: 0 }), 1);
});

test('the wizard set is for sale, and worn items belong to one buddy', () => {
  for (const id of ['hat-wizard-star', 'face-beard', 'neck-robe', 'hand-wand']) {
    const item = itemById(id);
    assert.ok(item?.price > 0, id);
    assert.ok(isWorn(item), id);
  }
  const kid = { buddy: { species: 'turtle', outfit: {} }, owned: [] };
  addOwned(kid, itemById('hand-wand'));
  assert.deepEqual(ownedFor(kid, 'turtle'), ['hand-wand']);
  assert.deepEqual(ownedFor(kid, 'fox'), []);
});

test('the wand glows more with more chores done, and sparks only when all are done', () => {
  const glow = (p) => wandCells(p, 'left', 0, 'glow').reduce((n, c) => n + c.a, 0);
  assert.equal(glow(0), 0);
  assert.ok(glow(0.25) < glow(0.5) && glow(0.5) < glow(0.75) && glow(0.75) < glow(1));
  const frames = Array.from({ length: 120 }, (_, f) => f);
  const burst = frames.filter((f) => sparkAt(f));
  assert.ok(burst.length > 0 && burst.length < 60, 'sparks now and then, not all the time');
  const f = burst[0];
  assert.equal(wandCells(0.9, 'left', f, 'sparks').length, 0);
  assert.ok(wandCells(1, 'left', f, 'sparks').length > 0);
  const colors = new Set(wandCells(1, 'left', f, 'sparks').map((c) => c.c));
  assert.ok(colors.size >= 4, 'sparks of different colors');
});

test('the wand moves to the right when a ball or stick is held on the left', () => {
  assert.equal(wandSide('soccer'), 'right');
  assert.equal(wandSide('rod'), 'left');
  const xs = (side) => wandCells(0, side, 0, 'wand').map((c) => c.x);
  assert.ok(Math.max(...xs('left')) < 12 && Math.min(...xs('right')) > 11);
});

test('every buddy draws the wizard set, still and live', () => {
  const outfit = { hat: 'hat-wizard-star', face: 'face-beard', neck: 'neck-robe', hand: 'hand-wand' };
  for (const species of ['fox', 'bear', 'panda', 'cat', 'dino', 'puppy', 'turtle']) {
    const svg = buddySvg({ species, outfit, wand: 1 }, 'happy');
    assert.match(svg, /class="wand wand-full"/);
    const rig = buildRig({ species, outfit });
    const pose = new Brain(1).pose(0.5, 0.1, {});
    const dim = render(rig, pose, 0, { wand: 0 });
    const lit = render(rig, pose, 0, { wand: 1 });
    assert.notDeepEqual(dim, lit, species);
    assert.ok(lit.every((c) => c === null || /^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(c)), species);
  }
});

test('the wand is put down to play games', () => {
  assert.equal(playLook({ species: 'fox', outfit: { hand: 'hand-wand' } }, {}, 'soccer').outfit.hand, undefined);
});
