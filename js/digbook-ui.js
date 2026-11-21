// The dig book and the house's displays for the dino dig (dig.js). The book (opened from the
// book in the house, beside the fish book) has every skeleton, bone by bone, with real facts,
// and every treasure map by map. The skeleton stand shows one finished skeleton and the
// pedestal one treasure: the kid picks which (kid.digShow = { skeleton, pedestal }).
//
// The kid's finds: kid.digBones and kid.digTreasures, { key: { n, q, date } } (digfinds.js
// recordDig, kept by the game in play-ui.js).
import {
  DINOS, SITES, CONDITIONS, RARITY, boneKey, findInfo, skeletonProgress, completeSkeletons,
} from './digfinds.js';
import { findPic, skeletonPic } from './digart.js';
import { itemById } from './items.js';
import { bookTabs } from './findsbook-ui.js';
import { esc, openModal, $modal } from './ctx.js';

const mapName = (map) => itemById(map)?.name || map;
const imgCache = new Map();
/** A picture (canvas) as an image URL, scaled up with no blur. */
function img(key, make, scale = 1) {
  const k = `${key}|${scale}`;
  if (!imgCache.has(k)) {
    const c = make();
    const d = globalThis.document.createElement('canvas');
    d.width = c.width * scale; d.height = c.height * scale;
    const x = d.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, d.width, d.height);
    imgCache.set(k, d.toDataURL());
  }
  return imgCache.get(k);
}
const findImg = (key, scale = 3) => img(`f:${key}`, () => findPic(key), scale);
const progressKey = (bones, d) => d.bones.map((b) => (bones[boneKey(d.id, b.part)] ? 1 : 0)).join('');

/** The kid's finished skeletons and found treasures, and what stands on each display. */
export function digShow(kid) {
  const done = completeSkeletons(kid?.digBones || {});
  const found = Object.keys(kid?.digTreasures || {}).filter((k) => findInfo(k).kind === 'treasure' && findInfo(k).map);
  const want = kid?.digShow || {};
  // a skeleton or treasure picked earlier that's gone falls back to the first one there is
  return {
    done,
    found,
    skeleton: done.includes(want.skeleton) ? want.skeleton : want.skeleton === null ? null : done[0] || null,
    pedestal: found.includes(want.pedestal) ? want.pedestal : want.pedestal === null ? null : found[0] || null,
  };
}

/** The dig book: tab 'skeletons' or 'treasures'. */
export function openDigBook(kid, tab = 'skeletons', scrollTo = 0) {
  if (!kid) return;
  const bones = kid.digBones || {}; const tre = kid.digTreasures || {};
  const nDone = completeSkeletons(bones).length;
  const nTre = Object.keys(tre).length; const allTre = Object.values(SITES).reduce((n, s) => n + s.treasures.length + (s.special ? 1 : 0), 0);
  let body;
  if (tab === 'skeletons') {
    body = `<div class="fb-map"><div class="fb-grid dig-grid">${DINOS.map((d) => {
      const p = skeletonProgress(d.id, bones);
      return `<button class="fb-fish dig-dino ${p.have ? '' : 'none'} ${p.have === p.total ? 'done' : ''}" data-action="dig-dino" data-id="${esc(d.id)}">
          <img src="${img(`s:${d.id}:${progressKey(bones, d)}`, () => skeletonPic(d.id, bones), 1)}" alt="">
          <b>${esc(d.short || d.name)}</b>
          <small>${p.have === p.total ? '✓ Finished!' : `${p.have} of ${p.total} bones`}${d.common ? '' : ` · skull: ${esc(mapName(d.skullMap))}`}</small>
        </button>`;
    }).join('')}</div></div>`;
  } else {
    body = Object.entries(SITES).map(([map, s]) => {
      const list = [...s.treasures, ...(s.special ? [s.special] : [])].map((t) => findInfo(`${map.replace(/^bg-/, '')}-${t.id}`));
      const n = list.filter((t) => tre[t.key]).length;
      return `<div class="fb-map"><h3>${esc(mapName(map))} <small>${n} of ${list.length}</small></h3><div class="fb-grid ${n ? '' : 'mini'}">${list.map((t) => (tre[t.key] ? `
          <button class="fb-fish ${t.rarity === 'rare' || t.rarity === 'special' ? 'rare' : ''}" data-action="dig-treasure" data-key="${esc(t.key)}">
            <img src="${findImg(t.key)}" alt="">
            <b>${esc(t.name)}</b>
            <small>${CONDITIONS[tre[t.key].q || 1].stars} ${esc(CONDITIONS[tre[t.key].q || 1].name)}</small>
          </button>` : `
          <div class="fb-fish none" title="Not found yet">
            <img src="${img(`d:${t.key}`, () => dark(findPic(t.key)), 3)}" alt="">
            <b>???</b>
            <small>${t.rarity === 'special' ? 'Super special!' : 'Not found yet'}</small>
          </div>`)).join('')}</div></div>`;
    }).join('');
  }
  openModal(`
    <div class="fishbook digbook" style="--kid:${esc(kid.color)}">
      ${bookTabs('digs')}
      <div class="book-tabs dig-tabs">
        <button class="btn ${tab === 'skeletons' ? '' : 'ghost'}" data-action="dig-tab" data-tab="skeletons">🦴 Skeletons</button>
        <button class="btn ${tab === 'treasures' ? '' : 'ghost'}" data-action="dig-tab" data-tab="treasures">💎 Treasures</button>
      </div>
      <h2>📖 ${esc(kid.name)}'s dig book</h2>
      <p class="muted small fb-count">${nDone || nTre ? `${nDone} of ${DINOS.length} skeletons finished, ${nTre} of ${allTre} treasures found. Tap one to learn about it!` : 'Nothing dug up yet! Go on a dino dig with a visiting buddy who has a shovel. Every bone and treasure goes in here.'}</p>
      ${body}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
  if (scrollTo) { const card = $modal.querySelector('.modal-card'); if (card) card.scrollTop = scrollTo; }
}

function dark(c) {
  const d = globalThis.document.createElement('canvas'); d.width = c.width; d.height = c.height;
  const x = d.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#6e5a7e'; x.fillRect(0, 0, d.width, d.height);
  return d;
}

/** A skeleton's page: the skeleton so far, true facts about the animal, and each bone. */
export function openDinoPage(kid, id) {
  const d = DINOS.find((x) => x.id === id);
  if (!kid || !d) return;
  const bones = kid.digBones || {}; const a = d.about;
  const facts = [['🔤 Name means', a.means], ['🕰️ When', a.when], ['🗺️ Where', a.where], ['📏 Size', a.size], ['🍽️ Ate', a.eats], ['🤩 Wow!', a.wow],
    ['💀 Skull', d.common ? 'Can turn up on every map' : `Only at ${mapName(d.skullMap)}`]];
  openModal(`
    <div class="fishpage digpage" style="--kid:${esc(kid.color)}">
      <button class="btn ghost small-btn fp-back" data-action="dig-book-back">◀ Dig book</button>
      <h2>${esc(d.name)}</h2>
      <p class="muted small">Say it: ${esc(d.say)}${d.notDino ? ' · Not a dinosaur: a giant sea lizard!' : ''}</p>
      <div class="dig-sk"><img src="${img(`s:${d.id}:${progressKey(bones, d)}`, () => skeletonPic(d.id, bones), 3)}" alt=""></div>
      <dl class="dig-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <h3>The bones</h3>
      <div class="dig-bones">${d.bones.map((b) => {
    const key = boneKey(d.id, b.part); const have = bones[key];
    return `<div class="dig-bone ${have ? '' : 'none'}">
          <img src="${have ? findImg(key) : img(`d:${key}`, () => dark(findPic(key)), 3)}" alt="">
          <div><b>${esc(b.name)}</b>${have ? ` <span class="fd-stars">${CONDITIONS[have.q || 1].stars}</span>` : ''}<br><small>${have ? esc(b.fact) : 'Not found yet.'}</small></div>
        </div>`;
  }).join('')}</div>
    </div>`);
}

/** A treasure's page: its picture, a true fact, and the kid's best one. */
export function openTreasurePage(kid, key) {
  const t = findInfo(key); const have = kid?.digTreasures?.[key];
  if (!have) return;
  const c = CONDITIONS[have.q || 1];
  openModal(`
    <div class="fishpage digpage" style="--kid:${esc(kid.color)}">
      <button class="btn ghost small-btn fp-back" data-action="dig-book-back">◀ Dig book</button>
      <div class="fp-head"><img src="${findImg(key, 6)}" alt=""><div><h2>${esc(t.name)}</h2><p class="muted small">${esc(mapName(t.map))} · ${esc(RARITY[t.rarity]?.name || t.rarity)}</p></div></div>
      <p>${esc(t.fact)}</p>
      <p class="muted small">Found ${have.n} ${have.n === 1 ? 'time' : 'times'}. Best: <span class="fd-stars">${c.stars}</span> ${esc(c.name)}.</p>
    </div>`);
}

/** Pick what stands on the skeleton stand (kind 'stand') or the pedestal ('pedestal'). */
export function openDisplayPicker(kid, kind) {
  if (!kid) return;
  const s = digShow(kid);
  const stand = kind === 'stand';
  const list = stand ? s.done : s.found;
  const now = stand ? s.skeleton : s.pedestal;
  const name = (id) => (stand ? DINOS.find((d) => d.id === id)?.name : findInfo(id).name);
  const pic = (id) => (stand ? img(`st:${id}`, () => skeletonPic(id, {}, true), 1) : findImg(id));
  openModal(`
    <div class="tankpick digpick" style="--kid:${esc(kid.color)}">
      <h2>${stand ? '🦴 Your skeleton stand' : '💎 Your treasure pedestal'}</h2>
      <p class="muted small">${list.length ? (stand ? 'Pick one finished skeleton to stand in your house.' : 'Pick one treasure to sit under the glass dome.') : (stand ? 'Find all six bones of a dinosaur on a dino dig, and its skeleton can stand here!' : 'Dig up a treasure on a dino dig, and it can sit here under the glass!')}</p>
      <div class="tp-grid">${list.map((id) => `
        <button class="tp-fish ${id === now ? 'on' : ''}" data-action="dig-show" data-kind="${kind}" data-id="${esc(id)}" aria-pressed="${id === now}">
          <img src="${pic(id)}" alt="">
          <b>${esc(name(id))}</b>
          <small>${id === now ? 'On show' : 'Tap to show'}</small>
        </button>`).join('')}</div>
      <div class="tp-buttons">
        ${now ? `<button class="btn ghost" data-action="dig-show" data-kind="${kind}" data-id="">Take it down</button>` : ''}
        <button class="btn ghost" data-action="dig-book">📖 Dig book</button>
        <button class="btn" data-action="modal-close">Done</button>
      </div>
    </div>`);
}
