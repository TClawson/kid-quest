// Real seasons on every map. The season follows the calendar (northern hemisphere, by
// month): spring Mar-May, summer Jun-Aug, autumn Sep-Nov, winter Dec-Feb. Pure logic, no
// DOM (seasonfx.js draws the weather and the snow).
//
// A parent can try another season on this device from Settings (kidquest.season in local
// storage); the kids see the real one.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const BY_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

/** The season on a day ('YYYY-MM-DD'). */
export function seasonOf(key) {
  const m = Number(String(key).slice(5, 7)) - 1;
  return BY_MONTH[m] || 'summer';
}

/**
 * How far into its season a day is, 0..1 (so autumn leaves can turn little by little and
 * the first snow can be light). Seasons are three whole months.
 */
export function seasonProgress(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  const first = [2, 5, 8, 11][Math.floor(((m + 9) % 12) / 3)]; // month index the season starts on
  const startYear = m - 1 < first ? y - 1 : y;
  const start = Date.UTC(startYear, first, 1);
  const end = Date.UTC(startYear, first + 3, 1);
  return Math.min(1, Math.max(0, (Date.UTC(y, m - 1, d) - start) / (end - start)));
}

const KEY = 'kidquest.season';
/** The season to show: a parent's try-out on this device if set, else the real one. */
export function shownSeason(key, storage = globalThis.localStorage) {
  let o = null;
  try { o = storage?.getItem(KEY); } catch { /* no storage */ }
  return SEASONS.includes(o) ? o : seasonOf(key);
}
/** Try a season on this device (null goes back to the real one). */
export function trySeason(season, storage = globalThis.localStorage) {
  try { if (SEASONS.includes(season)) storage?.setItem(KEY, season); else storage?.removeItem(KEY); } catch { /* fine */ }
}
