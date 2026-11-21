// When new sports gear goes on sale (Taylor, 2026-11-20): every new gear game is merged when it
// is ready, but each one only unlocks for purchase in the shop on a Friday, one a week. Until its
// day it shows in the shop as "Coming soon" (items.js comingSoon). Days are the device's own date
// (the family's tablets are in Denver).
//
// Shared by the gear threads (camera, sled, bike, shovel, skis): keep this file the same in every
// branch; changes go through the sled thread. A copy lives at /mnt/project-files/winter-sports/.

/** Gear kind (SPORTS id in items.js) -> the Friday it goes on sale, 'YYYY-MM-DD'. */
export const GEAR_RELEASES = {
  camera: '2026-11-20',
  sled: '2026-11-27',
  bike: '2026-12-04',
  shovel: '2026-12-11',
  skis: '2026-12-18',
};

/** Today on this device, 'YYYY-MM-DD'. */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The day a shop item goes on sale, or null when it has no release day. */
export const releaseDay = (item) => (item?.slot === 'sport' && GEAR_RELEASES[item.kind]) || null;

/** True when an item is not on sale yet on this day. */
export function notYet(item, day = localDay()) {
  const d = releaseDay(item);
  return Boolean(d && day < d);
}

/** "Friday, Nov 27" for a release day. */
export function releaseLabel(day) {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
