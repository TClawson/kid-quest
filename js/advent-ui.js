// The December village's pop-ups (rules in advent.js): Santa's present and his letter, the advent
// calendar's wall of doors, Santa's letters book and door 25's star. app.js hands xmasHandlers
// to the village (village.js passes them to xmasvillage.js), which calls them when Santa sets off,
// when his present or the advent house is tapped, and to ask what to show.
//
// Anything run later (a tap, a closed pop-up) finds the kid again by id: a family update replaces
// the kid objects.

import {
  santaDue, santaFlies, santaRecord, presentsWaiting, openSanta, lettersKept, SANTA_PRIZES,
  doorsOf, doorState, missedDoors, rollDoor, rollLittleDoor, openDoor, doorWords, doorsToday,
  STAR_DOOR, STAR_DOOR_COINS, MAX_DOORS_A_DAY,
} from './advent.js';
import { santaNote } from './santanotes.js';
import { storeOpen } from './logic.js';
import { rng } from './treasure.js';
import { sounds, confetti } from './fx.js';
import { playsLittle, earnSticker, nextAnimal, littleMap } from './littlerules.js';
import { itemById, addOwned, ownedFor } from './items.js';
import { ornamentById, STARS, starsWon, isXmas } from './xmas.js';
import { ornamentArt, artCanvas } from './xmasart.js';
import { adventWallArt } from './adventart.js';
import { openedArt, letterArt } from './santaart.js';
import { critterById } from './critters.js';
import { critterPic } from './critterart.js';
import {
  state, ui, $modal, today, esc, kidById, save, render, openModal, kidTheme,
} from './ctx.js';

const TWINKLE_MS = 420;
const nameOf = (id) => ornamentById(id)?.name || itemById(id)?.name || id;
const monthDay = (day) => `${Number(day.slice(8, 10))} December`;

// pictures, drawn once each
const pics = new Map();
const picUrl = (key, make) => { if (!pics.has(key)) { const c = make(); pics.set(key, c ? c.toDataURL() : ''); } return pics.get(key); };
const ornUrl = (id, f = 0) => picUrl(`orn:${id}:${f}`, () => { const b = ornamentArt(id, f); return b ? artCanvas(b, document) : null; });
const animalUrl = (id) => picUrl(`animal:${id}`, () => { const c = critterById(id); return c ? critterPic(c.look, 'pose') : null; });
const letterUrl = () => picUrl('letter', () => letterArt());
const openedUrl = (kind, f = 0) => picUrl(`opened:${kind}:${f}`, () => openedArt(kind, f));

/** What the village asks and tells (see xmasvillage.js mountDecor). */
export const xmasHandlers = {
  /** Santa: does he fly now, presents already by the door, letters kept (for the mailbox). */
  live: (kidId) => {
    const kid = kidById(kidId);
    if (!kid) return null;
    const t = today();
    return { fly: santaDue(kid, t), waiting: presentsWaiting(kid, t).length, letters: playsLittle(kid) ? 0 : lettersKept(kid).length };
  },
  /** Santa sets off: the present is the kid's now, on every device. */
  onFly: (kidId) => {
    const kid = kidById(kidId);
    if (!kid || !santaDue(kid, today())) return;
    santaFlies(kid, today(), playsLittle(kid));
    save();
  },
  /** He waits while a pop-up is open, or while the kid is on another screen. */
  paused: () => !$modal.hidden || ui.view !== 'kid',
  onPresent: (kidId) => openPresent(kidId),
  onAdvent: (kidId, o) => openAdvent(kidId, o),
  onLetters: (kidId) => openLetters(kidId),
};

// ---------- Santa's present ----------

/** Unwraps the oldest present by the door. Returns how many more are waiting. */
export function openPresent(kidId) {
  const kid = kidById(kidId);
  if (!kid) return 0;
  const t = today();
  const days = presentsWaiting(kid, t);
  const day = days[0];
  if (!day) return 0;
  const rec = santaRecord(kid, day);
  const extra = {};
  if (rec.prize === 'sticker') {
    // the little one's sticker: an animal of her map she hasn't met yet, the same on every device
    const animal = nextAnimal(kid, kidTheme(kid), rng(`${kid.id}|${day}|sticker`));
    if (animal) { earnSticker(kid, animal); extra.animal = animal; }
  }
  const done = openSanta(kid, day, t, extra);
  save();
  sounds.tap();
  if (!SANTA_PRIZES[done.prize]) {
    // the little one's: pictures only, no words to read
    const pic = done.prize === 'sticker' && done.animal
      ? `<div class="xm-sticker"><img src="${animalUrl(done.animal)}" alt=""></div>`
      : `<img class="xm-gift" src="${openedUrl('coins')}" alt=""><div class="xm-rain" aria-hidden="true">${'<i>🪙</i>'.repeat(14)}</div>`;
    openModal(`<div class="celebrate xm-pop xm-little" data-present="${esc(done.prize)}">${pic}<button class="btn huge" data-action="modal-close" aria-label="Yay!">🎁 👍</button></div>`, () => render());
    setTimeout(() => { sounds.day(); confetti(90, 2000); }, 300);
    return days.length - 1;
  }
  const words = { gems: ['3 gems!', 'Gems buy sports gear.'], coins: ['10 coins!', 'Spend them in the shop.'], plays: ['2 extra games!', 'Play more with your visitors today or tomorrow.'] }[done.prize];
  const note = santaNote(Number(day.slice(8, 10)));
  openModal(`
    <div class="celebrate xm-pop" data-present="${esc(done.prize)}">
      <h1>A present from Santa!</h1>
      <img class="xm-gift" src="${openedUrl(done.prize)}" alt="">
      <p class="prize-big"><b>${esc(words[0])}</b> ${esc(words[1])}</p>
      ${note ? letterHtml(day, note) : ''}
      <button class="btn huge" data-action="modal-close">Thank you, Santa!</button>
      ${days.length > 1 ? `<p class="muted small">${days.length - 1} more ${days.length > 2 ? 'presents' : 'present'} by your door!</p>` : '<p class="muted small">Santa\'s letters go in the mailbox by your door.</p>'}
    </div>`, () => render());
  setTimeout(() => { sounds.day(); confetti(90, 2000); }, 300);
  return days.length - 1;
}

function letterHtml(day, note, { head = 'Ho ho ho!' } = {}) {
  return `<div class="v-letter"><img src="${letterUrl()}" alt=""><div class="v-letter-text"><i class="v-seal-room" aria-hidden="true"></i><b>${esc(head)}</b> ${esc(note.note)}<span class="v-sign">Love, Santa</span></div></div>`;
}

// ---------- Santa's letters book (the mailbox by the kid's door) ----------

export function openLetters(kidId, at = null) {
  const kid = kidById(kidId);
  if (!kid) return;
  const days = lettersKept(kid);
  if (!days.length) return;
  const day = days.includes(at) ? at : days[days.length - 1];
  const note = santaNote(Number(day.slice(8, 10)));
  const i = days.indexOf(day);
  sounds.tap();
  openModal(`
    <div class="xm-pop xm-letters">
      <h2>Santa's letters</h2>
      <nav class="xm-days" aria-label="Letters by day">${days.map((d) => `<button class="${d === day ? 'on' : ''}" data-day="${d}" aria-pressed="${d === day}">${Number(d.slice(8, 10))}</button>`).join('')}</nav>
      <p class="xm-place">${esc(monthDay(day))}${note ? ` · ${esc(note.place)}` : ''}</p>
      ${note ? letterHtml(day, note, { head: `Dear ${kid.name},` }) : ''}
      <div class="xm-flip">
        <button class="btn ghost" data-day="${days[i - 1] || ''}" ${i ? '' : 'disabled'} aria-label="Letter before">◀</button>
        <button class="btn" data-action="modal-close">Close</button>
        <button class="btn ghost" data-day="${days[i + 1] || ''}" ${i < days.length - 1 ? '' : 'disabled'} aria-label="Next letter">▶</button>
      </div>
    </div>`);
  $modal.querySelectorAll('.xm-letters [data-day]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.day) openLetters(kidId, b.dataset.day); }));
}

// ---------- the advent calendar ----------

const WHY = {
  chores: 'Finish today\'s chores to open a door.',
  waiting: 'Waiting for a grown-up',
  max: `That's ${MAX_DOORS_A_DAY} doors today. More tomorrow!`,
  over: 'The advent calendar comes back next December.',
};

/** What the wall says at the bottom before a door is tapped. */
function wallLine(kid, t, approval) {
  if (!isXmas(t)) return WHY.over;
  const opened = doorsOf(kid, t.slice(0, 4));
  const date = Number(t.slice(8, 10));
  const shut = [];
  for (let n = 1; n <= Math.min(date, STAR_DOOR); n += 1) if (!opened[n]) shut.push(n);
  if (!shut.length) return Object.keys(opened).length >= STAR_DOOR ? 'Every door is open. Merry Christmas!' : 'See you tomorrow for the next door!';
  if (shut.includes(STAR_DOOR) && shut.length === 1) return 'Door 25 is open to you: pick a star!';
  const s = doorState(kid, t, shut.find((n) => n !== STAR_DOOR), approval);
  if (!s.ok) return shut.includes(STAR_DOOR) ? `${WHY[s.why].replace(/[^.!]$/, '$&.')} Door 25 needs no chores!` : WHY[s.why];
  const missed = missedDoors(kid, t).length;
  return missed ? `Tap a door to open it! Missed doors still open, ${MAX_DOORS_A_DAY} a day.` : 'Tap today\'s door to open it!';
}

/** The wall of 25 doors (adventart.js), three twinkle frames, with the kid's real prizes behind the open ones. */
function wallFrames(kid, mapId, t, little) {
  const year = t.slice(0, 4);
  const opened = doorsOf(kid, year);
  const date = isXmas(t) ? Number(t.slice(8, 10)) : 0;
  const shown = {};
  for (const [n, p] of Object.entries(opened)) shown[n] = p.kind === 'star' ? { kind: 'ornament', id: p.id } : p.kind === 'sticker' ? { kind: 'sticker' } : p;
  const missed = missedDoors(kid, t);
  return [0, 1, 2].map((frame) => {
    const cv = adventWallArt({ mapId, today: date <= STAR_DOOR ? date : 0, opened: shown, missed, frame, prizeArt: (id, f) => ornamentArt(id, f % 2) });
    // the little one's doors hold her animal stickers, drawn into their niches
    if (little) {
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (const d of cv.doors) {
        const p = opened[d.n];
        if (p?.kind !== 'sticker' || !p.animal) continue;
        const c = critterById(p.animal);
        if (!c) continue;
        const pic = critterPic(c.look, 'pose');
        const k = Math.min((d.w - 6) / pic.width, (d.h - 10) / pic.height, 1);
        const w = Math.max(1, Math.round(pic.width * k)); const h = Math.max(1, Math.round(pic.height * k));
        ctx.drawImage(pic, Math.round(d.x + (d.w - w) / 2 + 1), Math.round(d.y + d.h - 4 - h), w, h);
      }
    }
    return cv;
  });
}

/** Tapping the advent house: the wall of doors. msg: a line to show under it (after a door). */
export function openAdvent(kidId, o = {}, msg = null) {
  const kid = kidById(kidId);
  if (!kid) return;
  const t = today();
  const mapId = o.mapId || kidTheme(kid);
  const little = playsLittle(kid);
  const approval = storeOpen(state, kid, t);
  const frames = wallFrames(kid, mapId, t, little);
  const line = msg || { text: little ? '' : wallLine(kid, t, approval) };
  const doorsLeft = isXmas(t) && doorsToday(kid, t) < MAX_DOORS_A_DAY && approval.open;
  const icon = little ? (doorsLeft ? '🌟' : '⏳') : '';
  if (!o.keep) sounds.tap();
  openModal(`
    <div class="xm-pop xm-advent${little ? ' xm-little' : ''}">
      ${little ? '' : '<h2>Advent calendar</h2>'}
      <canvas class="xm-wall" width="${frames[0].width}" height="${frames[0].height}" aria-label="25 doors"></canvas>
      ${line.html || ''}
      ${line.text || icon ? `<p class="xm-line${line.why ? ` why-${line.why}` : ''}">${icon ? `<span class="xm-icon">${icon}</span>` : ''}${esc(line.text || '')}</p>` : ''}
      <button class="btn" data-action="modal-close">${little ? '🏡' : 'Back outside'}</button>
    </div>`, () => render());
  const canvas = $modal.querySelector('.xm-wall');
  const ctx = canvas.getContext('2d');
  let f = 0;
  const draw = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(frames[f], 0, 0); };
  draw();
  const reduce = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  if (!reduce) { const timer = setInterval(() => { if (!canvas.isConnected) { clearInterval(timer); return; } f = (f + 1) % 3; draw(); }, TWINKLE_MS); }
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * canvas.width) / r.width; const y = ((e.clientY - r.top) * canvas.height) / r.height;
    const d = frames[0].doors.find((q) => x >= q.x - 2 && x <= q.x + q.w + 2 && y >= q.y - 2 && y <= q.y + q.h + 2);
    if (d) tapDoor(kidId, d.n, { mapId });
  });
  canvas.kqDoors = frames[0].doors; // for tests: where each door is, in canvas pixels
}

/** A door tapped: open it (rolling its prize), or say why not. */
export function tapDoor(kidId, n, o = {}) {
  const kid = kidById(kidId);
  if (!kid) return;
  const t = today();
  const year = t.slice(0, 4);
  const little = playsLittle(kid);
  const s = doorState(kid, t, n, storeOpen(state, kid, t));
  const again = (msg) => openAdvent(kidId, { ...o, keep: true }, msg);
  if (!s.ok) {
    if (s.why === 'opened') {
      sounds.tap();
      const p = doorsOf(kid, year)[n];
      if (little) return;
      const w = doorWords(p, nameOf);
      again({ text: `Door ${n}: ${w.title}`, why: 'opened' });
      return;
    }
    sounds.error();
    if (little) { again({ text: '', why: s.why }); return; }
    again({ text: s.why === 'later' ? `Door ${n} opens on ${n} December.` : WHY[s.why], why: s.why });
    return;
  }
  if (n === STAR_DOOR && !little) { chooseStar(kidId, o); return; }
  let prize;
  if (little) {
    prize = rollLittleDoor({ kidId: kid.id, year, n, animals: littleMap(kidTheme(kid)).animals, met: kid.little?.stickers || {} });
    if (prize.animal) earnSticker(kid, prize.animal);
  } else {
    prize = rollDoor({ kidId: kid.id, year, n, found: kid.xmas?.found || [], owned: ownedFor(kid) });
    const item = prize.item && itemById(prize.item);
    if (item && !ownedFor(kid).includes(item.id)) addOwned(kid, item);
  }
  openDoor(kid, t, n, prize);
  save();
  sounds.day();
  confetti(prize.kind === 'golden' ? 160 : 70, 1800);
  if (little) { again({ html: prize.animal ? `<div class="xm-sticker small"><img src="${animalUrl(prize.animal)}" alt=""></div>` : '' }); return; }
  const w = doorWords(prize, nameOf);
  const pic = prize.id ? `<img class="xm-orn" src="${ornUrl(prize.id)}" alt="">` : '';
  again({ html: `<div class="xm-door-prize${prize.kind === 'golden' ? ' golden' : ''}">${pic}<div><b>Door ${n}: ${esc(w.title)}</b><small>${esc(w.text)}</small></div></div>` });
}

/** Door 25: pick any Star topper (one not won yet), and 100 coins come with it. */
export function chooseStar(kidId, o = {}) {
  const kid = kidById(kidId);
  if (!kid) return;
  const won = new Set(starsWon(kid.xmas?.found || []));
  const open = STARS.filter((s) => !won.has(s.id));
  sounds.tap();
  if (!open.length) { pickStar(kidId, null, o); return; }
  openModal(`
    <div class="xm-pop xm-stars">
      <h2>Door 25: pick a star!</h2>
      <p>It goes on top of your tree. ${STAR_DOOR_COINS} coins come with it.</p>
      <div class="xm-star-grid">${open.map((s) => `<button data-star="${s.id}"><img src="${ornUrl(s.id)}" alt=""><b>${esc(s.name)}</b></button>`).join('')}</div>
      <button class="btn ghost" data-back>Not yet</button>
    </div>`, () => render());
  $modal.querySelectorAll('.xm-stars [data-star]').forEach((b) => b.addEventListener('click', () => pickStar(kidId, b.dataset.star, o)));
  $modal.querySelector('.xm-stars [data-back]').addEventListener('click', () => openAdvent(kidId, { ...o, keep: true }));
}

function pickStar(kidId, starId, o) {
  const kid = kidById(kidId);
  if (!kid) return;
  const t = today();
  if (!doorState(kid, t, STAR_DOOR).ok) { openAdvent(kidId, { ...o, keep: true }); return; }
  // every star won already: just the coins
  const prize = starId ? { kind: 'star', id: starId, coins: STAR_DOOR_COINS } : { kind: 'coins', coins: STAR_DOOR_COINS };
  openDoor(kid, t, STAR_DOOR, prize);
  if (starId) kid.xmas = { ...kid.xmas, star: starId }; // straight onto the top of the tree
  save();
  sounds.day();
  confetti(180, 2600);
  const w = doorWords(prize, nameOf);
  openAdvent(kidId, { ...o, keep: true }, { html: `<div class="xm-door-prize golden">${starId ? `<img class="xm-orn" src="${ornUrl(starId)}" alt="">` : ''}<div><b>Door 25: ${esc(w.title)}</b><small>${esc(w.text)}</small></div></div>` });
}
