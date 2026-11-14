// The music house: it opens once the kid has earned their first piano, and gets a whole new
// look with each better piano (the music house's art is in musicart.js, walking round it in
// musichouse.js). Also the piano stopwatch's arithmetic. Pure logic, no DOM.

import { itemById, isUnlocked, pianoDaysNeeded } from './items.js';
import { dayEnd } from './practice.js';
import { dayStatus } from './logic.js';

// One look per piano, from the little keyboard (2-week piano streak) to the rock star piano.
export const MUSIC_TIERS = [
  { tier: 1, piano: 'music-keyboard', name: 'Cozy Studio', hello: 'Welcome to your music house! Walk up to your keyboard, the studio desk, the sheet music, the Note-o-Matic or the composing desk.' },
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

/**
 * Piano days in a row still to go before the music house opens (0 once it is open). It
 * counts from the current piano streak, since the best streak only grows along with it.
 */
export function daysToMusicHouse(progress) {
  if (musicTier(progress)) return 0;
  const first = itemById(MUSIC_TIERS[0].piano);
  return Math.max(1, pianoDaysNeeded(first, progress) - (progress.piano || 0));
}

// ---------- the piano stopwatch ----------
// The stopwatch is the practice timer counting up instead of down. While today's piano
// timer chores still have time to go, stopwatch time fills them in order (and finishes
// each one when it is full), just like the timer; time past that is extra practice, kept
// in the day's entry (entry.pianoExtra, seconds). With no piano timer chore today, it is
// all extra.

/** Whether stopwatch time also counts toward today's piano chore (Taylor's call). */
export const WATCH_FILLS_CHORE = true;

/**
 * A stopwatch run counts at most this long. When the buddy listens, it naps and pauses the
 * stopwatch as soon as the piano stops (like the timer), so this is for a stopwatch nobody
 * can hear: listening off, offline, or left running in another app.
 */
export const WATCH_MAX_RUN_MS = 2 * 3600_000;

/**
 * Where a stopwatch run's seconds have gone so far. run: {
 *   day, since (ms when this run started),
 *   chores: [{ id, base, total }]: the piano chores it fills, in order (base: their seconds
 *     before it, total: their length in seconds),
 *   extra (extra seconds before it), session (seconds on the stopwatch this visit, before it),
 * }. A run stops counting at midnight and after WATCH_MAX_RUN_MS.
 * Returns { fill: { choreId: seconds }, extra, session, gained, capped }: each chore's seconds
 * (never past its total), the day's extra seconds, this visit's seconds, the seconds this run
 * added, and whether the run reached its limit.
 */
export function watchSplit(run, now) {
  const limit = run.since + WATCH_MAX_RUN_MS;
  const end = Math.min(now, dayEnd(run.day), limit);
  const gained = Math.max(0, Math.floor((end - run.since) / 1000));
  let left = gained;
  const fill = {};
  for (const c of run.chores || []) {
    const base = c.base || 0;
    const add = Math.min(left, Math.max(0, c.total - base));
    fill[c.id] = base + add;
    left -= add;
  }
  return { fill, extra: (run.extra || 0) + left, session: (run.session || 0) + gained, gained, capped: now >= limit };
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

/** Whether the Note-o-Matic's own screen waits for today's chores, like the studio. */
export const LAB_NEEDS_CHORES = true;

/**
 * Whether the Note-o-Matic robot's screen is open today: what studioOpen says while
 * LAB_NEEDS_CHORES, always open otherwise. Returns { open, left, waiting }.
 */
export function labOpen(state, kid, today, needs = LAB_NEEDS_CHORES) {
  return needs ? studioOpen(state, kid, today) : { open: true, left: 0, waiting: 0 };
}

/**
 * Whether the composing desk is open today: like the studio, once today's chores are done
 * (Taylor's call, 2026-11-14). Returns { open, left, waiting }.
 */
export function deskOpen(state, kid, today) {
  return studioOpen(state, kid, today);
}
