// The ornament book (December event, design-v2 section 2): a page per map, its 4 ornaments in a
// row and under them the map's Star topper, which finding all 4 wins (door 25 gives any one star
// too). Grey shapes until found. On top: how many are found, and the tinsel a kid has saved from
// doubles (TINSEL_PRICE tinsel buys a missing ornament). Opened by tapping the tree in the
// buddy's house. HTML only; xmasart.js draws the pictures, the caller passes them in as image URLs.

import { XMAS_MAPS, ORNAMENTS, STARS, RARITY, TINSEL_PRICE, starsWon } from './xmas.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * kid: { name, color, xmas: { found: ids, star: the star on top, tinsel } }. img(id, { grey,
 * frame }): an image URL for an ornament or star, found (frame 0 or 1) or not yet (grey).
 * Returns the book's markup.
 */
export function ornamentBookHtml(kid, img) {
  const x = kid.xmas || {};
  const found = new Set(x.found || []);
  const won = new Set(starsWon(x.found || []));
  const onTop = won.has(x.star) ? x.star : [...won][0] || null;
  const n = ORNAMENTS.filter((o) => found.has(o.id)).length;
  const tinsel = x.tinsel || 0;
  // super-rare ornaments and the stars sparkle: two frames taking turns
  const pic = (o, twinkle) => (twinkle
    ? `<span class="ob-pic twinkle"><img class="ob-f0" src="${img(o.id, { frame: 0 })}" alt=""><img class="ob-f1" src="${img(o.id, { frame: 1 })}" alt=""></span>`
    : `<span class="ob-pic"><img src="${img(o.id, { frame: 0 })}" alt=""></span>`);
  const card = (o) => (found.has(o.id)
    ? `<button class="ob-orn ${o.rarity}" data-action="ornament-page" data-orn="${esc(o.id)}">${pic(o, o.rarity === 'super')}<b>${esc(o.name)}</b><small>${RARITY[o.rarity].name}</small></button>`
    : `<div class="ob-orn none ${o.rarity}" title="Not found yet"><span class="ob-pic"><img src="${img(o.id, { grey: true })}" alt=""></span><b>???</b><small>${RARITY[o.rarity].name}</small></div>`);
  const starRow = (s, got) => {
    if (won.has(s.id)) {
      const top = s.id === onTop;
      return `<button class="ob-star ${top ? 'on-top' : ''}" data-action="tree-star" data-star="${esc(s.id)}" aria-pressed="${top}">${pic(s, true)}<span><b>${esc(s.name)}</b><small>${top ? '⭐ On top of your tree' : 'Star topper · tap to put it on top'}</small></span></button>`;
    }
    return `<div class="ob-star none" title="Not won yet"><span class="ob-pic"><img src="${img(s.id, { grey: true })}" alt=""></span><span><b>Star topper</b><small>Find all 4 to win it (${got} of 4)</small></span></div>`;
  };
  const pages = XMAS_MAPS.map((m) => {
    const list = ORNAMENTS.filter((o) => o.map === m.id);
    const star = STARS.find((s) => s.map === m.id);
    const got = list.filter((o) => found.has(o.id)).length;
    return `
      <div class="fb-map ob-map ${got === 4 ? 'done' : ''}">
        <h3>${esc(m.name)} <small>${got} of 4${won.has(star.id) ? ' · ⭐' : ''}</small></h3>
        <div class="ob-grid">${list.map(card).join('')}</div>
        ${starRow(star, got)}
      </div>`;
  }).join('');
  return `
    <div class="ornbook" style="--kid:${esc(kid.color || '#7048e8')}">
      <h2>🎄 ${esc(kid.name)}'s ornament book</h2>
      <p class="muted small fb-count">${n} of ${ORNAMENTS.length} ornaments found, and ${won.size} of ${STARS.length} star toppers. Find all 4 of a map's ornaments to win its star, and pick any star at door 25. Every map has its own, so travel to fill the tree!</p>
      <div class="ob-tinsel"><span class="ob-tin">✨ ${tinsel} tinsel</span><span class="muted small">A double turns into tinsel. ${TINSEL_PRICE} tinsel buys any ornament you're missing.</span><button class="btn small" data-action="tinsel-swap" ${tinsel >= TINSEL_PRICE && n < ORNAMENTS.length ? '' : 'disabled'}>Pick one</button></div>
      <div class="ob-maps">${pages}</div>
      <button class="btn" data-action="modal-close">Close</button>
    </div>`;
}
