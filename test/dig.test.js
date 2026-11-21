import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DINOS, SITES, SHOVELS, findInfo, boneKey, seedFinds, keyChance, DIG_PITY, recordDig, nextDry, skeletonProgress,
  completeSkeletons, digOfDay, ALL_TREASURES, digPoints,
} from '../js/digfinds.js';
import { makeLayout, CUE_KINDS } from '../js/digsite.js';
import { rng } from '../js/pixelkit.js';

const MAPS = Object.keys(SITES);

/** Cells like dig.js makes them, from a laid-out site (no tide, nothing in the way). */
function cellsFor(map, seed = 1, W = 432, H = 160) {
  const L = makeLayout(map, rng(seed), W, H);
  const cells = []; const C = 16;
  for (let j = 0; j < H / C; j += 1) for (let i = 0; i < W / C; i += 1) {
    const x = i * C + 8; const y = j * C + 8;
    const like = Object.fromEntries(CUE_KINDS.map((k) => [k, 0]));
    for (const q of L.cues) { const d = Math.hypot(x - q.x, (y - q.y) * 1.2); if (d < q.r) for (const k in q.likes) like[k] += q.likes[k] * (1 - d / q.r); }
    cells.push({ i, j, x, y, idx: cells.length, open: y > L.top(x) + 6 && L.blocks.every((b) => Math.hypot(x - b.x, (y - b.y) * 1.6) > b.r + 2), like });
  }
  return { L, cells };
}

test('every skeleton is a skull and five bones, each with a real fact', () => {
  for (const d of DINOS) {
    assert.equal(d.bones.length, 6, d.id);
    assert.equal(d.bones[0].part, 'skull', d.id);
    assert.equal(new Set(d.bones.map((b) => b.part)).size, 6, `${d.id} parts are different`);
    for (const b of d.bones) assert.ok(b.fact.length > 20, `${d.id} ${b.part}`);
    for (const k of ['means', 'when', 'where', 'size', 'eats', 'wow']) assert.ok(d.about[k], `${d.id} ${k}`);
  }
});

test('each special skull is on exactly one map; maps without one have a special treasure', () => {
  const specials = DINOS.filter((d) => !d.common);
  for (const d of specials) assert.equal(MAPS.filter((m) => SITES[m].skull === d.id).length, 1, d.id);
  assert.equal(DINOS.filter((d) => d.common).length, 3);
  for (const m of MAPS) {
    const s = SITES[m];
    assert.ok(Boolean(s.skull) !== Boolean(s.special), m);
    assert.equal(s.treasures.length, 5, m);
    assert.deepEqual(s.treasures.map((t) => t.rarity), ['common', 'common', 'uncommon', 'uncommon', 'rare'], m);
  }
});

test('treasures have real facts and none share a name with the sled finds', () => {
  const SLED = ['Pinecone', 'Acorn', 'Quartz crystal', 'Geode', 'Deer antler', 'Four-leaf clover', 'Horseshoe', 'Pottery shard', 'Flint', 'Iron key', 'Silver penny', 'Sapphire ring', 'Scallop shell', 'Moon snail shell', 'Sea glass', 'Sand dollar', 'Shark tooth', 'Junonia shell', 'Sea urchin shell', 'Paper nautilus shell', 'Ammonite fossil', 'Pearl', 'Megalodon tooth', 'Spanish gold doubloon', 'Pumice', 'Scoria', 'Obsidian', 'Peridot', 'Lava bomb', 'Amber with a bug', 'Emerald', 'Garnet', 'Gold nugget', 'Agate', 'Opal', 'Pyrite', 'Citrine', 'Moldavite', 'Moon rock', 'Labradorite', 'Fluorite'];
  for (const t of ALL_TREASURES) {
    assert.ok(t.fact.length > 30, t.key);
    assert.ok(!SLED.includes(t.name), t.name);
  }
  assert.equal(new Set(ALL_TREASURES.map((t) => t.name)).size, ALL_TREASURES.length, 'names are all different');
});

test('every special skeleton can be finished on its own skull map', () => {
  for (const d of DINOS.filter((x) => !x.common)) {
    const map = d.skullMap; const seen = new Set();
    for (let s = 1; s <= 80; s += 1) {
      const { cells } = cellsFor(map, s);
      const { items } = seedFinds(map, cells, rng(s * 13), { dry: DIG_PITY - 1 });
      for (const it of items) seen.add(it.key);
    }
    for (const b of d.bones) assert.ok(seen.has(boneKey(d.id, b.part)), `${d.id} ${b.part} on ${map}`);
  }
});

test('a special skull never turns up away from its map', () => {
  for (const map of MAPS) for (let s = 1; s <= 20; s += 1) {
    const { cells } = cellsFor(map, s);
    const { items } = seedFinds(map, cells, rng(s), { dry: 5 });
    for (const it of items) {
      const f = findInfo(it.key);
      if (f.part === 'skull' && f.dino.special) assert.equal(SITES[map].skull, f.dino.id, `${it.key} on ${map}`);
      if (f.kind === 'treasure') assert.equal(f.map, map);
    }
  }
});

test('the key piece is sure to turn up by the sixth round without it, and comes sooner with a better shovel', () => {
  assert.ok(keyChance(0) >= 0.15 && keyChance(0) < 0.2);
  assert.equal(keyChance(DIG_PITY - 1), 1);
  assert.ok(keyChance(1, 3) > keyChance(1, 1));
  let dry = 0; for (let k = 0; k < 10; k += 1) dry = nextDry(dry, false);
  assert.equal(dry, DIG_PITY - 1);
  assert.equal(nextDry(4, true), 0);
});

test('the very first round seeds a Psittacosaurus bed with its skull near the start', () => {
  const { cells } = cellsFor('bg-volcano', 3);
  const { items } = seedFinds('bg-volcano', cells, rng(3), { first: true, start: [80, 70] });
  const first = items.filter((it) => it.bed === 'first');
  assert.ok(first.some((it) => it.key === 'psitta-skull'));
  assert.ok(first.length >= 2);
  const sk = cells[first.find((it) => it.key === 'psitta-skull').cell];
  assert.ok(Math.hypot(sk.x - 80, sk.y - 70) < 120);
});

test('bones lie by cliffs and creeks, gems by rocks: cue cells get more finds', () => {
  let cue = 0; let flat = 0; let cueCells = 0; let flatCells = 0;
  for (let s = 1; s <= 30; s += 1) {
    const { cells } = cellsFor('bg-meadow', s);
    const { items } = seedFinds('bg-meadow', cells, rng(s));
    const byCell = new Set(items.map((it) => it.cell));
    for (const c of cells) {
      if (!c.open) continue;
      const rich = c.like.bone + c.like.gem + c.like.made > 1.5;
      if (rich) { cueCells += 1; if (byCell.has(c.idx)) cue += 1; } else { flatCells += 1; if (byCell.has(c.idx)) flat += 1; }
    }
  }
  assert.ok(cue / cueCells > 3 * (flat / flatCells), `${cue}/${cueCells} vs ${flat}/${flatCells}`);
});

test('needed bones come up more than ones the kid has', () => {
  const have = {}; for (const b of DINOS[0].bones.slice(1, 4)) have[boneKey('psitta', b.part)] = { n: 1 };
  let got = 0; let need = 0;
  for (let s = 1; s <= 60; s += 1) {
    const { cells } = cellsFor('bg-meadow', s);
    for (const it of seedFinds('bg-meadow', cells, rng(s), { bones: have }).items) {
      if (!it.key.startsWith('psitta-') || it.key === 'psitta-skull') continue;
      if (have[it.key]) got += 1; else need += 1;
    }
  }
  assert.ok(need > got * 1.4, `${need} needed vs ${got} had`);
});

test('the golden shovel hides a second find under some', () => {
  const { cells } = cellsFor('bg-meadow', 2);
  const gold = seedFinds('bg-meadow', cells, rng(2), { tier: 3 }).items;
  const plain = seedFinds('bg-meadow', cells, rng(2), { tier: 1 }).items;
  assert.ok(gold.some((it) => it.under));
  assert.ok(!plain.some((it) => it.under));
  for (const it of gold) assert.ok(it.depth >= 1 && it.depth <= 5);
});

test('shovels get better at every tier', () => {
  for (let k = 1; k < SHOVELS.length; k += 1) {
    for (const f of ['walk', 'zoom', 'screens', 'odds']) assert.ok(SHOVELS[k][f] > SHOVELS[k - 1][f], f);
    assert.ok(SHOVELS[k].stroke < SHOVELS[k - 1].stroke);
  }
  assert.ok(SHOVELS[1].test && !SHOVELS[0].test);
  assert.ok(SHOVELS[2].sense > 0 && SHOVELS[2].double > 0);
});

test('the dig book records the best condition and counts', () => {
  const r = {};
  assert.equal(recordDig(r, { key: 'trex-skull', q: 1, date: 'a' }), 'new');
  assert.equal(recordDig(r, { key: 'trex-skull', q: 1, date: 'b' }), null);
  assert.equal(recordDig(r, { key: 'trex-skull', q: 3, date: 'c' }), 'better');
  assert.deepEqual(r['trex-skull'], { n: 3, q: 3, date: 'c' });
  const bones = Object.fromEntries(DINOS[1].bones.map((b) => [boneKey(DINOS[1].id, b.part), { n: 1 }]));
  assert.deepEqual(skeletonProgress(DINOS[1].id, bones), { have: 6, total: 6 });
  assert.deepEqual(completeSkeletons(bones), [DINOS[1].id]);
  assert.ok(digPoints('trex-skull', 3) > digPoints('trex-skull', 1));
});

test('the dinosaur of the day stays put all day and has bones on that map', () => {
  for (const m of MAPS) {
    const a = digOfDay(m, '2026-12-11');
    assert.deepEqual(a, digOfDay(m, '2026-12-11'));
    const d = DINOS.find((x) => x.id === a.id);
    assert.ok(d.common || SITES[m].skull === d.id || SITES[m].tease.includes(d.id), `${m} ${a.id}`);
  }
});

test('every site has a cliff foot, cues of all three kinds, and room to dig', () => {
  for (const m of MAPS) {
    const { L, cells } = cellsFor(m, 5);
    const open = cells.filter((c) => c.open);
    assert.ok(open.length > 120, `${m}: ${open.length} open cells`);
    for (const k of CUE_KINDS) assert.ok(open.some((c) => c.like[k] > 1), `${m} has ${k} cues`);
    assert.ok(L.top(10) > 20 && L.top(10) < 50);
  }
});
