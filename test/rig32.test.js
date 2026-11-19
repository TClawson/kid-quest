import test from 'node:test';
import assert from 'node:assert/strict';
import { Brain, CALM } from '../js/rig.js';
import { buildRig32, render32, N } from '../js/rig32.js';
import { speciesArt } from '../js/art32.js';

const SPECIES = ['fox', 'bear', 'panda', 'cat', 'puppy', 'turtle', 'dino'];
const filled = (buf) => buf.filter(Boolean).length;

test('every big drawing is 32 pixels wide and uses only its own colors', () => {
  for (const species of SPECIES) {
    const art = speciesArt(species);
    for (const grid of [art.head, art.body, art.feet]) {
      for (const row of grid) {
        assert.equal(row.length, 32, `${species} row is 32 wide`);
        for (const ch of row) if (ch !== '.') assert.ok(art.pal[ch], `${species} knows the color ${ch}`);
      }
    }
  }
});

test('every buddy builds and draws big, with an outfit, with and without a background', () => {
  for (const species of SPECIES) {
    for (const background of [true, false]) {
      const rig = buildRig32({ species, outfit: { hat: 'hat-cap', neck: 'neck-scarf', face: 'face-star', hand: 'hand-wand', music: 'music-rock', sport: 'sport-soccer-good' } }, { background });
      const buf = render32(rig, new Brain(1).pose(0, 0.08), 0, { wand: 0.5 });
      assert.equal(buf.length, N * N);
      assert.ok(filled(buf) > (background ? N * N - 10 : 600), `${species} draws`);
    }
  }
});

test('every feeling makes a big pose that draws', () => {
  for (const species of SPECIES) {
    const rig = buildRig32({ species, outfit: {} }, { background: false });
    for (const k of Object.keys(CALM)) {
      const b = new Brain(2);
      b.set({ [k]: k === 'valence' ? -1 : 1 });
      b.settle();
      for (let i = 0; i < 12; i += 1) {
        const pose = b.pose(i / 12, 1 / 12, { beat: { index: i, phase: (i % 4) / 4 }, lookAt: [20, 4], notes: true });
        assert.ok(filled(render32(rig, pose, i)) > 450, `${species} ${k} draws`);
      }
    }
  }
});

test('a hat sits on the big head where it sits on the small one', () => {
  const rig = buildRig32({ species: 'bear', outfit: { hat: 'hat-cap' } }, { background: false });
  const hatTop = rig.hat.c.findIndex((row) => row.some(Boolean)) + rig.hat.y;
  const pose = new Brain(4).pose(0, 0.08);
  pose.root = { dx: 0, dy: 0 }; pose.body.stretch = 0; pose.head = { dx: 0, dy: 0, rot: 0 };
  const buf = render32(rig, pose);
  let top = N;
  for (let y = 0; y < N && top === N; y += 1) for (let x = 0; x < N; x += 1) if (buf[y * N + x]) { top = y; break; }
  assert.equal(top, hatTop, 'the hat is the top of the buddy');
  assert.ok(hatTop < 14 + 6, 'and it sits up on the head');
});
