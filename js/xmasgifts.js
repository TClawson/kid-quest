// Presents for a sibling (December event, design-v2 section 5). Pure rules, no DOM.
//
// From 1 to 23 Dec (Denver) each kid wraps one present for each sibling's buddy (so with four
// kids everyone gets 3), from a small catalogue costing 20-60 coins: a color version of an
// accessory the sibling's buddy doesn't have, a copy of one of the giver's ornaments, or a garden
// seed packet. (There are no fish-tank decorations in the game: a tank's insides come with the
// tank, so that part of the design's catalogue is left out.) A parent can wrap one in the
// 3-year-old's name, for free. The present waits wrapped under the sibling's tree and opens from
// Christmas morning (25 Dec) on, all through January.
//
// Where it is kept (both on kid documents, so it syncs; firestore.rules already let any family
// member write any kid document, which the cheers use too):
//   recipient.xmasGifts = { [giftId]: { id, from, fromName, fromBuddy, by?: 'parent', year,
//                                      kind: 'color' | 'ornament' | 'seed', item, n, cost,
//                                      shape, paper, at, opened? (the day) } }
//   giver.xmasSent = { [year]: { [recipientId]: giftId } }   (one per sibling a year)
// A kid's device only loads its own kid, so it writes the present straight onto the sibling's
// document (cloud.js sendGift), like a cheer.

import { ITEMS, itemById, isWorn, fitsSpecies, addOwned, ownedFor, COLOR_VERSIONS } from './items.js';
import { SEEDS, seedById, gardenOf } from './gardenrules.js';
import { ornamentById, addOrnament, isXmas, GIFT_PAPERS } from './xmas.js';

/** Presents are wrapped from 1 to this day of December, and open from OPEN_DAY. */
export const WRAP_LAST = 23;
export const OPEN_DAY = 25;
export const GIFT_MIN = 20;
export const GIFT_MAX = 60;

/** What an ornament copy costs, by its rarity. */
const ORN_COST = { common: 20, rare: 40, super: 60 };
/** A seed present: how many packets come in it and what it costs, by the kind of plant. */
export const SEED_GIFT = { flower: { n: 3, cost: 20 }, veg: { n: 2, cost: 25 }, tree: { n: 1, cost: 40 } };
/** Each kind of present has its own box shape (xmasart.js GIFT_SHAPES). */
const SHAPE = { color: 'small', ornament: 'round', seed: 'tall' };

const clamp = (n) => Math.max(GIFT_MIN, Math.min(GIFT_MAX, Math.round(n)));
const year = (day) => String(day).slice(0, 4);
const dom = (day) => Number(String(day).slice(8, 10));

/** Can presents be wrapped today (1-23 Dec)? */
export const canWrap = (day) => isXmas(day) && dom(day) <= WRAP_LAST;

/** Can this present be unwrapped today: from 25 Dec of its year to the end of January. */
export function canUnwrap(gift, day) {
  if (!gift || gift.opened) return false;
  const y = String(gift.year);
  return day >= `${y}-12-${OPEN_DAY}` && day <= `${Number(y) + 1}-01-31`;
}

/** The one present from a giver to a sibling in a year has this id. */
export const giftId = (yr, fromId, toId) => `${yr}-${fromId}-${toId}`;

/** Has giver already wrapped this year's present for this sibling? */
export const giftSent = (giver, toId, day) => Boolean(giver?.xmasSent?.[year(day)]?.[toId]);

/**
 * A small catalogue for one sibling, the same every time it opens (rand seeded by year, giver and
 * sibling). giver: the kid (xmas.found). to: the sibling as a family buddy ({ id, buddy, owned,
 * buddyOwned, xmasFound }). Returns [{ kind, item, n, cost, name, icon }]: up to 3 color accessories
 * the sibling's buddy doesn't have, up to 3 of the giver's ornaments (ones the sibling lacks first),
 * and a flower, a vegetable and a fruit tree seed packet.
 */
export function giftCatalogue(giver, to, rand = Math.random) {
  const shuffle = (list) => list.map((v) => [rand(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const species = to?.buddy?.species;
  const has = new Set(ownedFor({ owned: to?.owned || [], buddyOwned: to?.buddyOwned || {} }, species));
  const colors = shuffle(ITEMS.filter((i) => i.base && i.color && COLOR_VERSIONS[i.base] && isWorn(i) && fitsSpecies(i, species) && !has.has(i.id)))
    .slice(0, 3)
    .map((i) => ({ kind: 'color', item: i.id, n: 1, cost: clamp(i.price || 30), name: i.name, icon: '🎀' }));
  const theirs = new Set(to?.xmasFound || []);
  const mine = (giver?.xmas?.found || []).map(ornamentById).filter((o) => o && o.rarity !== 'star');
  const orns = [...shuffle(mine.filter((o) => !theirs.has(o.id))), ...shuffle(mine.filter((o) => theirs.has(o.id)))]
    .slice(0, 3)
    .map((o) => ({ kind: 'ornament', item: o.id, n: 1, cost: ORN_COST[o.rarity], name: o.name, icon: '🎄', rarity: o.rarity }));
  const seeds = ['flower', 'veg', 'tree'].map((kind) => {
    const list = SEEDS.filter((s) => s.kind === kind);
    const s = list[Math.floor(rand() * list.length)];
    const g = SEED_GIFT[kind];
    return { kind: 'seed', item: s.id, n: g.n, cost: g.cost, name: g.n > 1 ? `${s.name}: ${g.n} seed packets` : `${s.name} seed`, icon: s.icon };
  });
  return [...colors, ...orns, ...seeds];
}

/** Is a catalogue choice a real present (so a tampered tap can't wrap something else)? */
function validChoice(c) {
  if (!c) return false;
  if (c.kind === 'color') { const i = itemById(c.item); return Boolean(i?.base && i.color); }
  if (c.kind === 'ornament') { const o = ornamentById(c.item); return Boolean(o && o.rarity !== 'star'); }
  if (c.kind === 'seed') return Boolean(seedById(c.item));
  return false;
}

/**
 * Wrap a present: checks the window (1-23 Dec), one per sibling a year, that it's a real present,
 * and (unless a parent gives it, for free) that the giver has the coins. Changes the giver
 * (xmasSent; spent goes up by the cost) and returns { gift } to put under the sibling's tree
 * (receiveGift), or { error }. opts: { coins: what the giver has, byParent }.
 */
export function wrapGift(giver, to, choice, paper, day, { coins = 0, byParent = false } = {}) {
  if (!canWrap(day)) return { error: 'Presents are wrapped from 1 to 23 December.' };
  if (!giver || !to || giver.id === to.id) return { error: 'Who is it for?' };
  if (giftSent(giver, to.id, day)) return { error: 'You already wrapped a present for them this year.' };
  if (!validChoice(choice)) return { error: 'Pick a present first.' };
  if (choice.kind === 'ornament' && !byParent && !(giver.xmas?.found || []).includes(choice.item)) return { error: 'You can only give a copy of an ornament you have.' };
  const cost = choice.cost;
  if (!byParent && coins < cost) return { error: `That needs ${cost} coins.` };
  const yr = year(day);
  const id = giftId(yr, giver.id, to.id);
  const gift = {
    id, from: giver.id, fromName: giver.name || 'Someone', fromBuddy: giver.buddy?.species || 'buddy',
    year: yr, kind: choice.kind, item: choice.item, n: choice.n || 1, cost,
    shape: SHAPE[choice.kind], paper: GIFT_PAPERS.some((p) => p.id === paper) ? paper : 'candy', at: day,
    ...(byParent ? { by: 'parent' } : {}),
  };
  giver.xmasSent = { ...(giver.xmasSent || {}), [yr]: { ...(giver.xmasSent?.[yr] || {}), [to.id]: id } };
  if (!byParent) giver.spent = (giver.spent || 0) + cost;
  return { gift };
}

/** Put a present under a kid's tree (a kid's device does this on the cloud copy instead). */
export function receiveGift(kid, gift) {
  if (!kid || !gift?.id || kid.xmasGifts?.[gift.id]) return false;
  kid.xmasGifts = { ...(kid.xmasGifts || {}), [gift.id]: gift };
  return true;
}

/**
 * Unwrap a present on or after Christmas morning, and get what's inside: a color accessory goes
 * to the buddy (one the buddy got meanwhile turns into its coins), an ornament onto the tree (a
 * double turns into tinsel), seed packets into the garden's seed box. Changes the kid. Returns
 * { gift, got: { kind: 'color' | 'ornament' | 'tinsel' | 'seed' | 'coins', item, n, coins } } or null.
 */
export function unwrapGift(kid, id, day) {
  const gift = kid?.xmasGifts?.[id];
  if (!canUnwrap(gift, day)) return null;
  let got;
  if (gift.kind === 'color') {
    const item = itemById(gift.item);
    if (!item || ownedFor(kid).includes(item.id) || !fitsSpecies(item, kid.buddy?.species)) {
      kid.spent = (kid.spent || 0) - gift.cost;
      got = { kind: 'coins', item: gift.item, coins: gift.cost };
    } else {
      addOwned(kid, item);
      got = { kind: 'color', item: item.id };
    }
  } else if (gift.kind === 'ornament') {
    const r = addOrnament(kid, gift.item);
    got = { kind: r?.kind === 'new' ? 'ornament' : 'tinsel', item: gift.item };
  } else {
    const g = gardenOf(kid);
    g.seeds[gift.item] = (g.seeds[gift.item] || 0) + (gift.n || 1);
    kid.garden = g;
    got = { kind: 'seed', item: gift.item, n: gift.n || 1 };
  }
  kid.xmasGifts = { ...kid.xmasGifts, [id]: { ...gift, opened: day } };
  return { gift, got };
}

/**
 * Siblings a giver wraps for: every other kid in the family. all: family buddies ({ id, name, ... }).
 * Each with sent: whether this year's present is wrapped already.
 */
export function giftList(giver, all, day) {
  return (all || []).filter((b) => b && b.id !== giver.id).map((b) => ({ ...b, sent: giftSent(giver, b.id, day) }));
}
