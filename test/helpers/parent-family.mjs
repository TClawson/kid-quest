// A made-up family on a busy day, for the parents' Today tests and previews:
// - Ayden: 4 done, 2 waiting (piano timer with time in other apps, chore of the week), 3 to go
// - Remington: 5 done, homework waiting today and from yesterday, 3 to go (piano part-way)
// - Esther: all 7 done, chest opened
// - Edison: 1 done, 3 to go
// Every chore is on every day, so it looks the same whichever day the test runs.
// Ayden, Esther and Edison did every chore Monday to Friday last week: 3 Friday rewards to hand out.
import { emptyState, addDays, weekStart, entryFor, tasksForDay, fallbackHash } from '../../js/logic.js';
import { TEST_DAY, at } from './clock.mjs';

const ALL = [0, 1, 2, 3, 4, 5, 6];
const chore = (id, name, icon, extra = {}) => ({ id, name, icon, period: 'morning', days: ALL, verify: 'self', minutes: 0, ...extra });

// t: the day the page is on, now: the page's time then (noon unless told; see clock.mjs).
export function parentFamily(t = TEST_DAY, now = at(t).getTime()) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const start = addDays(weekStart(t), -21);
  s.settings.allowance = { on: true, coins: 300, xp: 300, bonus: 50, since: start, startFixed: true };
  const piano = (id) => chore(id, 'Piano practice', '🎹', { period: 'afternoon', verify: 'parent', minutes: 30, background: true });
  const kids = [
    {
      id: 'kid_ayden', name: 'Ayden', color: '#4dabf7', buddy: { species: 'dino', outfit: { background: 'bg-meadow', hat: 'hat-headphones' } },
      tasks: [chore('a_teeth', 'Brush teeth', '🪥'), chore('a_bed', 'Make bed', '🛏️'), chore('a_floor', 'Clear bedroom floor', '🧸'), chore('a_dog', 'Feed the dog', '🐶'),
        piano('a_piano'), chore('a_cotw', 'Chore of the week', '🧽', { period: 'afternoon', verify: 'parent' }), chore('a_hw', 'Homework', '📚', { period: 'afternoon', verify: 'parent' }),
        chore('a_table', 'Set the table', '🍴', { period: 'afternoon' }), chore('a_shower', 'Shower', '🚿', { period: 'afternoon', evening: true }),
        chore('a_soccer', 'Soccer practice', '⚽', { period: 'exercise', verify: 'parent' })],
    },
    {
      id: 'kid_remi', name: 'Remington', color: '#69db7c', buddy: { species: 'puppy', outfit: { background: 'bg-meadow', hat: 'hat-cap' } },
      tasks: [chore('r_teeth', 'Brush teeth', '🪥'), chore('r_bed', 'Make bed', '🛏️'), chore('r_floor', 'Clear bedroom floor', '🧸'), chore('r_dog', 'Feed the dog', '🐶'),
        chore('r_table', 'Set the table', '🍴', { period: 'afternoon' }), chore('r_hw', 'Homework', '📚', { period: 'afternoon', verify: 'parent' }),
        piano('r_piano'), chore('r_cotw', 'Chore of the week', '🧽', { period: 'afternoon', verify: 'parent' }), chore('r_shower', 'Shower', '🚿', { period: 'afternoon', evening: true }),
        chore('r_soccer', 'Soccer practice', '⚽', { period: 'exercise', verify: 'parent' })],
    },
    {
      id: 'kid_esther', name: 'Esther', color: '#da77f2', buddy: { species: 'cat', outfit: { background: 'bg-meadow', hat: 'hat-beanie' } },
      tasks: [chore('e_teeth', 'Brush teeth', '🪥'), chore('e_bed', 'Make bed', '🛏️'), chore('e_floor', 'Clear bedroom floor', '🧸'), chore('e_cat', 'Feed the cat', '🐱'),
        piano('e_piano'), chore('e_read', 'Reading', '📖', { period: 'afternoon' }), chore('e_dish', 'Unload dishwasher', '🍽️', { period: 'afternoon' })],
    },
    {
      id: 'kid_edison', name: 'Edison', color: '#ffa94d', buddy: { species: 'turtle', outfit: { background: 'bg-meadow' } },
      tasks: [chore('d_teeth', 'Brush teeth', '🪥'), chore('d_bed', 'Make bed', '🛏️'), chore('d_toys', 'Put toys away', '🧸', { period: 'afternoon' }),
        chore('d_bath', 'Bath', '🛁', { period: 'afternoon', evening: true })],
    },
  ];
  for (const k of kids) s.kids.push({ ...k, startDate: start, owned: Object.values(k.buddy.outfit), spent: 0, seenUnlocks: [] });
  const set = (kidId, key, id, rec) => { entryFor(s, kidId, key, true).tasks[id] = rec; };
  // last week Monday to Friday: every chore done for Ayden, Esther and Edison
  const lastMonday = addDays(weekStart(t), -7);
  for (let i = 0; i < 5; i += 1) {
    const key = addDays(lastMonday, i);
    if (key >= t) break;
    for (const kid of s.kids.filter((k) => k.id !== 'kid_remi')) {
      for (const task of tasksForDay(s, kid, key, t)) if (task.period !== 'exercise') set(kid.id, key, task.id, { status: 'done', by: 'self', at: now - 86400000 });
    }
  }
  const done = (kidId, ids) => ids.forEach((id) => set(kidId, t, id, { status: 'done', by: 'self', at: now - 3600000 }));
  done('kid_ayden', ['a_teeth', 'a_bed', 'a_floor', 'a_dog']);
  set('kid_ayden', t, 'a_piano', { status: 'pending', at: now - 600000, seconds: 1800, away: 420 });
  set('kid_ayden', t, 'a_cotw', { status: 'pending', at: now - 1200000 });
  done('kid_remi', ['r_teeth', 'r_bed', 'r_floor', 'r_dog', 'r_table']);
  set('kid_remi', t, 'r_hw', { status: 'pending', at: now - 1200000 });
  set('kid_remi', t, 'r_piano', { seconds: 660 });
  set('kid_remi', addDays(t, -1), 'r_hw', { status: 'pending', at: now - 86400000 });
  done('kid_esther', s.kids[2].tasks.map((x) => x.id));
  entryFor(s, 'kid_esther', t).chest = { kind: 'coins', coins: 20, tier: 'wood', at: now - 600000 };
  done('kid_edison', ['d_teeth']);
  // the weekly reward celebrations and Saturday popups already seen
  s.celebrations = Object.fromEntries(s.kids.map((k) => [k.id, { sat: t, reward: weekStart(t) }]));
  return s;
}
