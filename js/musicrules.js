// The music house: it opens once the kid has earned their first piano, and gets a whole new
// look with each better piano (the music house's art is in musicart.js, walking round it in
// musichouse.js). Also the piano stopwatch's arithmetic. Pure logic, no DOM.

import { itemById, isUnlocked, pianoDaysNeeded } from './items.js';
import { dayEnd } from './practice.js';
import { dayStatus } from './logic.js';

// One look per piano, from the little keyboard (2-week piano streak) to the rock star piano.
export const MUSIC_TIERS = [
  { tier: 1, piano: 'music-keyboard', name: 'Cozy Studio', hello: 'Welcome to your music house! Walk up to your keyboard, the studio desk, the sheet music or the Note-o-Matic.' },
  { tier: 2, piano: 'music-upright', name: 'Music Parlor', hello: 'Whoa! Your new upright piano moved in, and the whole music house got a makeover!' },
  { tier: 3, piano: 'music-rock', name: 'Rock Arena', hello: 'WHOA! A rock star piano needs a rock star stage. Welcome to the Rock Arena!' },
];
export const tierInfo = (tier) => MUSIC_TIERS[Math.max(1, Math.min(3, tier)) - 1];

/**
 * Which look the music house has: 0 while it is still locked (no piano yet), then 1, 2 or 3
 * for the best piano the kid has earned. progress: items.js progress ({ pianoBest, pianoPerWeek }).
 */
export function musicTier(progress) {
  let tier = 0;
  for (const t of MUSIC_TIERS) if (isUnlocked(itemById(t.piano), progress)) tier = t.tier;
  return tier;
}

/** Piano days still to go before the music house opens (0 once it is open). */
export function daysToMusicHouse(progress) {
  const first = itemById(MUSIC_TIERS[0].piano);
  return Math.max(0, pianoDaysNeeded(first, progress) - (progress.pianoBest || 0));
}

// ---------- the piano stopwatch ----------
// The stopwatch is the practice timer counting up instead of down. While today's piano
// timer chore still has time to go, stopwatch time fills it (and finishes the chore when it
// is full), just like the timer; time past that is extra practice, kept in the day's entry
// (entry.pianoExtra, seconds). With no piano timer chore today, it is all extra.

/** Whether stopwatch time also counts toward today's piano chore (Taylor's call). */
export const WATCH_FILLS_CHORE = true;

/**
 * Where a stopwatch run's seconds have gone so far. run: {
 *   day, since (ms when this run started), base (the chore's seconds before it; 0 with no chore),
 *   extra (extra seconds before it), session (seconds on the stopwatch this visit, before it),
 * } and total: the chore's length in seconds (0 when it isn't counting toward a chore).
 * Returns { chore, extra, session, gained }: the chore's seconds (never past total), the day's
 * extra seconds, this visit's seconds, and the seconds this run added.
 */
export function watchSplit(run, now, total = 0) {
  const end = Math.min(now, dayEnd(run.day));
  const gained = Math.max(0, Math.floor((end - run.since) / 1000));
  const session = (run.session || 0) + gained;
  if (!total) return { chore: 0, extra: (run.extra || 0) + gained, session, gained };
  const sum = (run.base || 0) + gained;
  return { chore: Math.min(total, sum), extra: (run.extra || 0) + Math.max(0, sum - total), session, gained };
}

/**
 * Whether the recording studio is open today: like the visitor games, once every one of
 * today's chores is done and checked (an excused day opens it too). The piano and the sheet
 * music are always open. Returns { open, left, waiting }: chores still to do, and chores
 * done but waiting for a parent to check them.
 */
export function studioOpen(state, kid, today) {
  const s = dayStatus(state, kid, today, today);
  return { open: s.excused || s.complete, left: Math.max(0, s.total - s.done - s.pending), waiting: s.pending };
}
