// The December event in the buddy's house (design-v2 sections 2 and 5): the ornament book and its
// ornament pages, tinsel's "Pick one", the small reveal when a chest, a fish, a dig or a photo
// finds an ornament, wrapping a present for each sibling (from the tree, or a parent in the
// 3-year-old's name) and unwrapping presents from Christmas morning on.
// The rules are in xmas.js and xmasgifts.js; this is the screens. Shared things come from ctx.js.

import {
  state, ui, $modal, today, esc, kidById, save, render, toast, openModal, closeModal, progressFor, family, cloudCfg,
} from './ctx.js';
import { sounds, confetti } from './fx.js';
import { buddySvg } from './avatar.js';
import { itemById, SLOTS } from './items.js';
import { seedById } from './gardenrules.js';
import { playsLittle } from './littlerules.js';
import { rng } from './treasure.js';
import { loadCloud } from './sync-ui.js';
import { ornamentBookHtml } from './xmasbook.js';
import { ornamentArt, ornamentSilhouette, artCanvas, giftArt } from './xmasart.js';
import {
  XMAS_MAPS, RARITY, TINSEL_PRICE, GIFT_PAPERS, ornamentById, starsWon, missingOrnaments, tinselSwap, isXmas,
  nextRoll, playDrop, photoOrnament, chestOrnament,
} from './xmas.js';
import { canWrap, giftCatalogue, wrapGift, receiveGift, unwrapGift, giftList, WRAP_LAST } from './xmasgifts.js';

const mapName = (id) => XMAS_MAPS.find((m) => m.id === id)?.name || '';
const species = (b) => b?.buddy?.species || 'buddy';

// ---------- pictures ----------

const imgCache = new Map();
/** An ornament or star as an image URL: found (frame 0 or 1) or a grey shape. */
export function ornImg(id, { grey = false, frame = 0 } = {}) {
  const key = `${id}:${grey ? 'grey' : frame}`;
  if (!imgCache.has(key)) {
    const art = grey ? ornamentSilhouette(id) : ornamentArt(id, frame);
    imgCache.set(key, art ? artCanvas(art, document).toDataURL() : '');
  }
  return imgCache.get(key);
}
function giftImg(shape, paper) {
  const key = `gift:${shape}:${paper}`;
  if (!imgCache.has(key)) imgCache.set(key, artCanvas(giftArt(shape, paper), document).toDataURL());
  return imgCache.get(key);
}
/** An ornament picture, two frames taking turns for a super-rare one or a star. */
function ornPic(id, cls = 'ob-pic') {
  const o = ornamentById(id);
  return o && (o.rarity === 'super' || o.rarity === 'star')
    ? `<span class="${cls} twinkle"><img class="ob-f0" src="${ornImg(id)}" alt=""><img class="ob-f1" src="${ornImg(id, { frame: 1 })}" alt=""></span>`
    : `<span class="${cls}"><img src="${ornImg(id)}" alt=""></span>`;
}

// ---------- the family ----------

/**
 * Everyone in the family, with what a present needs: their buddy and what it owns, and the
 * ornaments they've found. This device's kids in full; on a kid's device the others come from
 * the cloud (cloud.js watchBuddies).
 */
export function familyKids() {
  const all = new Map((family.buddies || []).map((b) => [b.id, b]));
  for (const k of state.kids) {
    all.set(k.id, { id: k.id, name: k.name, color: k.color, buddy: k.buddy, owned: k.owned || [], buddyOwned: k.buddyOwned || {}, xmasFound: k.xmas?.found || [], little: playsLittle(k) });
  }
  return [...all.values()].filter((b) => b.buddy);
}

// ---------- the ornament book ----------

/** The presents part of the book: a Wrap button for each sibling, from 1 to 23 Dec. */
function giftsHtml(kid) {
  const day = today();
  // the 3-year-old's presents are wrapped by a parent (xmasParentCard)
  if (!canWrap(day) || playsLittle(kid)) return '';
  const list = giftList(kid, familyKids(), day);
  if (!list.length) return '';
  const left = list.filter((b) => !b.sent).length;
  return `
      <div class="ob-gifts">
        <b>🎁 Presents for your family</b>
        <span class="muted small">${left ? `Wrap one for each buddy by ${WRAP_LAST} December. They open on Christmas morning.` : 'All wrapped! They open on Christmas morning.'}</span>
        <div class="ob-giftrow">${list.map((b) => (b.sent
    ? `<span class="ob-sent">✓ ${esc(b.name)}</span>`
    : `<button class="btn small" data-action="xgift-for" data-from="${esc(kid.id)}" data-to="${esc(b.id)}">🎁 ${esc(b.name)}</button>`)).join('')}</div>
      </div>`;
}

/** The ornament book (opened from the tree), scrolled back to where it was when given. */
export function openOrnamentBook(kid, scroll = 0) {
  if (!kid) return;
  openModal(ornamentBookHtml(kid, ornImg, { gifts: giftsHtml(kid) }));
  if (scroll) { const card = $modal.querySelector('.modal-card'); if (card) card.scrollTop = scroll; }
}
const bookScroll = () => $modal.querySelector('.modal-card')?.scrollTop || 0;

/** One ornament's page: its big picture, name, map and rarity. */
export function openOrnamentPage(kid, id) {
  const o = ornamentById(id);
  if (!kid || !o || !(kid.xmas?.found || []).includes(id)) return;
  ui.xmasScroll = bookScroll();
  const rarity = RARITY[o.rarity]?.name || 'Star topper';
  openModal(`
    <div class="ornpage ${o.rarity}">
      ${ornPic(id, 'op-pic')}
      <h2>${esc(o.name)}</h2>
      <p class="op-tags"><span class="op-tag">${esc(mapName(o.map))}</span><span class="op-tag ${o.rarity}">${esc(rarity)}</span></p>
      <p class="muted small">${o.rarity === 'super' ? 'Super rare! Only 1 in 10 drops is this one.' : o.rarity === 'rare' ? 'Rare: 1 in 5 drops on its map.' : 'Common: easy to find on its map.'}</p>
      <button class="btn" data-action="xmas-book">Back to the book</button>
    </div>`);
}

/** Tinsel's Pick one: every missing ornament, from any map. */
function openTinselPicker(kid) {
  const found = kid.xmas?.found || [];
  if ((kid.xmas?.tinsel || 0) < TINSEL_PRICE) { toast(`You need ${TINSEL_PRICE} tinsel.`); return; }
  ui.xmasScroll = bookScroll();
  const maps = XMAS_MAPS.map((m) => {
    const ids = missingOrnaments(found, m.id);
    if (!ids.length) return '';
    return `<div class="tp-map"><h3>${esc(m.name)}</h3><div class="ob-grid">${ids.map((id) => {
      const o = ornamentById(id);
      return `<button class="ob-orn ${o.rarity}" data-action="tinsel-pick" data-orn="${esc(id)}">${ornPic(id)}<b>${esc(o.name)}</b><small>${RARITY[o.rarity].name}</small></button>`;
    }).join('')}</div></div>`;
  }).join('');
  openModal(`
    <div class="ornbook tinsel-pick">
      <h2>✨ Pick an ornament</h2>
      <p class="muted small">${TINSEL_PRICE} tinsel buys any one you're missing, from any map.</p>
      <div class="ob-maps">${maps}</div>
      <button class="btn ghost" data-action="xmas-book">Back</button>
    </div>`);
}

// ---------- found an ornament ----------

/**
 * The small reveal when something finds an ornament (over a game too): its picture, its name and
 * map, or that a double turned into tinsel. res: { id, kind: 'new' | 'tinsel' } from xmas.js.
 */
export function ornamentPop(res) {
  if (!res) return;
  const o = ornamentById(res.id);
  if (!o) return;
  document.querySelectorAll('.orn-pop').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = `orn-pop ${res.kind}`;
  el.innerHTML = res.kind === 'new'
    ? `${ornPic(o.id, 'op-mini')}<span><b>🎄 An ornament!</b><small>${esc(o.name)} · ${esc(mapName(o.map))}</small></span>`
    : `${ornPic(o.id, 'op-mini')}<span><b>✨ A tinsel!</b><small>You have the ${esc(o.name)}, so it turned into tinsel.</small></span>`;
  document.body.appendChild(el);
  sounds.day();
  setTimeout(() => el.remove(), 3400);
}

/** The chest's ornament (December, 1 in 2), seeded by kid and day: { id, kind } or null. Changes the kid. */
export function chestXmas(kid, map, day) {
  return chestOrnament(kid, map, day, rng(`${kid.id}|${day}|xmas-chest`));
}

/** The chest card's extra part for an ornament that came with the prize. */
export function chestXmasHtml(res) {
  if (!res) return '';
  const o = ornamentById(res.id);
  if (!o) return '';
  return `
        <div class="prize-piece prize-orn">
          <h2>${res.kind === 'new' ? 'And an ornament for your tree!' : 'And a tinsel!'}</h2>
          <div class="prize-art">${ornPic(o.id, 'op-chest')}</div>
          <p class="muted">${res.kind === 'new' ? `${esc(o.name)}, from ${esc(mapName(o.map))}.` : `You have the ${esc(o.name)} already, so it turned into tinsel. ${TINSEL_PRICE} tinsel buys any ornament.`}</p>
        </div>`;
}

/**
 * A December fish (1 catch in 8) or dig round (1 in 6) on a map: counted on the kid so the roll is
 * seeded, saved, and shown. kidId: looked up again (a game calls this later).
 */
export function playXmas(kidId, source, map) {
  const day = today();
  if (!isXmas(day)) return null;
  const kid = kidById(kidId);
  if (!kid) return null;
  const n = nextRoll(kid, source, day);
  const res = playDrop(kid, source, map, day, rng(`${kid.id}|${day}|xmas-${source}|${n}`));
  save();
  if (res) ornamentPop(res);
  return res;
}

/** The first perfect photo of a map's December critter this year: a missing ornament of that map. */
export function photoXmas(kidId, critter, quality) {
  const day = today();
  const kid = kidById(kidId);
  if (!kid || !isXmas(day)) return null;
  const res = photoOrnament(kid, critter, quality, day, rng(`${kid.id}|${day.slice(0, 4)}|${critter?.map}|xmas-photo`));
  if (!res) return null;
  save();
  ornamentPop(res);
  return res;
}

// ---------- wrapping a present ----------

const catalogueFor = (giver, to) => giftCatalogue(giver, to, rng(`${today().slice(0, 4)}|${giver.id}|${to.id}|gift`));

/** What a catalogue choice looks like: the buddy wearing it, the ornament, or the seed packet. */
function choiceArt(c, to) {
  if (c.kind === 'color') {
    const item = itemById(c.item);
    return buddySvg({ ...to.buddy, outfit: { background: 'none', [item.slot]: item.id } }, 'happy', { background: false });
  }
  if (c.kind === 'ornament') return ornPic(c.item);
  return `<span class="xg-seed">${esc(c.icon)}</span>`;
}

function giftShopHtml() {
  const o = ui.xgift;
  const giver = kidById(o.from);
  const to = familyKids().find((b) => b.id === o.to);
  if (!giver || !to) return '';
  const cat = catalogueFor(giver, to);
  const coins = progressFor(giver).coins;
  const pick = cat[o.pick] || null;
  const shape = pick ? { color: 'small', ornament: 'round', seed: 'tall' }[pick.kind] : 'small';
  const can = pick && (o.byParent || coins >= pick.cost);
  const kinds = [['color', '🎀 Something to wear'], ['ornament', '🎄 A copy of your ornament'], ['seed', '🌱 Seeds for the garden']];
  const cards = kinds.map(([k, title]) => {
    const list = cat.map((c, i) => [c, i]).filter(([c]) => c.kind === k);
    if (!list.length) return '';
    return `<h3>${title}</h3><div class="xg-items">${list.map(([c, i]) => `
        <button class="xg-item ${o.pick === i ? 'on' : ''} ${!o.byParent && coins < c.cost ? 'dear' : ''}" data-action="xgift-pick" data-i="${i}" data-kind="${c.kind}" data-item="${esc(c.item)}" data-cost="${c.cost}">
          <span class="xg-art">${choiceArt(c, to)}</span>
          <b>${esc(c.name)}</b>
          ${o.byParent ? '' : `<span class="price ${coins >= c.cost ? 'can' : ''}">🪙 ${c.cost}</span>`}
        </button>`).join('')}</div>`;
  }).join('');
  const papers = GIFT_PAPERS.map((p) => `<button class="xg-paper ${o.paper === p.id ? 'on' : ''}" data-action="xgift-paper" data-paper="${p.id}" aria-label="${esc(p.name)}"><img src="${giftImg(shape, p.id)}" alt=""><small>${esc(p.name)}</small></button>`).join('');
  return `
    <div class="xgift">
      <h2>🎁 A present for ${esc(to.name)}'s ${esc(species(to))}</h2>
      <p class="muted small">${o.byParent ? `From ${esc(giver.name)}, wrapped by a grown-up. It's free.` : `You have 🪙 <b>${coins}</b> coins. One present for each buddy.`}</p>
      ${cards}
      <h3>Wrapping paper</h3>
      <div class="xg-papers">${papers}</div>
      <div class="row end">
        <button class="btn ghost" data-action="xgift-back">Back</button>
        <button class="btn" data-action="xgift-wrap" ${can ? '' : 'disabled'}>${pick ? `Wrap it!${o.byParent ? '' : ` 🪙 ${pick.cost}`}` : 'Pick a present'}</button>
      </div>
    </div>`;
}

/** The present catalogue for one sibling. byParent: a parent wraps it in a little one's name. */
export function openGiftShop(fromId, toId, byParent = false) {
  if (!canWrap(today())) { toast(`Presents are wrapped from 1 to ${WRAP_LAST} December.`); return; }
  if (!ui.xgift || ui.xgift.from !== fromId || ui.xgift.to !== toId) ui.xgift = { from: fromId, to: toId, byParent, pick: null, paper: 'candy' };
  ui.xgift.byParent = byParent;
  const html = giftShopHtml();
  if (html) openModal(html);
}

/** Redraw the catalogue in place (a pick or a paper), so the pop-up doesn't open again. */
function redrawShop() {
  const card = $modal.querySelector('.modal-card');
  const html = giftShopHtml();
  if (card && html) card.innerHTML = html;
}

function wrapNow() {
  const o = ui.xgift;
  const giver = kidById(o?.from);
  const to = familyKids().find((b) => b.id === o?.to);
  if (!giver || !to) return;
  const choice = catalogueFor(giver, to)[o.pick];
  const res = wrapGift(giver, to, choice, o.paper, today(), { coins: progressFor(giver).coins, byParent: o.byParent });
  if (res.error) { toast(res.error); return; }
  const local = kidById(to.id);
  if (local) receiveGift(local, res.gift);
  else if (cloudCfg) loadCloud().then((mod) => mod.sendGift(cloudCfg.familyId, to.id, res.gift)).catch((err) => console.error('Kid Quest gift', err));
  save();
  ui.xgift = null;
  sounds.day();
  confetti(70, 1400);
  const back = o.byParent ? '<button class="btn" data-action="modal-close">Done</button>' : '<button class="btn" data-action="xmas-book">Back to the tree</button>';
  openModal(`
    <div class="celebrate xgift-done">
      <div class="prize-art"><img class="xg-big" src="${giftImg(res.gift.shape, res.gift.paper)}" alt=""></div>
      <h1>Wrapped!</h1>
      <p>It's under ${esc(to.name)}'s tree now. It opens on Christmas morning.</p>
      ${back}
    </div>`, () => render());
}

/** Parent screens: wrap a present in a little one's name, from 1 to 23 Dec (a card on her page). */
export function xmasParentCard(kid) {
  if (!playsLittle(kid) || !canWrap(today())) return '';
  const list = giftList(kid, familyKids(), today());
  if (!list.length) return '';
  return `
    <div class="card xmas-parent">
      <div class="block">🎁 Christmas presents from ${esc(kid.name)}
        <div class="row wrap">${list.map((b) => (b.sent
    ? `<span class="ob-sent">✓ ${esc(b.name)}</span>`
    : `<button class="btn ghost small-btn" data-action="xgift-for" data-from="${esc(kid.id)}" data-to="${esc(b.id)}" data-parent="1">🎁 For ${esc(b.name)}</button>`)).join('')}</div>
        <small class="muted">Wrap one in ${esc(kid.name)}'s name for each of the others, free, by ${WRAP_LAST} December. It waits under their tree until Christmas morning.</small>
      </div>
    </div>`;
}

// ---------- Christmas morning ----------

/** A present under the tree was unwrapped (house.js): give what's inside and show it. */
export function openPresent(kidId, giftId) {
  const kid = kidById(kidId);
  const res = kid && unwrapGift(kid, giftId, today());
  if (!res) { render(); return; }
  save();
  const { gift, got } = res;
  const from = `${gift.fromName}'s ${gift.fromBuddy || 'buddy'}`;
  let art = '';
  let title = '';
  let text = '';
  if (got.kind === 'color') {
    const item = itemById(got.item);
    art = buddySvg({ ...kid.buddy, outfit: { background: 'none', [item.slot]: item.id } }, 'happy', { background: false });
    title = `A ${item.name.toLowerCase()}!`;
    const tab = item.holiday && isXmas(today()) ? 'Holiday' : SLOTS.find((s) => s.id === item.slot)?.name || 'Extras';
    text = `Wear it from the shop's ${tab} tab.`;
  } else if (got.kind === 'ornament' || got.kind === 'tinsel') {
    const o = ornamentById(got.item);
    art = ornPic(o.id, 'op-chest');
    title = got.kind === 'ornament' ? `${o.name}!` : 'A tinsel!';
    text = got.kind === 'ornament' ? 'It\'s on your tree now.' : `You have the ${o.name} already, so it turned into tinsel.`;
  } else if (got.kind === 'seed') {
    const s = seedById(got.item);
    art = `<span class="xg-seed big">${esc(s?.icon || '🌱')}</span>`;
    title = got.n > 1 ? `${s?.name || 'Flowers'}: ${got.n} seed packets!` : `${s?.name || 'Tree'} seed!`;
    text = 'Plant them in your garden behind the house.';
  } else {
    art = '<div class="prize-emoji">🪙</div>';
    title = `${got.coins} coins!`;
    text = 'Your buddy had that one already, so it turned into coins.';
  }
  sounds.day();
  confetti(140, 2200);
  openModal(`
    <div class="celebrate xgift-open">
      <p class="muted">A present from ${esc(from)}</p>
      <div class="prize-art">${art}</div>
      <h1>${esc(title)}</h1>
      <p>${esc(text)}</p>
      <button class="btn huge" data-action="modal-close">Thank you!</button>
    </div>`, () => render());
}

// ---------- taps ----------

export const xmasActions = {
  'xmas-book': () => openOrnamentBook(kidById(ui.kidId), ui.xmasScroll || 0),
  'ornament-page': (el) => openOrnamentPage(kidById(ui.kidId), el.dataset.orn),
  'tinsel-swap': () => { const kid = kidById(ui.kidId); if (kid) openTinselPicker(kid); },
  'tinsel-pick': (el) => {
    const kid = kidById(ui.kidId);
    const id = el.dataset.orn;
    if (!kid || !tinselSwap(kid, id)) return;
    save();
    sounds.day();
    confetti(60, 1200);
    openOrnamentBook(kid, ui.xmasScroll || 0);
    ornamentPop({ id, kind: 'new' });
    render();
  },
  'xgift-for': (el) => { ui.xmasScroll = $modal.hidden ? 0 : bookScroll(); openGiftShop(el.dataset.from, el.dataset.to, el.dataset.parent === '1'); },
  'xgift-pick': (el) => { if (!ui.xgift) return; ui.xgift.pick = Number(el.dataset.i); sounds.tap(); redrawShop(); },
  'xgift-paper': (el) => { if (!ui.xgift) return; ui.xgift.paper = el.dataset.paper; sounds.tap(); redrawShop(); },
  'xgift-wrap': () => wrapNow(),
  'xgift-back': () => {
    const o = ui.xgift;
    ui.xgift = null;
    if (o?.byParent) closeModal(); else openOrnamentBook(kidById(o?.from || ui.kidId), ui.xmasScroll || 0);
  },
  // the ornament book: put a won star topper on top of the tree (a map's 4 ornaments, or door 25)
  'tree-star': (el) => {
    const kid = kidById(ui.kidId);
    const id = el.dataset.star;
    if (!kid || !starsWon(kid.xmas?.found).includes(id)) return;
    kid.xmas = { ...kid.xmas, star: id };
    const scroll = bookScroll();
    sounds.tap(); save();
    openOrnamentBook(kid, scroll);
    render();
  },
};
