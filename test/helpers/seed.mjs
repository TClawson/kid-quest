import { dateKey } from '../../js/logic.js';

/**
 * Mark today's Saturday free-games popup as already seen for every kid, so smoke tests
 * that click straight through behave the same on a Saturday as on any other day.
 */
export function seenSaturday(state) {
  state.celebrations ||= {};
  for (const k of state.kids) state.celebrations[k.id] = { ...(state.celebrations[k.id] || {}), sat: dateKey() };
  return state;
}
