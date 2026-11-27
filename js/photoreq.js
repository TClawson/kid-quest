// Villager photo requests (Taylor, 2026-11-27, Pokemon Snap style): villagers ask the kid for
// a photo of an animal they have photographed before ("Could you get me a photo of a jumping
// deer?"). A request board, not a daily one: up to OPEN_MAX open at once, each lasting LASTS
// days (mornings are for chores, so a request made today can be done tomorrow), and at most one
// new request a day. A photo that meets a request is given to that villager, who hangs it up
// beside them in the village; the kid gets a free print (a print ticket), and every FRAME_EVERY
// requests done earns a free gallery frame (or two more print tickets once the frame is owned).
// Visitor games give no coins, so the rewards are prints and frames, never coins.
//
//   kid.photoReqs = { open: [{ c: critterId, by: villager kind, from: day, want }], last: day,
//                     done: n, given: { [kind]: { critter, neg?, map, season, weather, day } } }
//   kid.printTickets = n   (js/prints.js printPhoto spends one instead of coins)
import { critterById, isOut } from './critters.js';
import { addDays } from './logic.js';
import { PHOTO_FRAME_ID } from './prints.js';

export const OPEN_MAX = 2;
export const LASTS = 2;
export const FRAME_EVERY = 3;
/** What a request asks for, in words ("a photo of a deer ..."). */
export const WANTS = {
  perfect: 'a perfect photo of',
  eat: 'a photo of a snacking',
  jump: 'a photo of a jumping',
  wings: 'a photo of, wings out, a',
  splash: 'a photo of a splashing',
  pair: 'a photo of two animals, one a',
};

const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

/** The requests, tidied (old ones gone). */
export function requestsOf(kid, day) {
  const r = kid?.photoReqs || {};
  return {
    open: (r.open || []).filter((q) => critterById(q.c) && addDays(q.from, LASTS) > day),
    last: r.last || '', done: r.done || 0, given: r.given || {},
  };
}

/** The pose a request can ask of an animal (once the kid has found plenty). */
function wantFor(c, roll) {
  if (roll < 0.5) return 'perfect';
  const ways = c.how;
  if (roll < 0.62) return 'pair';
  if (ways.includes('fly') || ways.includes('perch')) return 'wings';
  if (c.sea || ways.includes('surface')) return 'splash';
  return roll < 0.81 ? 'eat' : 'jump';
}

/**
 * Brings the board up to date for a day: old requests go, and (at most once a day) a villager
 * from `kinds` (today's villagers) asks for an animal from the kid's album on `map`, out in
 * this season. Changes kid.photoReqs; returns true when something changed.
 */
export function refreshRequests(kid, day, { map, season, kinds }) {
  const before = JSON.stringify(kid.photoReqs || null);
  const r = requestsOf(kid, day);
  if (r.open.length < OPEN_MAX && r.last !== day && kinds?.length) {
    const album = kid.critterAlbum || {};
    const asked = new Set(r.open.map((q) => q.c));
    const busy = new Set(r.open.map((q) => q.by));
    const pool = Object.keys(album).map(critterById)
      .filter((c) => c && c.map === map && c.rarity !== 'secret' && c.rarity !== 'legend' && !asked.has(c.id) && isOut(c, season, day));
    const who = kinds.filter((k) => !busy.has(k));
    if (pool.length && who.length) {
      const seed = `${kid.id}|${day}|${r.done}`;
      const c = pool[Math.floor(hash(`${seed}|c`) * pool.length)];
      const by = who[Math.floor(hash(`${seed}|v`) * who.length)];
      const found = Object.keys(album).length;
      r.open.push({ c: c.id, by, from: day, want: found >= 15 ? wantFor(c, hash(`${seed}|w`)) : 'perfect' });
      r.last = day;
    }
  }
  kid.photoReqs = r;
  return JSON.stringify(r) !== before;
}

/** Does a photo meet a request? Always a perfect one, and the pose or pair it asks for. */
export function meets(q, shot) {
  if (!shot || shot.critter !== q.c || shot.quality !== 'perfect') return false;
  if (q.want === 'perfect') return true;
  if (q.want === 'pair') return Boolean(shot.pair);
  return shot.special === q.want;
}

/**
 * A ride's photo: gives it to the villager whose request it meets (if any). Returns
 * { q, frame: true when this earned the free frame } or null. Changes the kid.
 */
export function giveIfAsked(kid, shot, day) {
  const r = requestsOf(kid, day);
  const q = r.open.find((x) => meets(x, shot));
  if (!q) return null;
  r.open = r.open.filter((x) => x !== q);
  r.done += 1;
  r.given = { ...r.given, [q.by]: { critter: shot.critter, ...(shot.neg ? { neg: shot.neg } : {}), map: shot.map, season: shot.season, weather: shot.weather, day } };
  kid.photoReqs = r;
  kid.printTickets = (kid.printTickets || 0) + 1;
  let frame = false;
  if (r.done % FRAME_EVERY === 0) {
    if (!(kid.owned || []).includes(PHOTO_FRAME_ID)) { kid.owned = [...(kid.owned || []), PHOTO_FRAME_ID]; frame = true; } else kid.printTickets += 2;
  }
  return { q, frame };
}

/** "Could you get me a photo of a jumping deer?" */
export const askText = (q) => {
  const c = critterById(q.c);
  const name = c ? c.name.toLowerCase() : 'animal';
  return `Could you get me ${WANTS[q.want] || WANTS.perfect} ${name}?`;
};
