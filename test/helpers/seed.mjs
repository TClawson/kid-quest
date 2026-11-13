import { weekStart } from '../../js/logic.js';
import { TEST_DAY } from './clock.mjs';

/**
 * Mark today's Saturday free-games popup, and this week's weekly-reward
 * celebration (it pops up on Friday and over the weekend), as already seen for
 * every kid, so smoke tests that click straight through behave the same on any day.
 * t: the day the page is on (the test's day, see clock.mjs).
 */
export function seenSaturday(state, t = TEST_DAY) {
  state.celebrations ||= {};
  for (const k of state.kids) state.celebrations[k.id] = { ...(state.celebrations[k.id] || {}), sat: t, reward: weekStart(t) };
  return state;
}
