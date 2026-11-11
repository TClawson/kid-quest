import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, addDays } from '../js/logic.js';
import { itemById } from '../js/items.js';
import { MUSIC_TIERS, tierInfo, musicTier, daysToMusicHouse, watchSplit, studioOpen, labOpen, LAB_NEEDS_CHORES, WATCH_MAX_RUN_MS } from '../js/musicrules.js';
import { dayEnd } from '../js/practice.js';
import { villageLayout, VILLAGE_THEMES } from '../js/villagemaps.js';

const day = '2026-11-11'; // a Wednesday

// ---------- which look the music house has ----------

test('each look belongs to a real piano, from the little keyboard up', () => {
  assert.deepEqual(MUSIC_TIERS.map((t) => t.tier), [1, 2, 3]);
  const weeks = MUSIC_TIERS.map((t) => itemById(t.piano)?.need?.pianoWeeks);
  assert.deepEqual(weeks, [2, 4, 6]);
  for (const t of MUSIC_TIERS) assert.ok(t.name && t.hello, `tier ${t.tier} has a name and a hello`);
  assert.equal(tierInfo(0).tier, 1, 'out of range is clamped');
  assert.equal(tierInfo(9).tier, 3);
});

test('the music house opens with the first piano and changes with every better one', () => {
  const at = (pianoBest, pianoPerWeek = 5) => musicTier({ pianoBest, pianoPerWeek, best: 0, owned: [] });
  assert.deepEqual([0, 9, 10, 19, 20, 29, 30, 99].map((d) => at(d)), [0, 0, 1, 1, 2, 2, 3, 3]);
  // a 3-days-a-week piano schedule needs fewer days
  assert.deepEqual([5, 6, 12, 18].map((d) => at(d, 3)), [0, 1, 2, 3]);
});

test('piano days still to go before the music house opens', () => {
  assert.equal(daysToMusicHouse({ piano: 0, pianoBest: 0, pianoPerWeek: 5 }), 10);
  assert.equal(daysToMusicHouse({ piano: 7, pianoBest: 7, pianoPerWeek: 5 }), 3);
  // a broken streak counts from where it is now: the best only grows along with it
  assert.equal(daysToMusicHouse({ piano: 6, pianoBest: 7, pianoPerWeek: 5 }), 4);
  assert.equal(daysToMusicHouse({ piano: 0, pianoBest: 10, pianoPerWeek: 5 }), 0, 'open for good once earned');
  assert.equal(daysToMusicHouse({ piano: 40, pianoBest: 40, pianoPerWeek: 5 }), 0);
  assert.equal(daysToMusicHouse({}), 10, 'no piano yet: Mon-Fri');
});

// ---------- the piano stopwatch ----------

const since = new Date(`${day}T16:00:00`).getTime();
const at = (s) => since + s * 1000;

test('the stopwatch fills the chore first, then counts extra', () => {
  const run = { day, since, chores: [{ id: 'p', base: 1780, total: 1800 }], extra: 0, session: 0 };
  assert.deepEqual(watchSplit(run, at(10)), { fill: { p: 1790 }, extra: 0, session: 10, gained: 10, capped: false });
  assert.deepEqual(watchSplit(run, at(20)), { fill: { p: 1800 }, extra: 0, session: 20, gained: 20, capped: false });
  assert.deepEqual(watchSplit(run, at(45)), { fill: { p: 1800 }, extra: 25, session: 45, gained: 45, capped: false });
  // earlier extra and earlier stopwatch time this visit carry on
  const later = { ...run, extra: 60, session: 100 };
  assert.deepEqual(watchSplit(later, at(45)), { fill: { p: 1800 }, extra: 85, session: 145, gained: 45, capped: false });
});

test('two piano chores fill one after the other, even all at once', () => {
  const run = { day, since, chores: [{ id: 'a', base: 300, total: 900 }, { id: 'b', base: 0, total: 900 }], extra: 0 };
  assert.deepEqual(watchSplit(run, at(500)).fill, { a: 800, b: 0 });
  // 25 minutes in another app: the first fills, the second gets the rest
  assert.deepEqual(watchSplit(run, at(1500)).fill, { a: 900, b: 900 });
  assert.equal(watchSplit(run, at(1500)).extra, 0);
  assert.equal(watchSplit(run, at(1600)).extra, 100);
});

test('with no piano chore left, it is all extra', () => {
  assert.deepEqual(watchSplit({ day, since, extra: 30 }, at(90.5)), { fill: {}, extra: 120, session: 90, gained: 90, capped: false });
  assert.deepEqual(watchSplit({ day, since, chores: [] }, at(5)).extra, 5);
});

test('the stopwatch stops at midnight, after the run limit, and never runs backwards', () => {
  const late = dayEnd(day) - 60_000;
  const s = watchSplit({ day, since: late, chores: [{ id: 'p', base: 0, total: 1800 }] }, dayEnd(day) + 3_600_000);
  assert.equal(s.gained, 60, 'time after midnight belongs to no one');
  assert.equal(s.fill.p, 60);
  const back = watchSplit({ day, since: late, chores: [{ id: 'p', base: 100, total: 1800 }] }, late - 5000);
  assert.deepEqual([back.gained, back.fill.p], [0, 100], 'a clock set back adds nothing');
  const forgot = watchSplit({ day, since: at(-6 * 3600) }, at(0));
  assert.equal(forgot.gained, WATCH_MAX_RUN_MS / 1000, 'a forgotten stopwatch counts its limit, no more');
  assert.equal(forgot.capped, true);
});

// ---------- the recording studio waits for today's chores ----------

test('the studio opens once today\'s chores are done and checked', () => {
  const s = emptyState();
  const kid = { id: 'k1', name: 'Ava', tasks: defaultTasks(), startDate: addDays(day, -30), owned: [] };
  s.kids.push(kid);
  const n = studioOpen(s, kid, day).left;
  assert.ok(n > 0);
  assert.deepEqual(studioOpen(s, kid, day), { open: false, left: n, waiting: 0 });
  s.log[day] = { k1: { tasks: {} } };
  for (const t of kid.tasks) s.log[day].k1.tasks[t.id] = { status: 'pending' };
  assert.deepEqual(studioOpen(s, kid, day), { open: false, left: 0, waiting: n }, 'waiting for a parent keeps it shut');
  for (const t of kid.tasks) s.log[day].k1.tasks[t.id] = { status: 'done' };
  assert.equal(studioOpen(s, kid, day).open, true);
  s.log[day].k1.tasks = {};
  s.log[day].k1.excused = true;
  assert.equal(studioOpen(s, kid, day).open, true, 'an excused day opens it too');
});

test('the Note-o-Matic opens when the studio does, or always when it needs no chores', () => {
  const s = emptyState();
  const kid = { id: 'k1', name: 'Ava', tasks: defaultTasks(), startDate: addDays(day, -30), owned: [] };
  s.kids.push(kid);
  assert.equal(LAB_NEEDS_CHORES, true);
  assert.deepEqual(labOpen(s, kid, day), studioOpen(s, kid, day));
  assert.equal(labOpen(s, kid, day).open, false);
  assert.deepEqual(labOpen(s, kid, day, false), { open: true, left: 0, waiting: 0 });
  s.log[day] = { k1: { tasks: {} } };
  for (const t of kid.tasks) s.log[day].k1.tasks[t.id] = { status: 'done' };
  assert.equal(labOpen(s, kid, day).open, true);
});

// ---------- the music hall in every village ----------

test('every village has a music hall with a door in front of it', () => {
  for (const theme of VILLAGE_THEMES) {
    const L = villageLayout(theme);
    assert.ok(L.music, `${theme} has a music hall`);
    assert.equal(L.music.door.x, L.music.x + L.music.w / 2, theme);
    assert.ok(L.music.door.y > L.music.y + L.music.h, `${theme}: the door spot is in front of the hall`);
  }
});
