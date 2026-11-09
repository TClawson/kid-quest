import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, addDays } from '../js/logic.js';
import { itemById } from '../js/items.js';
import { MUSIC_TIERS, tierInfo, musicTier, daysToMusicHouse, watchSplit, studioOpen } from '../js/musicrules.js';
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
  assert.equal(daysToMusicHouse({ pianoBest: 0, pianoPerWeek: 5 }), 10);
  assert.equal(daysToMusicHouse({ pianoBest: 7, pianoPerWeek: 5 }), 3);
  assert.equal(daysToMusicHouse({ pianoBest: 10, pianoPerWeek: 5 }), 0);
  assert.equal(daysToMusicHouse({ pianoBest: 40, pianoPerWeek: 5 }), 0, 'never below zero');
  assert.equal(daysToMusicHouse({}), 10, 'no piano yet: Mon-Fri');
});

// ---------- the piano stopwatch ----------

test('the stopwatch fills the chore first, then counts extra', () => {
  const since = new Date(`${day}T16:00:00`).getTime();
  const run = { day, since, base: 1780, extra: 0, session: 0 };
  assert.deepEqual(watchSplit(run, since + 10_000, 1800), { chore: 1790, extra: 0, session: 10, gained: 10 });
  assert.deepEqual(watchSplit(run, since + 20_000, 1800), { chore: 1800, extra: 0, session: 20, gained: 20 });
  assert.deepEqual(watchSplit(run, since + 45_000, 1800), { chore: 1800, extra: 25, session: 45, gained: 45 });
  // earlier extra and earlier stopwatch time this visit carry on
  const later = { ...run, extra: 60, session: 100 };
  assert.deepEqual(watchSplit(later, since + 45_000, 1800), { chore: 1800, extra: 85, session: 145, gained: 45 });
});

test('with no piano chore left, it is all extra', () => {
  const since = new Date(`${day}T16:00:00`).getTime();
  assert.deepEqual(watchSplit({ day, since, extra: 30 }, since + 90_500, 0), { chore: 0, extra: 120, session: 90, gained: 90 });
});

test('the stopwatch stops at midnight and never runs backwards', () => {
  const since = dayEnd(day) - 60_000;
  const s = watchSplit({ day, since, base: 0 }, dayEnd(day) + 3_600_000, 1800);
  assert.equal(s.gained, 60, 'time after midnight belongs to no one');
  assert.equal(s.chore, 60);
  const back = watchSplit({ day, since, base: 100 }, since - 5000, 1800);
  assert.deepEqual([back.gained, back.chore], [0, 100], 'a clock set back adds nothing');
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

// ---------- the music hall in every village ----------

test('every village has a music hall with a door in front of it', () => {
  for (const theme of VILLAGE_THEMES) {
    const L = villageLayout(theme);
    assert.ok(L.music, `${theme} has a music hall`);
    assert.equal(L.music.door.x, L.music.x + L.music.w / 2, theme);
    assert.ok(L.music.door.y > L.music.y + L.music.h, `${theme}: the door spot is in front of the hall`);
  }
});
