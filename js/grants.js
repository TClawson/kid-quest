// One-time gifts that put back things a kid lost to a bug. Each runs once per kid:
// its id goes in kid.grants (on the kid's synced record), so every device agrees and
// it never runs twice. Pure logic, no DOM.

import { itemById, isWorn } from './items.js';
import { spotById } from './furniture.js';

export const GRANTS = [
  // 2026-11-08: Edison bought the blue beanbag, then bought more right away, and the
  // second purchase wrote over the first (fixed in save(), js/app.js).
  { id: 'lost-beanbag-2026-11-08', kid: 'kid_mvymmw0y1kmwx', item: 'home-chair-bean-blue-plain' },
  // 2026-11-10: a device that opened on a very old copy of the family reset every kid's
  // owned list and coins spent (see giveLegacyItems in js/app.js). Ayden's Volcano island
  // isn't on his record anywhere else, so it comes back here; restoreFromRecord finds the rest.
  { id: 'lost-volcano-2026-11-10', kid: 'kid_mvymcmw11jnn8', item: 'bg-volcano' },
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

/**
 * Puts back bought things the kid's own record shows they had: a priced place,
 * hat or piece of gear the buddy has on (or keeps in its closet for another
 * buddy), furniture standing in the house, decorations in the garden. Only
 * owned things can be worn or placed, so each of these was bought once; if it
 * isn't in what the kid owns any more, an old copy wrote over the list (see
 * mergeSafe in js/store.js). Nothing is charged. Safe to run every time.
 * Returns true if it changed anything.
 */
export function restoreFromRecord(kid) {
  let changed = false;
  const give = (id, species) => {
    const item = itemById(id);
    if (!item || !(item.price || item.gems)) return;
    if (isWorn(item)) {
      if (!species) return;
      const mine = kid.buddyOwned?.[species] || [];
      if (mine.includes(id)) return;
      kid.buddyOwned = { ...(kid.buddyOwned || {}), [species]: [...mine, id] };
    } else {
      if ((kid.owned || []).includes(id)) return;
      kid.owned = [...(kid.owned || []), id];
    }
    changed = true;
  };
  const buddy = kid.buddy || {};
  for (const id of Object.values(buddy.outfit || {})) give(id, buddy.species);
  for (const [species, worn] of Object.entries(buddy.closet || {})) for (const id of Object.values(worn || {})) give(id, species);
  for (const id of Object.values(kid.home || {})) give(id);
  for (const id of Object.values(kid.gardenDecor || {})) give(id);
  return changed;
}
