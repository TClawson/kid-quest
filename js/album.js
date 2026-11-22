// The critter album: the kid's best photo of every animal from the photo train
// (js/phototrain.js). Pure logic plus the photos kept on this device; the album page itself is
// drawn in app.js.
//
//   kid.critterAlbum = { 'meadow-fox': { q: 'perfect', slots: ['portrait', 'close'], map: 'bg-meadow',
//     date: '2026-11-21', season: 'autumn', weather: 'rain' } }
//   kid.critterClues = { 'bg-meadow': 2 }  // clues to each map's legend (3 bring it)
//
// The album records sync with the family like the fish book. The photos themselves are pictures,
// too big for the family copy, so each one stays on the device that took it (kept in local
// storage, small). A device without the photo shows the animal's own picture instead.
import { CRITTERS, critterById, CRITTER_MAPS, better, SLOTS, inSeason } from './critters.js';

/**
 * Adds a photo to the album. shot: { critter, quality, slots, map, season, weather }.
 * Returns { album, isNew, first, better } (album unchanged when nothing new).
 */
export function recordPhoto(album = {}, shot, date) {
  if (!shot?.critter || shot.quality === 'blurry' || !critterById(shot.critter)) return { album, isNew: false };
  const old = album[shot.critter];
  const slots = [...new Set([...(old?.slots || []), ...(shot.slots || [])])].filter((s) => SLOTS[s]);
  const up = !old || better(shot.quality, old.q);
  const gotSlot = slots.length > (old?.slots?.length || 0);
  if (!up && !gotSlot) return { album, isNew: false };
  const rec = up
    ? { q: shot.quality, slots, map: shot.map, date, season: shot.season, weather: shot.weather }
    : { ...old, slots };
  return { album: { ...album, [shot.critter]: rec }, isNew: true, first: !old, better: Boolean(old) && up };
}

/** How many animals the kid has, of how many. */
export function albumCount(album = {}) {
  const ids = Object.keys(album).filter((id) => critterById(id));
  return { found: ids.length, total: CRITTERS.length };
}

const MAP_NAMES = {
  'bg-meadow': 'Forest Village', 'bg-fjord': 'Alaskan Fjord', 'bg-space': 'Moon Base', 'bg-castle': 'Castle',
  'bg-sunset': 'Sunset Beach', 'bg-ocean': 'Under the Sea', 'bg-volcano': 'Volcano Island', 'bg-rainforest': 'Rainforest',
  'bg-rainbow': 'Rainbow Land', 'bg-galaxy': 'Golden Galaxy',
};
/** The album's pages: one per map (the kid's own map first), each with its animals. */
export function albumPages(album = {}, first = 'bg-meadow', season = null) {
  const maps = [...CRITTER_MAPS].sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
  return maps.map((map) => ({
    map,
    name: MAP_NAMES[map] || map,
    animals: CRITTERS.filter((c) => c.map === map).map((c) => ({ c, rec: album[c.id] || null, now: season ? inSeason(c, season) : true })),
  }));
}

// ---------- clues to each map's legend ----------
export const CLUES_FOR_LEGEND = 3;
export const addClue = (clues = {}, map) => ({ ...clues, [map]: Math.min(CLUES_FOR_LEGEND, (clues[map] || 0) + 1) });
/** Once the legend is in the album its clues are spent. */
export const spendClues = (clues = {}, map) => { const out = { ...clues }; delete out[map]; return out; };

// ---------- the photos, on this device ----------
const KEY = 'kidquest.photos';
const MAX_W = 96; // photos are kept small
function readAll(storage) { try { return JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { return {}; } }
/** The kept photo of an animal for a kid (a data URL), or null. */
export function photoOf(kidId, critterId, storage = globalThis.localStorage) {
  return readAll(storage)[`${kidId}|${critterId}`] || null;
}
/** Keeps a photo (a canvas) for a kid's animal, shrunk to MAX_W wide. */
export function keepPhoto(kidId, critterId, pic, storage = globalThis.localStorage) {
  if (!pic || !storage) return false;
  try {
    const k = Math.min(1, MAX_W / pic.width);
    const c = document.createElement('canvas');
    c.width = Math.round(pic.width * k); c.height = Math.round(pic.height * k);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(pic, 0, 0, c.width, c.height);
    const all = readAll(storage);
    all[`${kidId}|${critterId}`] = c.toDataURL('image/png');
    storage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}
