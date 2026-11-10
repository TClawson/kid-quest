// The music house, inside: a walkable room in the village world (like the buddy's house),
// with a new look for each piano the kid earns (musicart.js draws them). The kid taps to walk
// the buddy round it; walking up to a station uses it: the piano opens the practice
// stopwatch, and the sheet music, the studio and the Note-o-Matic each have their own screen.
// The door leads back out to the village, in front of the music hall.

import { MROOM, paintMusicRoom } from './musicart.js';
import { walkRoom } from './roomwalk.js';
import { pixelBuffer } from './pixelkit.js';
import { tierInfo } from './musicrules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const R = MROOM;

// what each station is called, and its little sign
export const STATIONS = {
  piano: { name: 'Piano', tag: '🎹 Stopwatch' },
  sheets: { name: 'Sheet music', tag: '🎼 Sheet music' },
  studio: { name: 'Studio', tag: '🎚️ Studio' },
  lab: { name: 'Note-o-Matic', tag: '🤖 Note-o-Matic' },
};

/**
 * The music house for a kid. m: {
 *   kidId, kidName, color, buddy: live buddy markup, tier: 1-3 (which look),
 *   studio: { open, left, waiting }: whether today's chores are done (the studio waits for them),
 *   hello: a line to say on the way in (a new look), or '',
 *   quests: quests left outside (for the door sign),
 * }
 */
export function musicHouseHtml(m) {
  const data = { kid: m.kidId, name: m.kidName, color: m.color, tier: m.tier, studio: m.studio || { open: false, left: 0 }, hello: m.hello || '' };
  const info = tierInfo(m.tier);
  return `
    <section class="house music-house tier-${m.tier}" data-kid="${esc(m.kidId)}" data-m="${esc(JSON.stringify(data))}">
      <div class="village-view house-view">
        <div class="village-world" style="width:${R.W}px;height:${R.H}px">
          <canvas class="house-room" width="${R.W}" height="${R.H}" aria-hidden="true"></canvas>
          <canvas class="m-life" width="${R.W}" height="${R.H}" aria-hidden="true"></canvas>
          ${Object.entries(STATIONS).map(([id, s]) => `<button class="h-spot m-station" data-spot="${id}" aria-label="${esc(s.name)}"><span class="h-tag">${esc(s.tag)}</span></button>`).join('')}
          <button class="h-spot" data-spot="door" style="left:${R.door.x - 4}px;top:${R.floorBottom - 16}px;width:${R.door.w + 8}px;height:26px" aria-label="Go outside"><span class="h-tag out">⬇ Outside${m.quests ? ` · ${m.quests} ${m.quests === 1 ? 'quest' : 'quests'}` : ''}</span></button>
          <div class="v-buddy" style="z-index:100"><div class="v-flip">${m.buddy}</div></div>
          <span class="v-target" hidden></span>
        </div>
        <div class="h-sign">🎵 ${esc(m.kidName)}'s ${esc(info.name)}</div>
        <div class="v-dialog" hidden></div>
      </div>
    </section>`;
}

// Per kid, while the app is open: where the buddy stands in the music house, and which
// new looks have been greeted already.
const memory = new Map();
const greeted = new Set();

/** The buddy just came in through the door (instead of wherever it was). */
export function cameInMusic(kidId) { memory.set(kidId, { entering: true }); }

/**
 * Starts every music house inside root. handlers: {
 *   onPiano(): the practice stopwatch, onSheets(), onStudio(), onLab(): the other stations,
 *   onExit(): the buddy went out the door, sound(name),
 * }
 */
export function mountMusicHouses(root, handlers) {
  root.querySelectorAll('.music-house:not([data-live])').forEach((section) => mount(section, handlers));
}

let roomCache = { key: '', res: null, canvas: null };
function room(doc, data) {
  const key = `${data.tier}|${data.color}`;
  if (roomCache.key !== key) {
    const canvas = doc.createElement('canvas');
    roomCache = { key, canvas, res: paintMusicRoom(canvas, data.tier, { color: data.color }) };
  }
  return roomCache;
}

// what the stations say while they're still being built (each gets its own screen soon)
const SOON = {
  studio: (n) => `Your recording studio is almost ready, ${n}! Soon you'll record your piano and mix it with music from the game.`,
  lab: () => 'Beep boop! The Note-o-Matic will turn your piano playing into other instruments. It\'s nearly finished!',
};

function mount(section, handlers) {
  section.dataset.live = '1';
  const data = JSON.parse(section.dataset.m);
  const doc = section.ownerDocument;
  const world = section.querySelector('.village-world');
  const buddyEl = section.querySelector('.v-buddy');
  const dialog = section.querySelector('.v-dialog');
  const { canvas, res } = room(doc, data);
  section.querySelector('.house-room').getContext('2d').drawImage(canvas, 0, 0);

  // the stations' tappable boxes and the pieces standing on the floor
  for (const el of section.querySelectorAll('.m-station')) {
    const [x, y, w, h] = res.hot[el.dataset.spot];
    el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  }
  const animated = [];
  for (const p of res.pieces) {
    const c = doc.createElement('canvas');
    c.width = p.canvas.width; c.height = p.canvas.height;
    c.getContext('2d').drawImage(p.canvas, 0, 0);
    c.className = 'h-piece';
    c.style.cssText = `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;z-index:${p.foot}`;
    world.insertBefore(c, buddyEl);
    if (p.anim) animated.push({ p, ctx: c.getContext('2d'), buf: pixelBuffer(p.w, p.h) });
  }
  // what moves: lights, flames, meters (redrawn about 12 times a second)
  const lifeCtx = section.querySelector('.m-life').getContext('2d');
  const lifeBuf = pixelBuffer(R.W, R.H);
  const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let lastLife = -1;
  const drawLife = (now) => {
    if (lastLife >= 0 && (now - lastLife < 80 || still)) return;
    lastLife = now;
    const t = now / 1000;
    lifeBuf.data.fill(0);
    res.life(lifeBuf.px, t);
    lifeBuf.put(lifeCtx);
    for (const a of animated) {
      a.buf.data.set(a.p.base);
      a.p.anim((x, y, c) => a.buf.px(x + a.p.pad, y + a.p.pad, c), t);
      a.buf.put(a.ctx);
    }
  };

  // ---- talking ----
  const closeDialog = () => { dialog.hidden = true; dialog.innerHTML = ''; section.classList.remove('talking'); };
  const say = (who, text, buttons = '<button class="btn" data-m="bye">OK!</button>') => {
    dialog.innerHTML = `<div class="v-talk"><b class="v-name">${esc(who)}</b><p class="v-text">${esc(text)}</p><div class="v-buttons">${buttons}</div></div>`;
    dialog.hidden = false;
    section.classList.add('talking');
    handlers.sound?.('talk');
  };
  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    e.stopPropagation();
    closeDialog();
  });

  // a station: the piano always works; the others have their own screens (the studio waits
  // for today's chores)
  const useStation = (id) => {
    const name = STATIONS[id]?.name || '';
    if (id === 'piano') { handlers.onPiano?.(); return; }
    if (id === 'studio' && !data.studio.open) {
      const { left = 0, waiting = 0 } = data.studio;
      const why = left ? `: ${left} to go` : waiting ? ` and checked: ${waiting} waiting for a parent` : '';
      say(name, `The studio opens once today's chores are done${why}. The piano and the sheet music are open any time!`);
      return;
    }
    const open = { sheets: handlers.onSheets, studio: handlers.onStudio, lab: handlers.onLab }[id];
    if (open) { open(); return; }
    say(name, SOON[id]?.(data.name) || '');
  };

  const mem = memory.get(data.kid) || {};
  memory.set(data.kid, mem);
  // a new look moves the furniture: start again by the door
  if (mem.tier !== data.tier) { mem.x = null; mem.tier = data.tier; }
  if (mem.entering || mem.x == null) {
    // in through the door: a step in from the doorway
    Object.assign(mem, { ...res.spots.wake, face: 1, cam: null, path: [], goal: null });
    if (mem.entering) {
      buddyEl.classList.add('coming-in');
      setTimeout(() => buddyEl.classList.remove('coming-in'), 450);
    }
    mem.entering = false;
  }

  const tags = [...section.querySelectorAll('.m-station')].map((el) => ({ el, at: res.spots[el.dataset.spot] }));
  const walker = walkRoom({
    section, W: R.W, H: R.H, mem,
    obstacles: [
      [0, 0, R.W, R.floorTop + 4], [0, 0, 7, R.H], [R.W - 7, 0, 7, R.H],
      [0, R.floorBottom - 1, R.door.x, 20], [R.door.x + R.door.w, R.floorBottom - 1, R.W, 20],
      ...res.blocks,
    ],
    talking: () => !dialog.hidden,
    onArrive: (goal) => {
      if (!goal) return;
      if (goal.use === 'door') {
        buddyEl.classList.add('going-out');
        handlers.sound?.('tap');
        setTimeout(() => handlers.onExit?.(), 380);
      } else if (goal.use) useStation(goal.use);
    },
    onTick: (me, now) => {
      for (const g of tags) g.el.classList.toggle('near', Math.hypot(me.x - g.at.x, me.y - g.at.y) < 40);
      drawLife(now);
    },
  });

  const go = (id) => {
    closeDialog();
    const spot = res.spots[id];
    walker.go(spot, { use: id, face: spot.face || (id === 'door' ? 1 : undefined) });
  };
  section.querySelector('.village-view').addEventListener('click', (e) => {
    if (e.target.closest('.v-dialog')) return;
    e.stopPropagation();
    const sp = e.target.closest('.h-spot');
    if (sp) { handlers.sound?.('tap'); go(sp.dataset.spot); return; }
    if (!dialog.hidden) { closeDialog(); return; }
    walker.floorTap(e);
  });
  drawLife(performance.now());
  // a new look: the buddy says so on the way in
  const hi = `${data.kid}|${data.tier}`;
  if (data.hello && !greeted.has(hi)) {
    greeted.add(hi);
    setTimeout(() => { if (section.isConnected && dialog.hidden) say(tierInfo(data.tier).name, data.hello); }, 500);
  }
}
