// Dates in browser tests. A test that works out "today" in Node and then checks what the page
// wrote under its own "today" breaks when the run crosses midnight: Node says one day, the page
// the next (a CI run once failed at 00:00:00 UTC that way). So a test takes its day once, here,
// and starts the page's clock at a fixed mid-day time of that day (useTestDay), or installs the
// page's clock at a time of that day itself (page.clock.install({ time: at(TEST_DAY, '16:30') })).
// A script that needs the page's real clock (real timers, audio, the sync emulators) reads the
// day from the page instead (pageDay).
import { dateKey, addDays, freeGamesOn } from '../../js/logic.js';

/**
 * The test's day ('YYYY-MM-DD'), worked out once when the test starts. Never a Saturday: on
 * Saturday the kid's page opens with the free games pop-up (saturday.mjs tests it on days of its
 * own), which would sit over whatever a test taps first, so a Saturday run uses the day before.
 */
export const TEST_DAY = freeGamesOn(dateKey()) ? addDays(dateKey(), -1) : dateKey();

/** A time of a day as a Date, in local time like the app's days: at('2026-11-11', '16:30'). */
export const at = (day = TEST_DAY, time = '12:00') => new Date(`${day}T${time}:00`);

/** Noon on the test's day, in ms: "now" for seeded times (asked 20 minutes ago, done an hour ago). */
export const TEST_NOW = at().getTime();

/**
 * Starts the page's (or a browser context's) clock at a time of the test's day, noon unless told,
 * and lets it run on from there like a real clock (timers, animations and Date all move as usual).
 * From noon, a run would need twelve hours to reach the next day, so the page's today stays the
 * test's today however long the run takes, whatever the wall clock says. Call it before the page
 * loads the app. A test that steps time itself installs the clock the same way (at(day, time)).
 */
export async function useTestDay(target, { day = TEST_DAY, time = '12:00' } = {}) {
  await target.clock.install({ time: at(day, time) });
}

/** The day the page thinks it is (logic.js's dateKey, run in the page). */
export function pageDay(page) {
  return page.evaluate(async () => (await import('./js/logic.js')).dateKey());
}
