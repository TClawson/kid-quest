// The December village, made real (design-v2 sections 1, 8 and 9): Santa's present and the advent
// calendar's doors. Pure rules, no DOM, so they can be tested (advent-ui.js shows them).
//
// Everything is kept on the kid (kid.xmas, the synced kid doc), so two devices never give two
// presents or open a door twice:
//
//   kid.xmas.santa = { 'YYYY-MM-DD': { prize, opened?: 'YYYY-MM-DD', animal? } }
//       one record per December day Santa flew for the kid; opened is the day it was unwrapped
//       (its prize counts from then: coins and gems in totals, games on that day), animal is the
//       little one's sticker
//   kid.xmas.doors = { 'YYYY-n': { kind, coins?, gems?, games?, id?, item?, color?, animal?, on } }
//       the advent doors opened each December (door n of year YYYY), what each gave and the day
//       it was opened; one field per door, so doors opened on two devices both sync (store.js
//       diffFields goes three levels down)
//
// Prizes are rolled from the kid's id and the day (or the door), like the treasure chest, so
// every device rolls the same. Coins and gems are never stored as a running total: they are
// added up from these records (xmasPay, used by logic.js totalEarned), so they sync with them.

import { rng } from './treasure.js';
import { isXmas, pickMissing, addOrnament } from './xmas.js';
import { ITEMS } from './items.js';

// ---------- Santa ----------

/** Santa's prizes (Taylor 2026-11-25: 3 gems, 10 coins or 2 extra games, equal odds). */
export const SANTA_PRIZES = {
  gems: { gems: 3 },
  coins: { coins: 10 },
  plays: { games: 2 },
};
/** The little one's present: a sticker for her book, or a shower of coins. */
export const LITTLE_SANTA = { sticker: {}, shower: { coins: 10 } };

const santaOf = (kid) => kid?.xmas?.santa || {};
/** The present Santa brought on a day, or null. */
export const santaRecord = (kid, day) => santaOf(kid)[day] || null;

/** Does Santa fly today? Every December day, once, the first time the kid is out in the village. */
export const santaDue = (kid, day) => isXmas(day) && !santaRecord(kid, day);

/** The present's prize for a kid and day, the same on every device. little: the 3-year-old's kind. */
export function rollSanta(kidId, day, little = false) {
  const r = rng(`${kidId}|${day}|santa`)();
  const kinds = little ? Object.keys(LITTLE_SANTA) : Object.keys(SANTA_PRIZES);
  return kinds[Math.min(kinds.length - 1, Math.floor(r * kinds.length))];
}

/** Santa flew over today: his present (not opened yet) waits by the door. Returns its record. */
export function santaFlies(kid, day, little = false) {
  if (!santaDue(kid, day)) return santaRecord(kid, day);
  const rec = { prize: rollSanta(kid.id, day, little) };
  kid.xmas = { ...(kid.xmas || {}), santa: { ...santaOf(kid), [day]: rec } };
  return rec;
}

/**
 * The days whose presents still wait by the door, oldest first: this December's, unopened.
 * (Presents not opened by 31 December go back to the North Pole with the decorations.)
 */
export function presentsWaiting(kid, today) {
  if (!isXmas(today)) return [];
  const year = today.slice(0, 4);
  return Object.entries(santaOf(kid)).filter(([d, r]) => d.startsWith(`${year}-12-`) && d <= today && !r.opened).map(([d]) => d).sort();
}

/** Unwraps the present of a day: from now its prize counts. extra: { animal } for a sticker. */
export function openSanta(kid, day, today, extra = {}) {
  const rec = santaRecord(kid, day);
  if (!rec || rec.opened) return null;
  const next = { ...rec, ...extra, opened: today };
  kid.xmas = { ...kid.xmas, santa: { ...santaOf(kid), [day]: next } };
  return next;
}

/** Santa's letters the kid has kept (one with every opened present but the little one's), by day. */
export function lettersKept(kid) {
  return Object.entries(santaOf(kid)).filter(([, r]) => r.opened && SANTA_PRIZES[r.prize]).map(([d]) => d).sort();
}

// ---------- the advent calendar ----------

export const DOORS = 25;
/** Doors a kid may open in a day (missed ones catch up, two at a time). Door 25 doesn't count. */
export const MAX_DOORS_A_DAY = 2;
export const STAR_DOOR = 25;
export const STAR_DOOR_COINS = 100;
export const DOOR_GEMS = 3;
export const GOLDEN_GEMS = 5;
export const DOOR_GAMES = 1;

/** The prize table for doors 1 to 24 (design-v2 section 1), in order, adding up to 1. */
export const DOOR_TABLE = [['coins', 0.4], ['ornament', 0.25], ['gem', 0.1], ['game', 0.1], ['outfit', 0.07], ['golden', 0.08]];

const dateOf = (day) => Number(String(day).slice(8, 10));
/** The doors opened in a December (year 'YYYY'): { n: prize }. */
export function doorsOf(kid, year) {
  const out = {};
  for (const [key, p] of Object.entries(kid?.xmas?.doors || {})) {
    const [y, n] = key.split('-');
    if (y === String(year) && p) out[Number(n)] = p;
  }
  return out;
}

/** How many doors (25 not counted) the kid opened today. */
export function doorsToday(kid, today) {
  return Object.entries(doorsOf(kid, today.slice(0, 4))).filter(([n, p]) => Number(n) !== STAR_DOOR && p.on === today).length;
}

/** The doors of days gone by that are still shut (they wait until 31 December). */
export function missedDoors(kid, today) {
  if (!isXmas(today)) return [];
  const opened = doorsOf(kid, today.slice(0, 4));
  const out = [];
  for (let n = 1; n < Math.min(dateOf(today), STAR_DOOR); n += 1) if (!opened[n]) out.push(n);
  return out;
}

/**
 * Can door n open today? approval: storeOpen's { open, left } (today's chores done and approved).
 * Returns { ok: true } or { ok: false, why }: 'over' (not December), 'opened', 'later' (its day
 * hasn't come), 'max' (two doors today already), 'chores' (chores to do), 'waiting' (for a grown-up).
 * Door 25 needs no chores and doesn't count toward the two; it opens from 25 December.
 */
export function doorState(kid, today, n, approval = { open: false, left: 0 }) {
  if (!isXmas(today)) return { ok: false, why: 'over' };
  if (!(n >= 1 && n <= DOORS)) return { ok: false, why: 'later' };
  if (doorsOf(kid, today.slice(0, 4))[n]) return { ok: false, why: 'opened' };
  if (n > dateOf(today)) return { ok: false, why: 'later' };
  if (n === STAR_DOOR) return { ok: true };
  if (doorsToday(kid, today) >= MAX_DOORS_A_DAY) return { ok: false, why: 'max' };
  if (!approval.open) return { ok: false, why: approval.left > 0 ? 'chores' : 'waiting' };
  return { ok: true };
}

/** Holiday outfit color versions the kid could get: a color of a holiday piece they own, not owned yet. */
export function outfitColors(owned = []) {
  const has = new Set(owned);
  return ITEMS.filter((i) => i.holiday && i.base && !has.has(i.id) && (has.has(i.base) || ITEMS.some((j) => j.base === i.base && has.has(j.id))));
}
/** Holiday outfit pieces (not color versions) the kid doesn't have. */
export const outfitsMissing = (owned = []) => ITEMS.filter((i) => i.holiday && !i.base && !owned.includes(i.id));

/**
 * What door n (1-24) gives a kid, rolled from the kid's id, the year and the door. found: the kid's
 * ornaments (kid.xmas.found), owned: the item ids the kid's buddy owns (items.js ownedFor).
 * Returns { kind: 'coins', coins } | { kind: 'ornament', id } | { kind: 'gem', gems } |
 * { kind: 'game', games } | { kind: 'outfit', item, color } | { kind: 'golden', id | item | gems }.
 * A prize that can't be had (no ornament missing, no holiday outfit owned) is coins instead.
 */
export function rollDoor({ kidId, year, n, found = [], owned = [] }) {
  const r = rng(`${kidId}|${year}|door${n}`);
  const x = r();
  const coins = { kind: 'coins', coins: 20 + 5 * Math.floor(r() * 9) }; // 20, 25 ... 60
  let kind = 'coins';
  let acc = 0;
  for (const [k, p] of DOOR_TABLE) { acc += p; if (x < acc) { kind = k; break; } }
  const pick = r();
  if (kind === 'ornament') {
    const o = pickMissing(found, () => pick); // from any map (xmas.js)
    return o ? { kind, id: o } : coins;
  }
  if (kind === 'gem') return { kind, gems: DOOR_GEMS };
  if (kind === 'game') return { kind, games: DOOR_GAMES };
  if (kind === 'outfit') {
    const list = outfitColors(owned);
    if (!list.length) return coins;
    const item = list[Math.floor(pick * list.length)];
    return { kind, item: item.id, color: item.color };
  }
  if (kind === 'golden') {
    // a super-rare ornament the kid lacks, else a holiday outfit piece they lack, else gems
    const sup = pickMissing(found, () => pick, { rarity: 'super' });
    if (sup) return { kind, id: sup };
    const pieces = outfitsMissing(owned);
    if (pieces.length) return { kind, item: pieces[Math.floor(pick * pieces.length)].id };
    return { kind, gems: GOLDEN_GEMS };
  }
  return coins;
}

/** The little one's door: a picture sticker, an animal of her map she hasn't met first. */
export function rollLittleDoor({ kidId, year, n, animals = [], met = {} }) {
  const fresh = animals.filter((a) => !met[a]);
  const from = fresh.length ? fresh : animals;
  const r = rng(`${kidId}|${year}|door${n}|little`)();
  return { kind: 'sticker', animal: from.length ? from[Math.floor(r * from.length)] : null };
}

/**
 * Opens door n today with its prize (from rollDoor, rollLittleDoor, or door 25's
 * { kind: 'star', id, coins }): kept on the kid, ornaments and stars go in kid.xmas.found.
 * The caller puts an outfit piece in the wardrobe (items.js addOwned) and a sticker in the book.
 */
export function openDoor(kid, today, n, prize) {
  const year = today.slice(0, 4);
  const rec = { ...prize, on: today };
  if (prize.id) addOrnament(kid, prize.id); // a new one (prizes are always missing ones); a double would be tinsel
  const x = kid.xmas || {};
  kid.xmas = { ...x, doors: { ...(x.doors || {}), [`${year}-${n}`]: rec } };
  return rec;
}

// ---------- what it all pays ----------

/** Coins and gems from Santa's opened presents and the opened doors, ever: { coins, gems }. */
export function xmasPay(kid) {
  const out = { coins: 0, gems: 0 };
  for (const r of Object.values(santaOf(kid))) {
    if (!r?.opened) continue;
    const p = SANTA_PRIZES[r.prize] || LITTLE_SANTA[r.prize] || {};
    out.coins += p.coins || 0; out.gems += p.gems || 0;
  }
  for (const p of Object.values(kid?.xmas?.doors || {})) { out.coins += p?.coins || 0; out.gems += p?.gems || 0; }
  return out;
}

/**
 * Extra visitor games won on a day (Santa's 2 plays, a door's game), added to the day's chest
 * games (play-ui.js), so they keep until the end of the next day just like those.
 */
export function xmasGames(kid, day) {
  let n = 0;
  for (const r of Object.values(santaOf(kid))) if (r?.opened === day) n += SANTA_PRIZES[r.prize]?.games || 0;
  for (const p of Object.values(doorsOf(kid, String(day).slice(0, 4)))) if (p?.on === day) n += p.games || 0;
  return n;
}

/** Words for a door's prize: { title, text }. name(id): an ornament's or item's name. */
export function doorWords(p, name = (id) => id) {
  switch (p?.kind) {
    case 'coins': return { title: `${p.coins} coins!`, text: 'Spend them in the shop.' };
    case 'gem': return { title: `${p.gems} gems!`, text: 'Gems buy sports gear.' };
    case 'game': return { title: 'An extra game!', text: 'Play one more with your visitors today or tomorrow.' };
    case 'ornament': return { title: `${name(p.id)}!`, text: 'A new ornament for your tree.' };
    case 'outfit': return { title: `${name(p.item)}!`, text: 'It\'s in your wardrobe now.' };
    case 'golden': return p.id ? { title: `A golden door: ${name(p.id)}!`, text: 'A super rare ornament for your tree.' }
      : p.item ? { title: `A golden door: ${name(p.item)}!`, text: 'It\'s in your wardrobe now.' }
        : { title: `A golden door: ${p.gems} gems!`, text: 'Gems buy sports gear.' };
    case 'star': return { title: `${name(p.id)} and ${p.coins} coins!`, text: 'Put the star on top of your tree.' };
    default: return { title: 'A surprise!', text: '' };
  }
}
