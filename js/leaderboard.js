// The family leaderboard for the visitor games (the chart on the buddy's house wall).
// Pure logic, no DOM.
//
// All-time bests are kid.playBest[game] (kept since the games came out). This week's bests
// are kid.gameBests = { week: '2026-11-08', best: { soccer: 14, tag: 22.5 } }: the week is
// named by its Sunday and runs from Sunday 00:00 to the next Sunday 00:00, local time. Both
// live on the kid's own document, so every family device can read them (like outfits).

import { addDays, dayOfWeek } from './logic.js';

// The games that keep a score, in the order the chart lists them.
export const BOARD_GAMES = [
  { id: 'soccer', name: 'Keepy-uppy', icon: '⚽', unit: (n) => `${n} ${n === 1 ? 'kick' : 'kicks'}` },
  { id: 'tag', name: 'Tag', icon: '🏃', unit: (n) => `${Number(n).toFixed(1)} s` },
  { id: 'hockey', name: 'Hockey', icon: '🏒', unit: (n) => `${n} ${n === 1 ? 'goal' : 'goals'}` },
  { id: 'football', name: 'Football', icon: '🏈', unit: (n) => `${n} ${n === 1 ? 'point' : 'points'}` },
  { id: 'fishing', name: 'Fishing', icon: '🎣', unit: (n) => `${n} ${n === 1 ? 'point' : 'points'}` },
];

/** The Sunday a day's week starts on (weeks run Sunday to Saturday). */
export const weekOf = (key) => addDays(key, -dayOfWeek(key));

/** kid.gameBests after a game ends with this score (only a better score this week changes it). */
export function recordWeekBest(kid, game, score, today) {
  const week = weekOf(today);
  const was = kid?.gameBests?.week === week ? kid.gameBests.best || {} : {};
  if (!(Number(score) > 0) || (was[game] || 0) >= score) return kid?.gameBests?.week === week ? kid.gameBests : { week, best: was };
  return { week, best: { ...was, [game]: score } };
}

/** A kid's best this week in a game (0 if none, or if their bests are from an older week). */
export const weekBest = (kid, game, today) => (kid?.gameBests?.week === weekOf(today) ? kid.gameBests.best?.[game] || 0 : 0);

/**
 * The chart: for 'week' or 'all', one list per game, best first, with every kid in the
 * family: [{ game, rows: [{ id, name, color, buddy, score, place }] }]. A kid with no score
 * yet has score 0 and place 0 (listed last). Kids that tie share a place.
 */
export function leaderboard(kids, mode, today) {
  return BOARD_GAMES.map((g) => {
    const rows = kids.map((k) => ({ id: k.id, name: k.name, color: k.color, buddy: k.buddy, score: mode === 'week' ? weekBest(k, g.id, today) : Number(k.playBest?.[g.id]) || 0 }));
    rows.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
    let place = 0; let last = null;
    rows.forEach((r, i) => {
      if (!r.score) { r.place = 0; return; }
      if (r.score !== last) { place = i + 1; last = r.score; }
      r.place = place;
    });
    return { game: g, rows };
  });
}
