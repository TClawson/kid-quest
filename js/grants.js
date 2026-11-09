// One-time gifts that put back things a kid lost to a bug. Each runs once per kid:
// its id goes in kid.grants (on the kid's synced record), so every device agrees and
// it never runs twice. Pure logic, no DOM.

import { itemById, isWorn } from './items.js';
import { spotById } from './furniture.js';

export const GRANTS = [
  // 2026-11-08: Edison bought the blue beanbag, then bought more right away, and the
  // second purchase wrote over the first (fixed in save(), js/app.js).
  { id: 'lost-beanbag-2026-11-08', kid: 'kid_mvymmw0y1kmwx', item: 'home-chair-bean-blue-plain' },
];

/**
 * Give each kid the grants meant for them that they haven't had yet. A piece of
 * furniture also goes into its spot in the house when that spot is empty.
 * Returns true if anything changed.
 */
export function applyGrants(state, grants = GRANTS) {
  let changed = false;
  for (const g of grants) {
    const kid = state.kids.find((k) => k.id === g.kid);
    const item = itemById(g.item);
    if (!kid || !item || isWorn(item) || (kid.grants || []).includes(g.id)) continue;
    if (!(kid.owned || []).includes(item.id)) kid.owned = [...(kid.owned || []), item.id];
    if (item.home && !kid.home?.[item.spot] && spotById(item.spot)) kid.home = { ...(kid.home || {}), [item.spot]: item.id };
    kid.grants = [...(kid.grants || []), g.id];
    changed = true;
  }
  return changed;
}
