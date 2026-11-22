// The fans book: the map critters that cheered the kid on in keepy-uppy, hockey and football
// (fans.js). One page per map with its three fans (common, uncommon, rare), how many times each
// cheered, and a page of real facts for each. It is a tab of the book on the house's shelf,
// beside the fish, finds and digs books.
import { FANS, FAN_RARITY, fanById, fanCount } from './fans.js';
import { critterPic } from './critterart.js';
import { FIELD_LOOKS } from './fieldlooks.js';
import { bookTabs } from './findsbook-ui.js';
import { openModal, esc, $modal } from './ctx.js';

const MAPS = Object.keys(FIELD_LOOKS);
const imgCache = new Map();
/** A fan's picture as an image URL: in color, or a dark shape for one that hasn't cheered yet. */
function fanImg(f, dark = false) {
  const id = `${f.id}|${dark}`;
  if (!imgCache.has(id)) {
    const pic = critterPic(f.look, 'pose');
    const c = document.createElement('canvas'); c.width = pic.width; c.height = pic.height;
    const x = c.getContext('2d');
    x.drawImage(pic, 0, 0);
    if (dark) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#6e5a7e'; x.fillRect(0, 0, c.width, c.height); }
    imgCache.set(id, c.toDataURL());
  }
  return imgCache.get(id);
}

const day = (key) => (key ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const tag = (rarity) => (rarity === 'rare' ? '⭐ Rare' : rarity === 'uncommon' ? 'Uncommon' : 'Common');

export function openFansBook(kid, scrollTo = 0) {
  if (!kid) return;
  const fans = kid.fans || {};
  const { got, total } = fanCount(fans);
  const pages = MAPS.map((map) => {
    const list = FANS.filter((f) => f.map === map);
    const n = list.filter((f) => fans[f.id]).length;
    return `
      <div class="fb-map">
        <h3>📣 ${esc(FIELD_LOOKS[map].name)} <small>${n} of ${list.length}</small></h3>
        <div class="fb-grid">
          ${list.map((f) => (fans[f.id] ? `
            <button class="fb-fish fan ${f.rarity}" data-action="fan-page" data-id="${esc(f.id)}">
              <img src="${fanImg(f)}" alt="">
              <b>${esc(f.name)}</b>
              <small>Cheered ${fans[f.id].n} ${fans[f.id].n === 1 ? 'time' : 'times'}</small>
            </button>` : `
            <div class="fb-fish fan none ${f.rarity}" title="${tag(f.rarity)}">
              <img src="${fanImg(f, true)}" alt="">
              <b>???</b>
              <small>${tag(f.rarity)}</small>
            </div>`)).join('')}
        </div>
      </div>`;
  }).join('');
  openModal(`
    <div class="fishbook fansbook" style="--kid:${esc(kid.color)}">
      ${bookTabs('fans')}
      <h2>📖 ${esc(kid.name)}'s fans</h2>
      <p class="muted small fb-count">${got ? `${got} of ${total} fans. Critters come to watch keepy-uppy, hockey and football. Do something great while one watches and it cheers for you! Tap one to learn about it.` : `No fans yet! When you play keepy-uppy, hockey or football with a visitor, a critter from your map may come to watch. Kick a Perfect, score a goal or make a catch while it watches, and it becomes your fan (${total} to meet, 3 on every map).`}</p>
      ${pages}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
  if (scrollTo) { const card = $modal.querySelector('.modal-card'); if (card) card.scrollTop = scrollTo; }
}

/** One fan's page: when it first cheered, how often, and the real facts. */
export function openFanPage(kid, id) {
  const f = fanById(id);
  const rec = kid?.fans?.[id];
  if (!f || !rec) return;
  openModal(`
    <div class="fishpage findpage fanpage" style="--kid:${esc(kid.color)}">
      <button class="btn ghost small-btn fp-back" data-action="fans-book-back">◀ Fans</button>
      <div class="fp-head ${f.rarity === 'rare' ? 'rare' : ''}">
        <img src="${fanImg(f)}" alt="">
        <div>
          <h2>${esc(f.name)}</h2>
          <p class="muted small">${esc(FIELD_LOOKS[f.map]?.name || '')} · ${FAN_RARITY[f.rarity].name}</p>
        </div>
      </div>
      <div class="fp-mine">
        <span class="fp-badge">📣</span>
        <div><b>Cheered for you ${rec.n} ${rec.n === 1 ? 'time' : 'times'}</b><small>Your fan since ${esc(day(rec.first))}</small></div>
      </div>
      ${f.cousin ? `<h3>🐾 Real cousin: ${esc(f.cousin)}</h3>` : '<h3>🤩 Wow!</h3>'}
      <p>${esc(f.fact)}</p>
      <button class="btn" data-action="fans-book-back">Back to the fans</button>
    </div>`);
}
