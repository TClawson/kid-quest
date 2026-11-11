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

// ---------- 2026-11-10: a phone opened on a copy of the family from about Nov 3 ----------
// Its first save failed, and the fallback (in js/cloud.js) then wrote its whole old copy
// of each kid over the server's: every kid's owned list, coins spent, outfit and
// Edison's fox hats went back to Nov 3. Ayden lost Volcano island and his rod, Remington
// his football, Esther the ocean, Edison his hockey stick, paintings and green cap.
// What each kid had on Taylor's backup of 2026-11-08, to put back once per kid:
const BACKUP_2026_11_08 = {
  kid_mvymcmw11jnn8: { owned: ['bg-volcano', 'sport-rod-regular'], buddyOwned: {}, spent: 300 }, // Ayden
  kid_mvymmw0y1kmwx: { owned: ['sport-hockey-regular', 'home-art-sunset', 'home-art-rainbow', 'home-art-fish'], buddyOwned: {'fox': ['hat-cap', 'hat-cap-green'], 'turtle': ['hat-cap', 'neck-bowtie-purple']}, spent: 290 }, // Edison
  kid_mvyopilp1bgqr: { owned: ['bg-ocean', 'sport-football-regular'], buddyOwned: {'panda': ['hat-beanie-pink', 'hat-cap-yellow'], 'fox': ['hat-cap-black'], 'dino': ['hat-beanie']}, spent: 340 }, // Remington
  kid_mvzflap11wbyq: { owned: ['bg-ocean'], buddyOwned: {'puppy': ['neck-bowtie-pink', 'hat-cap-purple']}, spent: 170 }, // Esther
};
export const RESTORE_ID = 'restore-2026-11-08-backup';

/** A shop price in coins of an id in kid.owned (a song is SONG_PRICE; gear costs gems, not coins). */
const coinPrice = (id) => (typeof id === 'string' && id.startsWith('song:') ? 20 : itemById(id)?.price || 0);

/**
 * Put back everything a kid had on the Nov 8 backup (lists only grow), and their coins
 * spent: what they had spent then, plus anything bought since that they own now, but
 * never more than earned (all the coins they have earned so far). Runs
 * once per kid (RESTORE_ID in kid.grants). Returns true if it changed the kid.
 */
export function restoreBackup(kid, backup = BACKUP_2026_11_08, earned = Infinity) {
  const was = backup[kid.id];
  if (!was || (kid.grants || []).includes(RESTORE_ID)) return false;
  const before = new Set(was.owned);
  const owned = [...(kid.owned || [])];
  for (const id of was.owned) if (!owned.includes(id)) owned.push(id);
  const buddyOwned = { ...(kid.buddyOwned || {}) };
  for (const [sp, ids] of Object.entries(was.buddyOwned)) {
    const mine = [...(buddyOwned[sp] || [])];
    for (const id of ids) if (!mine.includes(id)) mine.push(id);
    buddyOwned[sp] = mine;
  }
  let since = 0;
  for (const id of kid.owned || []) if (!before.has(id)) since += coinPrice(id);
  for (const [sp, ids] of Object.entries(kid.buddyOwned || {})) for (const id of ids) if (!(was.buddyOwned[sp] || []).includes(id)) since += coinPrice(id);
  kid.owned = owned;
  kid.buddyOwned = buddyOwned;
  // never more than the kid has earned: Ayden spent the coins the wipe gave back on the
  // rainforest, and he keeps it without owing coins for it
  kid.spent = Math.max(kid.spent || 0, Math.min(was.spent + since, earned));
  kid.grants = [...(kid.grants || []), RESTORE_ID];
  return true;
}

// ---------- the same wipe also took each kid's newest tasks ----------
// The old copy's task lists were written over the family's too: Shower, the bathroom
// chores and the bonus Exercise task (the only way to log exercise) vanished for
// Ayden, Edison and Remington. These are the ones on Taylor's backup of 2026-11-08 that
// the 2026-11-10 copy lacked. Put back once per kid; a task already there (same id) is left alone.
const LOST_TASKS_2026_11_08 = {
  kid_mvymcmw11jnn8: [
    {"id": "task_mw006j4y1sa26", "name": "Shower", "icon": "🚿", "period": "morning", "days": [0, 1, 2, 3, 4, 5, 6], "verify": "self", "minutes": 0, "coins": 2, "xp": 2},
    {"id": "task_mw06x753181xg", "name": "Wipe Down Bathroom ", "icon": "🚽", "period": "afternoon", "days": [1, 2, 3, 4], "verify": "self", "minutes": 0},
    {"id": "task_mw06y0gk249ox", "name": "Bathroom deep clean", "icon": "🚽", "period": "afternoon", "days": [5], "verify": "parent", "minutes": 0},
    {"id": "task_mw06yqyv36eyx", "name": "Exercise", "icon": "🏃", "period": "exercise", "days": [1, 2, 3, 4, 5, 6], "verify": "parent", "minutes": 0},
  ],
  kid_mvymmw0y1kmwx: [
    {"id": "task_mw008h4n2lvg3", "name": "Shower", "icon": "🚿", "period": "afternoon", "days": [0, 1, 2, 3, 4, 5, 6], "verify": "self", "minutes": 0, "coins": 2, "xp": 2},
    {"id": "task_mw0703jp4qk6j", "name": "Wipe down bathroom ", "icon": "🚽", "period": "afternoon", "days": [1, 2, 3, 4], "verify": "self", "minutes": 0, "everyOtherWeek": 1},
    {"id": "task_mw0719ue6gq54", "name": "Deep clean bathroom", "icon": "🚽", "period": "afternoon", "days": [5], "verify": "parent", "minutes": 0, "everyOtherWeek": 1},
    {"id": "task_mw07270o8qwl3", "name": "Exercise", "icon": "🏃", "period": "exercise", "days": [1, 2, 3, 4, 5, 6], "verify": "parent", "minutes": 0},
  ],
  kid_mvyopilp1bgqr: [
    {"id": "task_mw070uy15t6lt", "name": "Wipe down bathroom ", "icon": "🚽", "period": "afternoon", "days": [1, 2, 3, 4], "verify": "self", "minutes": 0, "everyOtherWeek": 0},
    {"id": "task_mw071suq7ft8m", "name": "Deep clean bathroom", "icon": "🚽", "period": "afternoon", "days": [5], "verify": "self", "minutes": 0, "everyOtherWeek": 0},
    {"id": "task_mw0sf3qj1ml7n", "name": "Exercise", "icon": "🏃", "period": "exercise", "days": [1, 2, 3, 4, 5], "verify": "parent", "minutes": 0},
  ],
  kid_mvzflap11wbyq: [
  ],
};
export const TASKS_RESTORE_ID = 'restore-tasks-2026-11-08';

/** Adds back the tasks the Nov 10 wipe removed, once per kid. Returns true if it changed the kid. */
export function restoreTasks(kid, lost = LOST_TASKS_2026_11_08) {
  const was = lost[kid.id];
  if (!was || (kid.grants || []).includes(TASKS_RESTORE_ID)) return false;
  const have = new Set((kid.tasks || []).map((t) => t.id));
  kid.tasks = [...(kid.tasks || []), ...was.filter((t) => !have.has(t.id)).map((t) => structuredClone(t))];
  kid.grants = [...(kid.grants || []), TASKS_RESTORE_ID];
  return true;
}

/**
 * Restoring a backup on a device that syncs with the family: only put back what's missing,
 * never take anything away or change what's there, because whatever this device saves goes
 * to every device. For each kid in both: bought things (owned, buddyOwned) and one-time
 * repairs already given (grants) are added to, and days the family has no record of for
 * that kid are added. Kids the family doesn't have, settings and coins are left alone.
 * Returns { kids, items, days }: how many kids matched, things put back, days put back.
 */
export function mergeBackup(state, backup) {
  const out = { kids: 0, items: 0, days: 0 };
  const union = (have = [], add = []) => {
    const next = [...have];
    for (const id of add) if (!next.includes(id)) { next.push(id); out.items += 1; }
    return next;
  };
  for (const old of backup?.kids || []) {
    const kid = state.kids.find((k) => k.id === old.id);
    if (!kid) continue;
    out.kids += 1;
    if ((old.owned || []).some((id) => !(kid.owned || []).includes(id))) kid.owned = union(kid.owned, old.owned);
    for (const [sp, ids] of Object.entries(old.buddyOwned || {})) {
      if (ids.some((id) => !(kid.buddyOwned?.[sp] || []).includes(id))) kid.buddyOwned = { ...(kid.buddyOwned || {}), [sp]: union(kid.buddyOwned?.[sp], ids) };
    }
    const grants = (old.grants || []).filter((g) => !(kid.grants || []).includes(g));
    if (grants.length) kid.grants = [...(kid.grants || []), ...grants];
    for (const [date, byKid] of Object.entries(backup.log || {})) {
      const entry = byKid?.[old.id];
      if (!entry || state.log?.[date]?.[old.id]) continue;
      state.log[date] = { ...(state.log[date] || {}), [old.id]: structuredClone(entry) };
      out.days += 1;
    }
  }
  return out;
}
