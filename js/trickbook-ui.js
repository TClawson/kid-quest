// The trick book: every trick card a kid has landed on the bike (kid.trickBook, kept by
// js/bike.js through play-ui.js), like the fish book. Each card shows the kid's own buddy doing
// the trick, the highest and longest it was landed, and a real fact. Cards not landed yet show
// as dark outlines with a hint about where to find them (a map, a kind of day, a good bike).
import { TRICKS, RARITY, TRICK, drawCard, likeA, HEIGHTS, LENGTHS, Rider } from './bike.js';
import { HILLS, SNOW_KINDS } from './slopes.js';
import { openModal, esc } from './ctx.js';

const GROUPS = [
  ['Tricks', (t) => t.combo || t.id === 'wheelie' || t.id === 'golden'],
  ['Map tricks', (t) => t.map],
  ['Snow tricks', (t) => t.snow],
  ['Grinds (good bike)', (t) => t.rarity === 'grind'],
];

/** Where a card can be found, for the dark ones. */
export function trickHint(t) {
  if (t.map) return `Only on ${HILLS[t.map]?.name || 'its map'}`;
  if (t.snow) return `Only on ${SNOW_KINDS[t.snow]?.name.toLowerCase()} days`;
  if (t.rarity === 'grind') return 'Needs a good bike (pegs)';
  if (t.id === 'golden') return 'Off a golden ramp';
  return RARITY[t.rarity].name;
}

/** The kid's rider (buddy on its bike), drawn once, for the card pictures. */
function riderSprite(kid) {
  try {
    const r = new Rider(null, kid.buddy, kid.name, 1, 11);
    r.paint(0);
    return r.sprite;
  } catch { return null; }
}

function cardImg(t, have, sprite) {
  const c = document.createElement('canvas');
  c.width = 74 * 3; c.height = 100 * 3;
  drawCard(c.getContext('2d'), t, 0, 0, c.width, c.height, 6.6, have ? { h: have.h, sprite } : { sprite });
  return c.toDataURL();
}

export function openTrickBook(kid) {
  if (!kid) return;
  const book = kid.trickBook || {};
  const sprite = riderSprite(kid);
  const n = TRICKS.filter((t) => book[t.id]).length;
  const groups = GROUPS.map(([name, keep]) => {
    const list = TRICKS.filter(keep);
    const got = list.filter((t) => book[t.id]).length;
    return `
      <div class="tb-group">
        <h3>${esc(name)} <small>${got} of ${list.length}</small></h3>
        <div class="tb-grid">
          ${list.map((t) => {
            const have = book[t.id];
            return `<button class="tb-card ${have ? '' : 'none'}" data-action="trick-page" data-trick="${esc(t.id)}">
              <img src="${cardImg(t, have, sprite)}" alt="${esc(have ? t.name : 'Not landed yet')}">
              <small>${have ? `${have.n}x · ${have.h.toFixed(1)} m high` : esc(trickHint(t))}</small>
            </button>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
  openModal(`
    <div class="trickbook" style="--kid:${esc(kid.color || '#e03131')}">
      <h2>🚲 ${esc(kid.name)}'s trick book</h2>
      <p class="muted small">${n ? `${n} of ${TRICKS.length} trick cards. Each one keeps your highest and longest jump. Tap a card to read about it!` : `No tricks yet! Ride a bike with a visiting buddy: every new trick you land is a card for this book (${TRICKS.length} to find).`}</p>
      ${groups}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
}

export function openTrickPage(kid, id) {
  const t = TRICK[id];
  if (!kid || !t) return;
  const have = kid.trickBook?.[id];
  const sprite = riderSprite(kid);
  openModal(`
    <div class="trickbook tb-page">
      <img class="tb-big" src="${cardImg(t, have, sprite)}" alt="">
      <h2>${esc(have ? t.name : '???')}</h2>
      <p class="muted small">${esc(RARITY[t.rarity].name)} · ${esc(trickHint(t))}</p>
      ${have ? `
        <p>${esc(t.note)}</p>
        <p><b>Highest:</b> ${have.h.toFixed(1)} m, as high as ${esc(likeA(have.h, HEIGHTS))}.<br>
        <b>Longest:</b> ${have.d.toFixed(1)} m, as long as ${esc(likeA(have.d, LENGTHS))}.<br>
        Landed ${have.n} ${have.n === 1 ? 'time' : 'times'}${have.perfect ? `, ${have.perfect} stomped perfectly` : ''}.</p>` : '<p>Not landed yet. Keep riding!</p>'}
      <div class="row"><button class="btn" data-action="trick-book">Back</button><button class="btn ghost" data-action="modal-close">Close</button></div>
    </div>`);
}
