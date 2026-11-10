// The village's own trees and flowers, which grow with how the whole family does its chores
// together (the village is the family home, so caring for it is everyone's job). Pure logic,
// no DOM (villagebloom.js and its art draw them on each map).
//
// Each day the family gets one of three marks, from everyone's chores put together:
//   good: at least 80% of everyone's chores marked done (a parent's check isn't needed);
//   bad: under 50%; in between: nothing changes.
// A kid's excused day leaves their chores out; a day with no chores at all is in between.
//
// Trees (TREE_SPOTS of them on every map) stay forever. The first TREE_BATCH start growing on
// the first day; each time the youngest batch has had TREE_NEXT good days, the next batch
// starts. A tree is fully grown after TREE_DAYS good days, so the whole village takes about
// 6 months of good days, and more like 8 to 12 with normal slips.
// Flowers (FLOWER_SPOTS) come and go: FLOWER_BATCH start on the first day, then up to
// FLOWER_BATCH more every FLOWER_NEXT good days while there are empty spots. A flower blooms
// after FLOWER_DAYS good days and fades FLOWER_LIFE days after it opens, so steady good days
// keep the village mostly full of flowers, always changing.
// After 2 bad days in a row, everything wilts a little (one more step for every 2 more bad
// days, up to 3). The next good day brings everything back.
//
// Every device works this out from the same history, so everyone sees the same village.
// Each kid's device only loads that kid's own days, so each kid's synced record carries a
// small summary of its days (kid.daily = { 'YYYY-MM-DD': [done, total] }, see dailySummaries)
// that the other devices read.

import { dayStatus, addDays, questTasks, scheduledOn } from './logic.js';

export const VILLAGE_START = '2026-11-10';
export const GOOD = 0.8;
export const BAD = 0.5;

export const TREE_SPOTS = 20;
export const TREE_BATCH = 3;
export const TREE_NEXT = 18;
export const TREE_DAYS = 60;
export const TREE_STAGES = 6; // 0 sapling .. 5 fully grown

export const FLOWER_SPOTS = 50;
export const FLOWER_BATCH = 10;
export const FLOWER_NEXT = 3;
export const FLOWER_DAYS = 7;
export const FLOWER_LIFE = 7;
export const FLOWER_STAGES = 4; // 0 sprout, 1 leaves, 2 bud, 3 in bloom
export const FLOWER_KINDS = 4; // each map draws 4 kinds of flower

export const MAX_WILT = 3;

// ---------- each kid's days, shared ----------

/** One kid's day as [done, total] (done counts chores marked done or waiting for a parent). An excused day is [0, 0]. */
export function daySummary(state, kid, key, today) {
  const s = dayStatus(state, kid, key, today);
  return s.excused ? [0, 0] : [s.done + s.pending, s.total];
}

/**
 * The kid's days from VILLAGE_START to today that this device knows about, as
 * { key: [done, total] }, merged over what the kid's record already carries. Only days
 * this device has loaded (state.log) are written. Returns the new kid.daily, or null if
 * nothing changed.
 */
export function dailySummaries(state, kid, today, start = VILLAGE_START) {
  const out = { ...(kid.daily || {}) };
  let changed = false;
  for (const key of Object.keys(state.log)) {
    if (key < start || key > today || !state.log[key][kid.id]) continue;
    const v = daySummary(state, kid, key, today);
    const was = out[key];
    if (!was || was[0] !== v[0] || was[1] !== v[1]) { out[key] = v; changed = true; }
  }
  return changed ? out : null;
}

/**
 * The family's share of chores done on a day: { done, total, share, mark } where mark is
 * 'good', 'bad' or 'mid'. Today only counts as good once it is (it is never bad, it isn't
 * over yet). A kid with nothing on record for a past day did none of that day's chores.
 */
export function familyMark(kids, key, today) {
  let done = 0; let total = 0;
  for (const k of kids) {
    if (k.startDate && key < k.startDate) continue;
    let v = k.daily?.[key];
    if (!v && key === today && k.today?.day === today) v = [k.today.done, k.today.total];
    if (!v) {
      if (key === today) return { done, total, share: 0, mark: 'mid' }; // not known yet today
      v = [0, questTasks(scheduledOn(k, key)).length];
    }
    done += Math.min(v[0], v[1]);
    total += v[1];
  }
  const share = total ? done / total : 0;
  let mark = 'mid';
  if (total && share >= GOOD) mark = 'good';
  else if (total && share < BAD && key !== today) mark = 'bad';
  return { done, total, share, mark };
}

// ---------- the village, grown ----------

// A fixed, well-mixed order to fill spots in, so the first trees and flowers are spread
// around the village rather than bunched in one corner.
function spread(n, seed) {
  const order = Array.from({ length: n }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = n - 1; i > 0; i -= 1) {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const TREE_ORDER = spread(TREE_SPOTS, 7);
const FLOWER_ORDER = spread(FLOWER_SPOTS, 11);
const kindFor = (spot, day) => {
  let h = Math.imul(spot + 1, 0x9e3779b1) ^ Math.imul(day + 7, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) % FLOWER_KINDS;
};

/**
 * Grow the village day by day from start to today. kids: the family's kids (each with
 * daily, today, startDate and tasks). Returns {
 *   trees: [{ spot, grown, stage, mature }] (spots that have a tree),
 *   flowers: [{ spot, kind, grown, stage, blooming, age }] (age: days since it opened),
 *   wilt (0..3), goodDays, matureTrees, blooms, mark (today's mark so far),
 * }.
 */
export function villageGarden(kids, today, start = VILLAGE_START) {
  const trees = new Array(TREE_SPOTS).fill(null); // { grown, batch }
  const flowers = new Array(FLOWER_SPOTS).fill(null); // { grown, kind, opened }
  let wilt = 0; let badRun = 0; let goodDays = 0; let sinceFlowers = 0; let batch = 0;
  let lastMark = 'mid';
  let day = 0;
  const startTrees = () => {
    let n = 0;
    for (const i of TREE_ORDER) if (!trees[i] && n < TREE_BATCH) { trees[i] = { grown: 0, batch }; n += 1; }
    batch += 1;
  };
  const startFlowers = (day) => {
    let n = 0;
    for (const i of FLOWER_ORDER) if (!flowers[i] && n < FLOWER_BATCH) { flowers[i] = { grown: 0, kind: kindFor(i, day), opened: null }; n += 1; }
  };
  if (start > today) return result();
  startTrees();
  startFlowers(0);
  for (let key = start; key <= today && day < 4000; key = addDays(key, 1), day += 1) {
    // flowers that have been open long enough fade away first
    for (let i = 0; i < FLOWER_SPOTS; i += 1) if (flowers[i]?.opened !== null && flowers[i] && day - flowers[i].opened >= FLOWER_LIFE) flowers[i] = null;
    const { mark } = familyMark(kids, key, today);
    lastMark = mark;
    if (mark === 'good') {
      goodDays += 1; wilt = 0; badRun = 0; sinceFlowers += 1;
      for (const t of trees) if (t && t.grown < TREE_DAYS) t.grown += 1;
      for (const f of flowers) if (f && f.opened === null) { f.grown += 1; if (f.grown >= FLOWER_DAYS) f.opened = day; }
      // the next batch of trees once the youngest batch is old enough
      const youngest = trees.filter((t) => t && t.batch === batch - 1);
      if (youngest.length && youngest.every((t) => t.grown >= TREE_NEXT) && trees.some((t) => !t)) startTrees();
      if (sinceFlowers >= FLOWER_NEXT) { sinceFlowers = 0; startFlowers(day); }
    } else if (mark === 'bad') {
      badRun += 1;
      if (badRun % 2 === 0) wilt = Math.min(MAX_WILT, wilt + 1);
    } else {
      badRun = 0;
    }
  }
  return result();

  function result() {
    const treeList = trees.map((t, spot) => t && {
      spot, grown: t.grown, mature: t.grown >= TREE_DAYS,
      stage: t.grown >= TREE_DAYS ? TREE_STAGES - 1 : Math.min(TREE_STAGES - 2, Math.floor((t.grown / TREE_DAYS) * (TREE_STAGES - 1))),
    }).filter(Boolean);
    const lastDay = Math.max(0, day - 1);
    const flowerList = flowers.map((f, spot) => f && {
      spot, kind: f.kind, grown: f.grown, blooming: f.opened !== null, age: f.opened === null ? 0 : lastDay - f.opened,
      stage: f.opened !== null ? FLOWER_STAGES - 1 : Math.min(FLOWER_STAGES - 2, Math.floor((f.grown / FLOWER_DAYS) * (FLOWER_STAGES - 1))),
    }).filter(Boolean);
    return {
      trees: treeList, flowers: flowerList, wilt, goodDays,
      matureTrees: treeList.filter((t) => t.mature).length, blooms: flowerList.filter((f) => f.blooming).length, mark: lastMark,
    };
  }
}

/**
 * How lively the village is, 0..4, for which critters come out: more grown trees and more
 * flowers in bloom bring more of them. Wilting keeps them away.
 */
export function critterLevel(g) {
  if (g.wilt >= 2) return 0;
  const score = g.matureTrees * 2 + g.trees.filter((t) => t.stage >= 3).length + g.blooms / 5;
  const level = score >= 30 ? 4 : score >= 16 ? 3 : score >= 7 ? 2 : score >= 2 ? 1 : 0;
  return g.wilt ? Math.max(0, level - 1) : level;
}
