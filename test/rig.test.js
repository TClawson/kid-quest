import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRig, render, Brain, CALM } from '../js/rig.js';

const SPECIES = ['fox', 'bear', 'panda', 'cat', 'puppy', 'turtle', 'dino'];
const filled = (buf) => buf.filter(Boolean).length;

test('every buddy builds and draws, with and without a background', () => {
  for (const species of SPECIES) {
    for (const background of [true, false]) {
      const rig = buildRig({ species, outfit: { hat: 'hat-cap', neck: 'neck-scarf' } }, { background });
      const b = new Brain(1);
      const buf = render(rig, b.pose(0, 0.08));
      assert.equal(buf.length, 24 * 24);
      assert.ok(filled(buf) > (background ? 575 : 120), `${species} draws`);
    }
  }
});

test('every feeling makes a pose that draws', () => {
  const rig = buildRig({ species: 'fox', outfit: { music: 'music-rock' } });
  for (const k of Object.keys(CALM)) {
    const b = new Brain(2);
    b.set({ [k]: k === 'valence' ? -1 : 1 });
    b.settle();
    for (let i = 0; i < 24; i += 1) {
      const pose = b.pose(i / 12, 1 / 12, { beat: { index: i, phase: (i % 4) / 4 }, lookAt: [20, 4], notes: true });
      assert.ok(filled(render(rig, pose, i)) > 400, `${k} draws`);
    }
  }
});

test('feelings ease toward their targets, and bursts fade', () => {
  const b = new Brain(3);
  b.set({ valence: -1 });
  b.pose(0, 0.08);
  assert.ok(b.s.valence > -1 && b.s.valence < 0.5, 'eases, no jump');
  for (let i = 1; i < 40; i += 1) b.pose(i / 12, 1 / 12);
  assert.ok(b.s.valence < -0.95, 'gets there');
  b.impulse('surprise', 1);
  const eye = b.pose(4, 0.08).face.eye;
  assert.ok(eye === 'wide' || eye === 'closed', 'wide eyes (or a blink)');
  assert.ok(b.s.surprise > 0.9);
  for (let i = 0; i < 30; i += 1) b.pose(4 + i / 12, 1 / 12);
  assert.ok(b.s.surprise < 0.1, 'a surprise fades');
});

test('faces follow feelings', () => {
  const face = (targets) => { const b = new Brain(4); b.set(targets); b.settle(); return b.pose(0.5, 0.08).face; };
  assert.equal(face({ valence: -0.9 }).mouth, 'sad');
  assert.equal(face({ sleep: 1 }).eye, 'sleep');
  assert.equal(face({ listen: 1 }).eye, 'happy');
  assert.equal(face({ focus: 1 }).brow < 0, true, 'determined brows');
  assert.equal(face({}).lookX, 0);
  const b = new Brain(5);
  assert.equal(b.pose(0.5, 0.08, { lookAt: [23, 12] }).face.lookX, 1, 'looks at a finger');
});

test('a pose stays in whole pixels', () => {
  // style A: the same pose always draws the same picture
  const rig = buildRig({ species: 'cat', outfit: {} });
  const b = new Brain(6);
  b.set({ dance: 1, valence: 1, arousal: 1 });
  b.settle();
  const pose = b.pose(1, 1 / 12, { beat: { index: 3, phase: 0.3 } });
  assert.deepEqual(render(rig, pose, 0), render(rig, pose, 0));
});

test('the dino tail stays joined to its body as it wags', () => {
  const rig = buildRig({ species: 'dino', outfit: {} }, { background: false });
  const t = rig.tail;
  // the tail's first column, where it meets the body, never moves
  const u0 = t.c[0].findIndex((_, u) => t.c.some((r) => r[u]));
  const join = (buf) => t.c.map((_, v) => buf[(t.y + v) * 24 + t.x + u0]);
  const b = new Brain(5);
  const rest = join(render(rig, { ...b.pose(0, 1 / 12), tail: { rot: 0 }, fx: [] }));
  for (const rot of [-70, -40, -20, -8, 8, 20, 40, 70]) {
    const pose = { ...b.pose(0, 1 / 12), tail: { rot }, fx: [] };
    assert.deepEqual(join(render(rig, pose)), rest, `tail turned ${rot}: comes loose`);
  }
});
