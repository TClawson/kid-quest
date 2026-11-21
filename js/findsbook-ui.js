// The finds book in the buddy's house: everything the kid found on the treasure hill (the sled
// game, sledding.js), one page per map, each find with its best badge and its biggest size, and
// a page of real facts for each (finds.js). It sits beside the fish book: the book on the
// house's shelf opens either one.
import { findPages, findCount, findByKey, CONDITIONS, SIZE_CLASSES, sizeClass, SIZES, fmtSize, RARITY } from './finds.js';
import { findCells } from './findart.js';
import { HILLS } from './slopes.js';
import { openModal, esc, $modal } from './ctx.js';

const imgCache = new Map();
/** A find's picture as an image URL: in color, or a dark shape for one not found yet. */
function findImg(key, dark = false) {
  const id = `${key}|${dark}`;
  if (!imgCache.has(id)) {
    const cells = findCells(findByKey(key));
    const c = document.createElement('canvas'); c.width = 10; c.height = 10;
    const x = c.getContext('2d');
    cells.forEach((row, j) => row.forEach((col, i) => { if (col) { x.fillStyle = dark ? '#6e5a7e' : col; x.fillRect(i, j, 1, 1); } }));
    imgCache.set(id, c.toDataURL());
  }
  return imgCache.get(id);
}

const day = (key) => (key ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const tag = (rarity) => (rarity === 'super' ? '💖 Super rare' : rarity === 'rare' ? '⭐ Rare' : '');

/** The tabs at the top of the book: the fish book or the finds book. */
export const bookTabs = (on) => `
  <div class="book-tabs" role="tablist">
    <button class="btn ${on === 'fish' ? '' : 'ghost'}" role="tab" aria-selected="${on === 'fish'}" data-action="book-tab" data-book="fish">🎣 Fish</button>
    <button class="btn ${on === 'finds' ? '' : 'ghost'}" role="tab" aria-selected="${on === 'finds'}" data-action="book-tab" data-book="finds">🛷 Finds</button>
  </div>`;

export function openFindsBook(kid, scrollTo = 0) {
  if (!kid) return;
  const recs = kid.findRecords || {};
  const { found, total } = findCount(recs);
  const pages = findPages(recs).map((page) => {
    const n = page.finds.filter((f) => f.record).length;
    return `
      <div class="fb-map">
        <h3>🛷 ${esc(HILLS[page.map]?.name || page.map)} <small>${n} of ${page.finds.length}</small></h3>
        <div class="fb-grid ${n ? '' : 'mini'}">
          ${page.finds.map((f) => (f.record ? `
            <button class="fb-fish find ${f.rarity}" data-action="find-page" data-key="${esc(f.key)}">
              <img src="${findImg(f.key)}" alt="">
              <b>${esc(f.name)}</b>
              <span class="fb-size"><span class="fd-stars">${CONDITIONS[f.record.q || 1].stars}</span> ${f.record.in ? `${SIZE_CLASSES[sizeClass(f.key, f.record.in)].icon}${fmtSize(f.record.in)}` : ''}</span>
              <small>${f.record.n > 1 ? `Found ${f.record.n} times` : esc(day(f.record.date))}</small>
            </button>` : `
            <div class="fb-fish find none ${f.rarity}" title="${tag(f.rarity) || 'Not found yet'}">
              <img src="${findImg(f.key, true)}" alt="">
              <b>???</b>
              <small>${tag(f.rarity) || 'Not found yet'}</small>
            </div>`)).join('')}
        </div>
      </div>`;
  }).join('');
  openModal(`
    <div class="fishbook findsbook" style="--kid:${esc(kid.color)}">
      ${bookTabs('finds')}
      <h2>📖 ${esc(kid.name)}'s finds book</h2>
      <p class="muted small fb-count">${found ? `${found} of ${total} finds. Each one shows its best condition (★ rough, ★★ fine, ★★★ perfect) and the biggest yet. Tap one to learn about it!` : `Nothing yet! Go sledding with a visiting buddy (you need a sled from the gem shop): every hill hides its own treasures (${total} to find).`}</p>
      ${pages}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
  if (scrollTo) { const card = $modal.querySelector('.modal-card'); if (card) card.scrollTop = scrollTo; }
}

/** One find's page: the kid's best, how big they get, and the real facts. */
export function openFindPage(kid, key) {
  const f = findByKey(key);
  const rec = kid?.findRecords?.[key];
  if (!f || !rec) return;
  const [lo, mid, hi] = SIZES[key] || [1, 2, 4];
  const cls = rec.in ? sizeClass(key, rec.in) : null;
  const trophyFrom = Math.round((mid + (hi - mid) * 0.6) * 10) / 10;
  const smallTo = Math.round(mid * 0.8 * 100) / 100;
  const pos = (v) => Math.max(0, Math.min(100, (100 * (v - lo)) / (hi - lo || 1)));
  const c = CONDITIONS[rec.q || 1];
  openModal(`
    <div class="fishpage findpage" style="--kid:${esc(kid.color)}">
      <button class="btn ghost small-btn fp-back" data-action="finds-book-back">◀ Finds book</button>
      <div class="fp-head ${f.rarity === 'rare' || f.rarity === 'super' ? 'rare' : ''}">
        <img src="${findImg(key)}" alt="">
        <div>
          <h2>${esc(f.name)}</h2>
          <p class="muted small">${esc(HILLS[f.map]?.name || '')} · ${RARITY[f.rarity].name}</p>
        </div>
      </div>
      <div class="fp-mine">
        <span class="fp-badge">${c.stars}</span>
        <div><b>Your best: ${c.name}${rec.in ? ` · ${fmtSize(rec.in)}` : ''}</b><small>${cls ? `${SIZE_CLASSES[cls].icon} ${SIZE_CLASSES[cls].name}` : ''} · found ${rec.n || 1} ${rec.n > 1 ? 'times' : 'time'} · ${esc(day(rec.date))}</small></div>
      </div>
      ${rec.q < 3 ? `<p class="muted small">${rec.q < 2 ? 'Grab one in the air or on a streak for a ★★ fine one. ' : ''}Up on the high line, or with a perfect Big Jump landing, they come out ★★★ perfect!</p>` : ''}
      <h3>📏 How big?</h3>
      <p class="fp-typical">A typical one is about <b>${fmtSize(mid)}</b> long.</p>
      <div class="fp-scale" role="img" aria-label="Small is under ${smallTo} inches, trophy is ${trophyFrom} inches or more">
        <div class="fp-bar"><span class="s" style="width:${pos(smallTo)}%"></span><span class="t" style="width:${pos(trophyFrom) - pos(smallTo)}%"></span><span class="x" style="width:${100 - pos(trophyFrom)}%"></span></div>
        ${rec.in ? `<span class="fp-pin" style="left:${pos(rec.in)}%">▼</span>` : ''}
      </div>
      <ul class="fp-classes">
        <li><span>${SIZE_CLASSES.small.icon}</span> <b>Small</b> under ${fmtSize(smallTo)}</li>
        <li><span>${SIZE_CLASSES.typical.icon}</span> <b>Typical</b> ${fmtSize(smallTo)} to ${fmtSize(trophyFrom)}</li>
        <li><span>${SIZE_CLASSES.trophy.icon}</span> <b>Trophy</b> ${fmtSize(trophyFrom)} or more</li>
      </ul>
      <h3>🔎 What is it?</h3><p>${esc(f.what)}</p>
      <h3>🤩 Wow!</h3><p>${esc(f.wow)}</p>
      <button class="btn" data-action="finds-book-back">Back to the finds book</button>
    </div>`);
}
