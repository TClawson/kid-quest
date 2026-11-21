// The shortcut book: every hidden ski shortcut a kid has found, like the fish book (pure
// logic, no DOM). kid.skiBook = { [mapId]: { found: { [shortcutId]: entry }, best: { [snow]: seconds } } }
// entry = { day, snow, badge, snows: [snow kinds it was run on], best: fastest seconds through it }.
//
// Badges, like small / typical / trophy fish (Fable's review, 2026-11-21):
//   bronze  found it
//   silver  skied it clean (no bumps, no tumbles)
//   gold    skied it clean AND won the race
import { courseFor } from './skicourses.js';

export const BADGES = ['bronze', 'silver', 'gold'];
export const BADGE_NAMES = { bronze: 'Found', silver: 'Clean run', gold: 'Clean run + win' };
const rank = (b) => BADGES.indexOf(b);

/** The badge one run through a shortcut earns. */
export const badgeFor = (clean, won) => (clean && won ? 'gold' : clean ? 'silver' : 'bronze');

/**
 * Add one race to a kid's book. race = { map, snow, time (s), won, runs: [{ id, clean, secs }] }.
 * Returns { book: the new book (the old one is not changed), news: [{ id, name, first, badge, up }],
 * bestTime: true when this was the hill's fastest on this snow kind }.
 * first: never found before; up: a better badge than before.
 */
export function recordRace(book = {}, race, day) {
  const map = race.map;
  const page = book[map] || { found: {}, best: {} };
  const found = { ...page.found };
  const news = [];
  const names = Object.fromEntries(courseFor(map).shortcuts.map((s) => [s.id, s.name]));
  for (const run of race.runs || []) {
    if (!names[run.id]) continue;
    const badge = badgeFor(run.clean, race.won);
    const old = found[run.id];
    if (!old) {
      found[run.id] = { day, snow: race.snow, badge, snows: [race.snow], best: run.secs ?? null };
      news.push({ id: run.id, name: names[run.id], first: true, badge, up: false });
      continue;
    }
    const up = rank(badge) > rank(old.badge);
    const snows = old.snows?.includes(race.snow) ? old.snows : [...(old.snows || []), race.snow];
    const best = run.secs != null && (old.best == null || run.secs < old.best) ? run.secs : old.best;
    found[run.id] = { ...old, badge: up ? badge : old.badge, snows, best };
    if (up || snows !== old.snows) news.push({ id: run.id, name: names[run.id], first: false, badge: up ? badge : old.badge, up, stamp: snows !== old.snows ? race.snow : null });
  }
  const best = { ...page.best };
  const bestTime = race.time != null && (best[race.snow] == null || race.time < best[race.snow]);
  if (bestTime) best[race.snow] = race.time;
  return { book: { ...book, [map]: { found, best } }, news, bestTime };
}

/** How many of a hill's shortcuts are found: { found, total }. */
export function hillCount(book = {}, map) {
  const total = courseFor(map).shortcuts.length;
  return { found: Object.keys(book[map]?.found || {}).filter((id) => courseFor(map).shortcuts.some((s) => s.id === id)).length, total };
}

/** The ids found on a hill. */
export const foundIds = (book = {}, map) => new Set(Object.keys(book[map]?.found || {}));

/** The fastest time on a hill on any snow kind (seconds), or null. */
export function hillBest(book = {}, map) {
  const all = Object.values(book[map]?.best || {}).filter((t) => t != null);
  return all.length ? Math.min(...all) : null;
}
