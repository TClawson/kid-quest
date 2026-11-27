// The photo wall and printing (prints.js): the Print button on a perfect photo's album page,
// the print confirm, and the photo wall's own page (opened by tapping the gallery frame in the
// buddy's house): the four prints big, which print hangs where, and the frame's color.
import { esc, openModal, closeModal, save, render, toast, progressFor, $modal, today } from './ctx.js';
import { refreshRequests, requestsOf, askText } from './photoreq.js';
import { seasonOf } from './seasons.js';
import { critterById } from './critters.js';
import {
  PRINT_PRICE, FRAME_PRICE, FRAME_COLORS, WALL_SLOTS, hasFrame, canPrint, printOf, printIds, wallOf,
  printPhoto, hangPrint, setFrameColor, develop, ticketsLeft,
} from './prints.js';
import { sounds, confetti } from './fx.js';

const MAP_NAMES = {
  'bg-meadow': 'Forest Village', 'bg-fjord': 'Alaskan Fjord', 'bg-space': 'Moon Base', 'bg-castle': 'Castle',
  'bg-sunset': 'Sunset Beach', 'bg-ocean': 'Under the Sea', 'bg-volcano': 'Volcano Island', 'bg-rainforest': 'Rainforest',
  'bg-rainbow': 'Rainbow Land', 'bg-galaxy': 'Golden Galaxy',
};
const dateOf = (key) => (key ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const urls = new Map();

/** A developed print as a data URL (cached). print: { critter, ...prints.js print }. */
export function printUrl(print) {
  const key = JSON.stringify(print);
  if (!urls.has(key)) { const c = develop(print); urls.set(key, c ? c.toDataURL() : ''); }
  return urls.get(key);
}
/** The picture for the wall: the middle of the print, so the animal is bigger in the little window. */
const wallUrls = new Map();
export function wallUrl(print) {
  const key = JSON.stringify(print);
  if (!wallUrls.has(key)) {
    const c = develop(print);
    if (!c) return '';
    const w = Math.round(c.width * 0.72); const h = Math.round(c.height * 0.72);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(c, Math.round((c.width - w) / 2), Math.round((c.height - h) / 2), w, h, 0, 0, w, h);
    wallUrls.set(key, out.toDataURL());
  }
  return wallUrls.get(key);
}

/** What houseHtml needs for the photo wall, or null when the gallery frame isn't up. */
export function housePhotos(kid) {
  if (!hasFrame(kid)) return null;
  const wall = wallOf(kid);
  return {
    frame: FRAME_COLORS[wall.color].ramp,
    pics: wall.slots.map((id) => (id ? { url: wallUrl({ critter: id, ...printOf(kid, id) }), name: critterById(id)?.name || '' } : null)),
  };
}

/**
 * Villager photo requests for the village (photoreq.js): brings the board up to date for today's
 * villagers (kinds), and returns what each asks { kind: text } and the photos given to them
 * { kind: picture url }, hung up beside them.
 */
export function villageRequests(kid, map, kinds) {
  const day = today();
  if (refreshRequests(kid, day, { map, season: seasonOf(day), kinds })) save();
  const r = requestsOf(kid, day);
  const asks = {}; const given = {};
  for (const q of r.open) if (kinds.includes(q.by)) asks[q.by] = askText(q);
  for (const [k, p] of Object.entries(r.given)) if (kinds.includes(k)) { const u = wallUrl({ critter: p.critter, neg: p.neg, map: p.map, season: p.season, weather: p.weather, day: p.day }); if (u) given[k] = u; }
  return { asks, given };
}

/** The print button (and why not) for an animal's album page. */
export function printButton(kid, critterId) {
  if (!canPrint(kid, critterId)) return '';
  const has = printOf(kid, critterId);
  return `<div class="print-row">
    <button class="btn" data-action="print-ask" data-critter="${esc(critterId)}">🖨️ ${has ? 'Print it again' : 'Print this photo'} · ${ticketsLeft(kid) ? '🎟️ free' : `${PRINT_PRICE} 🪙`}</button>
    ${hasFrame(kid) ? '' : `<small class="muted">Hang it on your photo wall: buy the Photo gallery frame (${FRAME_PRICE} coins) in the Home shop first.</small>`}
  </div>`;
}

/** The print, big, with a Print button: hang it in the frame (asks which photo to take down if the frame is full). */
export function openPrintAsk(kid, critterId) {
  const c = critterById(critterId);
  if (!kid || !c || !canPrint(kid, critterId)) return;
  const rec = kid.critterAlbum[critterId];
  const url = printUrl({ critter: critterId, neg: rec.neg, map: rec.map, season: rec.season, weather: rec.weather, day: rec.date });
  const coins = progressFor(kid).coins;
  const frame = hasFrame(kid);
  const wall = wallOf(kid);
  const full = !wall.slots.includes(null) && !wall.slots.includes(critterId);
  const free = ticketsLeft(kid) > 0;
  const enough = free || coins >= PRINT_PRICE;
  openModal(`
    <div class="print-ask" style="--kid:${esc(kid.color)}">
      <h2>🖨️ Print your ${esc(c.name.toLowerCase())}</h2>
      <div class="print-big ${esc(FRAME_COLORS[wall.color] ? wall.color : 'wood')}"><img src="${url}" alt="${esc(c.name)}"></div>
      <p class="muted small">${esc(MAP_NAMES[rec.map] || '')} · ${esc(dateOf(rec.date))}</p>
      ${!frame ? `<p>First you need somewhere to hang it: the <b>Photo gallery frame</b> is in the Home shop for ${FRAME_PRICE} coins.</p>
        <button class="btn" data-action="modal-close">OK</button>`
    : !enough ? `<p>A print costs ${PRINT_PRICE} coins. You have ${coins}.</p><button class="btn" data-action="modal-close">OK</button>`
      : full ? `<p>Your photo wall is full. Which photo should this one take the place of?</p>
        <div class="print-pick">${wall.slots.map((id, i) => `<button class="btn ghost" data-action="print-do" data-critter="${esc(critterId)}" data-slot="${i}"><img src="${wallUrl({ critter: id, ...printOf(kid, id) })}" alt=""><small>${esc(critterById(id)?.name || '')}</small></button>`).join('')}</div>
        <p class="muted small">The one you take down is kept: you can hang it again from the photo wall for free.</p>
        <button class="btn ghost" data-action="modal-close">Not now</button>`
        : `<button class="btn" data-action="print-do" data-critter="${esc(critterId)}">Print it · ${free ? `free (🎟️ ${ticketsLeft(kid)} left)` : `${PRINT_PRICE} 🪙`}</button>
        <button class="btn ghost" data-action="modal-close">Not now</button>`}
    </div>`);
}

export function doPrint(kid, critterId, slot) {
  const ticket = ticketsLeft(kid) > 0;
  if (!kid || !hasFrame(kid) || (!ticket && progressFor(kid).coins < PRINT_PRICE)) { closeModal(); return; }
  if (!printPhoto(kid, critterId, slot == null || slot === '' ? null : Number(slot), { ticket })) { closeModal(); return; }
  save(); closeModal(); sounds.day(); confetti(50, 1200);
  toast(`Printed! Your ${critterById(critterId)?.name.toLowerCase()} is on your photo wall.`);
  render();
}

/** The photo wall: the four places, the kid's prints to hang, and the frame's color. */
export function openPhotoWall(kid, pick = null) {
  if (!kid) return;
  const wall = wallOf(kid);
  const ids = printIds(kid);
  const card = (id, i) => {
    const c = id && critterById(id);
    const p = id && printOf(kid, id);
    return `<button class="pw-slot ${pick === i ? 'on' : ''}" data-action="photo-slot" data-slot="${i}">
      ${c ? `<span class="print-big ${esc(wall.color)}"><img src="${printUrl({ critter: id, ...p })}" alt=""></span><b>${esc(c.name)}</b><small>${esc(MAP_NAMES[p.map] || '')} · ${esc(dateOf(p.day))}</small>` : '<span class="pw-empty">Empty</span>'}
    </button>`;
  };
  openModal(`
    <div class="photo-wall" style="--kid:${esc(kid.color)}">
      <h2>📷 ${esc(kid.name)}'s photo wall</h2>
      <div class="pw-slots">${wall.slots.map(card).join('')}</div>
      ${pick != null ? `<h3>Hang in place ${pick + 1}</h3>
        <div class="print-pick">${ids.map((id) => `<button class="btn ghost" data-action="photo-hang" data-slot="${pick}" data-critter="${esc(id)}"><img src="${wallUrl({ critter: id, ...printOf(kid, id) })}" alt=""><small>${esc(critterById(id).name)}</small></button>`).join('')}
        ${wall.slots[pick] ? `<button class="btn ghost" data-action="photo-hang" data-slot="${pick}" data-critter="">Take it down</button>` : ''}</div>`
    : `<p class="muted small">${ids.length ? 'Tap a place to change which print hangs there.' : 'No prints yet! Open your critter album, pick a PERFECT photo and print it.'}</p>`}
      <h3>Frame color</h3>
      <div class="pw-colors">${Object.entries(FRAME_COLORS).map(([k, f]) => `<button class="pw-color ${wall.color === k ? 'on' : ''}" data-action="photo-color" data-color="${k}" style="--c:${f.ramp[2]};--d:${f.ramp[0]}">${esc(f.name)}</button>`).join('')}</div>
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
}

/** The actions app.js hooks up (data-action names). */
export const printActions = (kidOf) => ({
  'print-ask': (el) => { sounds.tap(); openPrintAsk(kidOf(), el.dataset.critter); },
  'print-do': (el) => doPrint(kidOf(), el.dataset.critter, el.dataset.slot),
  'photo-slot': (el) => { sounds.tap(); const i = Number(el.dataset.slot); openPhotoWall(kidOf(), i); },
  'photo-hang': (el) => {
    const kid = kidOf();
    if (!kid) return;
    hangPrint(kid, Number(el.dataset.slot), el.dataset.critter || null);
    save(); sounds.tap(); render(); openPhotoWall(kid);
  },
  'photo-color': (el) => {
    const kid = kidOf();
    if (!kid || !setFrameColor(kid, el.dataset.color)) return;
    save(); sounds.tap(); render();
    const card = $modal.querySelector('.modal-card'); const top = card ? card.scrollTop : 0;
    openPhotoWall(kid);
    const c2 = $modal.querySelector('.modal-card'); if (c2) c2.scrollTop = top;
  },
});

export { WALL_SLOTS };
