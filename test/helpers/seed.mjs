import { dateKey, weekStart } from '../../js/logic.js';

/**
 * Mark today's Saturday free-games popup, and this week's weekly-reward
 * celebration (it pops up on Friday and over the weekend), as already seen for
 * every kid, so smoke tests that click straight through behave the same on any day.
 */
export function seenSaturday(state) {
  state.celebrations ||= {};
  const t = dateKey();
  for (const k of state.kids) state.celebrations[k.id] = { ...(state.celebrations[k.id] || {}), sat: t, reward: weekStart(t) };
  return state;
}
