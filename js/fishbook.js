// The fish book and the fish tank in the buddy's house. Pure logic, no DOM.
//
// Every kind of fish the kid can catch in the fishing game is its own species here: each map's
// lake has five kinds plus one rare fish of its own (fishing.js SPOTS), so 9 maps x 6 = 54.
// The kid's biggest catch of each lives on the kid's own synced record:
//   kid.fishRecords = { 'meadow-bluegill': { size: 9, points: 22, map: 'bg-meadow', date: '2026-11-09' } }
// size is in inches (what the catch card shows); points break a tie between two catches of the
// same size (they go up with the fish's exact size). The fish in the tank is
//   kid.tank = { species: 'meadow-trout', nickname: 'Goldie' }.

import { SPOTS, SPECIES, lookFor } from './fishing.js';

/** The maps with a fishing spot, in the order the book shows them. */
export const FISH_MAPS = Object.keys(SPOTS);

/** A species id: the map without 'bg-', then the kind (or the map's rare fish's own id). */
export const speciesId = (map, kind) => `${String(map).replace(/^bg-/, '')}-${kind}`;

const KINDS = Object.keys(SPECIES);

/** Every species: { id, map, mapName, kind, name, rare, look, inches: [min, max], len: [min, max] }. */
export const FISH_SPECIES = FISH_MAPS.flatMap((map) => {
  const spot = SPOTS[map];
  const one = (kind, likeKey) => {
    const base = SPECIES[kind === 'special' ? spot.special.as : kind];
    const { name, look } = lookFor(map, kind);
    return { id: speciesId(map, likeKey), map, mapName: spot.name, kind, name, rare: kind === 'special', look, inches: base.inches, len: base.len };
  };
  return [...KINDS.map((k) => one(k, k)), one('special', spot.special.id)];
});
const BY_ID = new Map(FISH_SPECIES.map((s) => [s.id, s]));

/** A species by id, or null. */
export const fishSpecies = (id) => BY_ID.get(id) || null;

/** The species of a catch in the fishing game: kind is the fish's kind or the rare fish's id. */
export function catchSpecies(map, kind) {
  const m = SPOTS[map] ? map : FISH_MAPS[0]; // a map with no lake of its own fishes at Forest Lake
  return fishSpecies(speciesId(m, kind));
}

const better = (a, b) => !b || a.size > b.size || (a.size === b.size && (a.points || 0) > (b.points || 0));

/**
 * Records a catch: { species, size (inches), points, map, date }. Returns { records, record,
 * first, isNew }: records is the kid's records after it (a new object when it changed, the
 * same one when not), isNew whether this catch is now the record (first: the kid's first of
 * this species). Unknown species and sizes that aren't numbers are ignored.
 */
export function recordCatch(records, c) {
  const was = records && typeof records === 'object' ? records : {};
  const sp = fishSpecies(c?.species);
  const size = Number(c?.size);
  if (!sp || !(size > 0)) return { records: was, record: null, first: false, isNew: false };
  const rec = { size: Math.round(size), points: Math.max(0, Math.round(Number(c.points) || 0)), map: sp.map, date: String(c.date || '') };
  const old = was[sp.id];
  if (!better(rec, old)) return { records: was, record: old, first: false, isNew: false };
  return { records: { ...was, [sp.id]: rec }, record: rec, first: !old, isNew: true };
}

/** How many species the kid has caught, out of how many there are. */
export function bookCount(records) {
  return { caught: FISH_SPECIES.filter((s) => records?.[s.id]).length, total: FISH_SPECIES.length };
}

/**
 * The fish book's pages: one per map, [{ map, name, fish: [{ ...species, record }] }], with
 * record null for a fish not caught yet. first: a map to put first (the kid's own map).
 */
export function bookPages(records, first = null) {
  const maps = first && SPOTS[first] ? [first, ...FISH_MAPS.filter((m) => m !== first)] : FISH_MAPS;
  return maps.map((map) => ({
    map,
    name: SPOTS[map].name,
    fish: FISH_SPECIES.filter((s) => s.map === map).map((s) => ({ ...s, record: records?.[s.id] || null })),
  }));
}

/** The longest nickname. */
export const NICK_MAX = 16;

/** A nickname as typed, made tidy: plain text on one line, no extra spaces, at most 16 characters. */
export function cleanNickname(s) {
  const plain = String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...plain].slice(0, NICK_MAX).join('').trim();
}

/**
 * kid.tank after the kid picks a fish and names it: only a species the kid has caught can go
 * in (else null). No nickname: the fish goes by its species name.
 */
export function makeTank(records, species, nickname) {
  if (!fishSpecies(species) || !records?.[species]) return null;
  return { species, nickname: cleanNickname(nickname) };
}

/**
 * The fish in a kid's tank, ready to show: { species, nickname, name, look, len, record } or
 * null for an empty tank (also when the tank's fish isn't in the kid's records any more).
 * len: how long it's drawn in the tank (village pixels), bigger for a bigger record.
 */
export function tankFish(kid) {
  const t = kid?.tank;
  const sp = fishSpecies(t?.species);
  const record = sp && kid?.fishRecords?.[sp.id];
  if (!record) return null;
  const k = Math.max(0, Math.min(1, (record.size - sp.inches[0]) / (sp.inches[1] - sp.inches[0] || 1)));
  return { species: sp.id, nickname: cleanNickname(t.nickname) || sp.name, name: sp.name, look: sp.look, rare: sp.rare, len: Math.round(12 + 6 * k), record };
}
