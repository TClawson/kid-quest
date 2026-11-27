// The critter album (the photo train's animal book, js/album.js): a page for each map with the
// kid's best photo of every animal found, shadows for the ones still to find, and a page for
// each animal with real facts. Opened from the Status pop-up, like the fish book.
import { openModal, esc, kidTheme, today, $modal } from './ctx.js';
import { albumPages, albumCount, photoOf, CLUES_FOR_LEGEND } from './album.js';
import { critterById, QUALITY, SLOTS, RARITIES } from './critters.js';
import { critterPic } from './critterart.js';
import { seasonOf } from './seasons.js';
import { printButton, printUrl } from './printsview.js';

const SEASON_ICONS = [['spring', '🌸'], ['summer', '☀️'], ['autumn', '🍂'], ['winter', '❄️']];
const picCache = new Map();

/** The animal's own picture (a data URL), or its shadow when it hasn't been found. */
function critterImg(c, shadow = false) {
  const key = `${c.id}|${shadow}`;
  if (picCache.has(key)) return picCache.get(key);
  // hawks and eagles are told apart by their wings, so their shadows fly
  const src = critterPic(c.look, shadow && c.look.plan === 'big-bird' && !c.look.owl ? 'fly' : 'pose');
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const x = cv.getContext('2d'); x.drawImage(src, 0, 0);
  if (shadow) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#5a4f7a'; x.fillRect(0, 0, cv.width, cv.height); }
  const url = cv.toDataURL();
  picCache.set(key, url);
  return url;
}

/** A hint for an animal not found yet: where to look. */
export function hintFor(c) {
  if (c.december) return 'Only in December!';
  if (c.night) return 'Only out at night';
  if (c.rarity === 'secret') return 'Very, very rare';
  if (c.tunnel) return 'Lives in the dark';
  if (c.sea) return 'Likes the water';
  const h = c.how;
  if (h.every((x) => x === 'far')) return 'Far up on the hills';
  if (h.includes('perch')) return 'Sits up high';
  if (h.includes('fly')) return c.map === 'bg-ocean' ? 'Swims past' : 'Flies past';
  if (c.camo) return 'Looks just like a rock';
  if (c.dusk) return 'Comes out at sunset';
  if (c.map === 'bg-rainbow' && c.rarity === 'legend') return 'Fill the rainbow';
  const from = { bush: 'Hides in the bushes', log: 'Hides behind logs', burrow: 'Lives in a burrow', rock: 'Hides behind rocks', reeds: 'Likes the reeds', tree: 'Hides behind trees', tower: 'Lives in the towers', anemone: 'Lives in an anemone', coral: 'Hides in the coral' }[[].concat(c.from || [])[0]];
  if (from) return from;
  if (h.includes('rise') || h.includes('hop')) return 'Pops up from the ground';
  if (h.includes('track')) return 'Might stop the train';
  if (h.includes('step')) return 'Hides behind trees';
  return 'Keep looking';
}

const seasonsRow = (c) => `<span class="ca-seas" title="${c.seasons ? esc(c.seasons.join(', ')) : 'All year'}">${SEASON_ICONS.map(([k, e]) => `<span class="${!c.seasons || c.seasons.includes(k) ? '' : 'off'}">${e}</span>`).join('')}</span>`;
const dateOf = (key) => (key ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

export function openCritterAlbum(kid, scrollTo = 0) {
  if (!kid) return;
  const album = kid.critterAlbum || {};
  const { found, total } = albumCount(album);
  const pages = albumPages(album, kidTheme(kid), seasonOf(today())).map((page) => {
    const n = page.animals.filter((a) => a.rec).length;
    const clues = kid.critterClues?.[page.map] || 0;
    return `
      <div class="fb-map">
        <h3>📷 ${esc(page.name)} <small>${n} of ${page.animals.length}</small></h3>
        ${clues ? `<p class="muted small">🐾 Clues to this map's legend: ${clues} of ${CLUES_FOR_LEGEND}${clues >= CLUES_FOR_LEGEND ? '. It could come on your next ride!' : ''}</p>` : ''}
        <div class="fb-grid ca-grid">
          ${page.animals.map(({ c, rec }) => (rec ? `
            <button class="fb-fish ca-card ${c.rarity === 'rare' || c.rarity === 'legend' || c.rarity === 'secret' ? 'rare' : ''} ${c.december ? 'december' : ''}" data-action="critter-page" data-critter="${esc(c.id)}">
              <img src="${photoOf(kid.id, c.id) || critterImg(c)}" alt="">
              <b>${esc(c.name)}</b>
              <span class="ca-q ${esc(rec.q)}">${esc(QUALITY[rec.q]?.name || '')}</span>
              ${seasonsRow(c)}
            </button>` : `
            <div class="fb-fish ca-card none ${c.rarity === 'rare' || c.rarity === 'legend' || c.rarity === 'secret' ? 'rare' : ''} ${c.december ? 'december' : ''}">
              <img src="${critterImg(c, true)}" alt="">
              <b>???</b>
              <small>${esc(hintFor(c))}</small>
              ${seasonsRow(c)}
            </div>`)).join('')}
        </div>
      </div>`;
  }).join('');
  openModal(`
    <div class="fishbook critter-album" style="--kid:${esc(kid.color)}">
      <h2>📷 ${esc(kid.name)}'s critter album</h2>
      <p class="muted small fb-count">${found ? `${found} of ${total} animals photographed. Each one keeps its best photo. Tap an animal to learn about it!` : `No photos yet! Ride the photo train with a visiting buddy who has a camera, or with your own camera: every animal you snap goes in here (${total} to find).`}</p>
      ${pages}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
  if (scrollTo) { const card = $modal.querySelector('.modal-card'); if (card) card.scrollTop = scrollTo; }
}

/** One animal's page: the kid's photo, how good it is, which kinds of shot they have, and real facts. */
export function openCritterPage(kid, id) {
  const c = critterById(id);
  const rec = kid?.critterAlbum?.[id];
  if (!c || !rec) return;
  const facts = [['🗺️ Where it lives', c.where], ['🍽️ What it eats', c.eats], ['🤩 Wow!', c.wow]].filter(([, t]) => t);
  const slots = Object.entries(SLOTS).map(([k, s]) => `<li class="${rec.slots?.includes(k) ? 'got' : ''}">${rec.slots?.includes(k) ? '✓' : '○'} ${esc(s)}</li>`).join('');
  openModal(`
    <div class="fishpage critter-page" style="--kid:${esc(kid.color)}">
      <button class="btn ghost small-btn fp-back" data-action="album-back">◀ Critter album</button>
      <div class="fp-head ${c.rarity === 'rare' || c.rarity === 'legend' || c.rarity === 'secret' ? 'rare' : ''} ${c.december ? 'december' : ''}">
        <img src="${photoOf(kid.id, id) || (rec.neg ? printUrl({ critter: id, neg: rec.neg, map: rec.map, season: rec.season, weather: rec.weather, day: rec.date }) : critterImg(c))}" alt="">
        <div>
          <h2>${c.night ? '🌙 ' : c.rarity === 'secret' ? '💎 ' : c.rarity === 'legend' ? '🌟 ' : c.rarity === 'rare' ? '⭐ ' : ''}${esc(c.name)}</h2>
          <p class="muted small">${esc(RARITIES[c.rarity]?.name || '')}${c.december ? ' · December animal' : ''}${c.night ? ' · Comes out at night' : ''} · ${seasonsRow(c)}</p>
        </div>
      </div>
      <div class="fp-mine ca-mine ${esc(rec.q)}">
        <div><b>Your best photo: ${esc(QUALITY[rec.q]?.name || '')}</b><small>${esc(dateOf(rec.date))}</small></div>
      </div>
      <ul class="ca-slots">${slots}</ul>
      ${printButton(kid, id)}
      ${c.december ? `<p class="fp-december">🎄 <b>A December animal!</b> ${esc(c.fun || '')} It rides the photo train only in December, and comes back every year.</p>` : ''}
      ${c.cousin ? `<p class="fp-pretend">✨ The ${esc(c.name.toLowerCase())} is a pretend animal: it lives only in this game. Its real-life cousin is the <b>${esc(c.cousin)}</b>, so the facts here are the real cousin's.</p>` : ''}
      ${facts.map(([h, t]) => `<h3>${h}</h3><p>${esc(t)}</p>`).join('')}
      <button class="btn" data-action="album-back">Back to the critter album</button>
    </div>`);
}
