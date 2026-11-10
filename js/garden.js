// The garden behind the buddy's house: a walkable backyard, part of the village world. It is
// built the way the house is (house.js): a painted canvas, standing things sorted with the
// buddy by where their feet are, A* walking, tap spots and a talk box. The rules are in
// gardenrules.js (what grows, droops, ripens and sells) and the pictures in gardenart.js.
//
// Tapping an empty bed or tree spot picks a seed packet, then the chore the plant stands for.
// Tapping a plant says how it is doing (and offers to keep or sell it when it is ripe). The
// back door goes into the house and the gate goes out to the village. Plants whose chore was
// done today and haven't been watered show a 💧: the buddy waters them one by one with the
// can when the kid steps in, or taps Water. Nothing here ever pulls the buddy away from
// marking a chore done: watering is a little treat, and tapping elsewhere stops it.

import * as A from './gardenart.js';
import { makeGrid, findPath } from './village.js';
import { seasonNow, tintLand, spriteFor, mountWeather } from './seasonlife.js';
import { KINDS, seedById, sellPrice, SEEDS, decorById } from './gardenrules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const Y = A.YARD;

// where the buddy stands for each thing (village pixels: the buddy's feet)
const bedStand = (i) => Y.beds[i].stand;
const treeStand = (i) => Y.trees[i].stand;
const doorStand = () => Y.doorStep;
const gateStand = () => Y.gateStep;

const rect = (x, y, w, h, extra = '') => `left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px;${extra}`;

/**
 * The garden for a kid. g: {
 *   kidId, kidName, color, buddy: live buddy markup,
 *   view: gardenrules.js gardenView(state, kid, today),
 *   thirsty: ids of plants waiting for water, tasks: [{ id, name, icon }] the chores a plant can stand for,
 *   seeds: { seedId: packets }, theme: the kid's map (some maps put the garden in a dome), today,
 * }
 */
export function gardenHtml(g) {
  const lay = Object.fromEntries(Object.entries(g.view.layout || {}).map(([k, v]) => [k, v?.id || null]));
  const data = { kid: g.kidId, name: g.kidName, color: g.color, view: { ...g.view, layout: lay }, thirsty: g.thirsty, tasks: g.tasks, seeds: g.seeds, theme: g.theme, today: g.today };
  const plots = (list, where) => list.map((p, i) => {
    const b = where === 'beds' ? Y.beds[i] : null;
    const t = where === 'trees' ? Y.trees[i] : null;
    const box = b ? [b.x - 2, b.y - 18, b.w + 4, b.h + 20] : [t.x - 16, t.y - 44, 32, 50];
    const label = p ? `${p.seed.name}${p.task ? `, for ${p.task.name}` : ''}` : where === 'trees' ? 'Empty tree spot' : 'Empty garden bed';
    return `<button class="h-spot g-spot" data-where="${where}" data-i="${i}" style="${rect(...box)}" aria-label="${esc(label)}"></button>`;
  }).join('');
  const n = g.thirsty.length;
  return `
    <section class="garden" data-kid="${esc(g.kidId)}" data-g="${esc(JSON.stringify(data))}">
      <div class="village-view garden-view">
        <div class="village-world" style="width:${Y.W}px;height:${Y.H}px">
          <canvas class="garden-yard" width="${Y.W}" height="${Y.H}" aria-hidden="true"></canvas>
          ${plots(g.view.beds, 'beds')}${plots(g.view.trees, 'trees')}
          <button class="h-spot g-door" data-go="door" style="${rect(Y.door.x, Y.door.y, Y.door.w, Y.door.h)}" aria-label="Back door, into the house"><span class="h-tag out g-tag">⬆ House</span></button>
          <button class="h-spot g-gate" data-go="gate" style="${rect(Y.gate.x, Y.gate.y, Y.gate.w, Y.gate.h)}" aria-label="Garden gate, out to the village"><span class="h-tag out g-tag">⬇ Village</span></button>
          <div class="v-buddy" style="z-index:100"><div class="v-flip">${g.buddy}</div><span class="g-can" hidden></span></div>
          <span class="v-target" hidden></span>
        </div>
        <div class="h-sign">🌱 ${esc(g.kidName)}'s garden</div>
        <button class="g-water" data-water ${n ? '' : 'hidden'}>💧 Water${n ? ` (${n})` : ''}</button>
        <div class="v-dialog" hidden></div>
      </div>
    </section>`;
}

// Per kid, while the app is open: where the buddy stands in the garden, and a line to say.
const memory = new Map();

/** The buddy just came in: through the back door of the house, or through the gate from the village. */
export function cameInGarden(kidId, from) {
  const at = from === 'house' ? doorStand() : gateStand();
  memory.set(kidId, { x: at.x, y: at.y, face: 1, cam: null, entering: true });
}

/** A line for the buddy to say as soon as the garden is drawn again (after planting, picking, ...). */
export function gardenSay(kidId, text) {
  const mem = memory.get(kidId) || {};
  mem.say = text;
  memory.set(kidId, mem);
}

export function mountGardens(root, handlers) {
  root.querySelectorAll('.garden:not([data-live])').forEach((section) => mount(section, handlers));
}

// ---------- pictures ----------

/** The canvas of a piece of art, and where its feet are (x across, y down) within it. */
function pic(art) {
  if (!art) return null;
  const c = art.getContext ? art : art.canvas;
  if (!c) return null;
  return { c, fx: art.fx ?? art.ax ?? c.width / 2, fy: art.fy ?? art.ay ?? c.height };
}
function paste(doc, art, className = 'h-piece', se = null) {
  const p = pic(art && se && art.getContext ? spriteFor(art, se, 'garden') : art);
  if (!p) return null;
  const c = doc.createElement('canvas');
  c.width = p.c.width; c.height = p.c.height;
  c.getContext('2d').drawImage(p.c, 0, 0);
  c.className = className;
  c.style.width = `${c.width}px`; c.style.height = `${c.height}px`;
  return { el: c, fx: p.fx, fy: p.fy, src: p.c };
}
const dataUrls = new Map();
const seedUrl = (doc, id) => {
  if (!dataUrls.has(id)) { let u = ''; try { u = A.seedThumb(doc, id)?.toDataURL() || ''; } catch { u = ''; } dataUrls.set(id, u); }
  return dataUrls.get(id);
};

let yardCache = { key: '', canvas: null, res: null };
/** The painted yard for these decorations (kept while they and the door's color stay the same). */
function yard(doc, layout, color) {
  const key = JSON.stringify([layout, color]);
  if (yardCache.key !== key) {
    const canvas = doc.createElement('canvas');
    const res = A.paintYard(canvas, { layout: Object.fromEntries(Object.entries(layout).map(([k, id]) => [k, id ? decorById(id) : null])), color });
    yardCache = { key, canvas, res };
  }
  return yardCache;
}

// ---------- the words ----------

const kindWord = { flower: 'flowers', veg: 'veggies', tree: 'tree' };
function growingLine(info, name) {
  const left = info.days - info.grown;
  const days = info.kind === 'tree' ? `${info.done} ${info.done === 1 ? 'day' : 'days'} so far` : `${info.grown} of ${info.days} days`;
  const praise = [
    `You did “${name}” ${info.done} ${info.done === 1 ? 'time' : 'times'}, and look how it's growing!`,
    `Every “${name}” gives it a little more. Look how tall it's getting!`,
    `${info.done} ${info.done === 1 ? 'day' : 'days'} of “${name}”! You take good care of it.`,
  ][info.done % 3];
  return `${info.seed.name}: ${days}. ${praise}${info.kind === 'tree' ? '' : left > 0 ? ` Just ${left} more to go.` : ''}`;
}

// ---------- the live garden ----------

function mount(section, handlers) {
  section.dataset.live = '1';
  const data = JSON.parse(section.dataset.g);
  const doc = section.ownerDocument;
  const view = section.querySelector('.village-view');
  const world = section.querySelector('.village-world');
  const buddyEl = section.querySelector('.v-buddy');
  const flip = section.querySelector('.v-flip');
  const canEl = section.querySelector('.g-can');
  const dialog = section.querySelector('.v-dialog');
  const targetEl = section.querySelector('.v-target');
  const waterBtn = section.querySelector('.g-water');
  const V = data.view;
  const plots = { beds: V.beds, trees: V.trees };
  const { canvas: yardCanvas, res: yardRes } = yard(doc, V.layout, data.color);
  const se = seasonNow(data.today); // the parent's try-out counts, like in the villages
  section.querySelector('.garden-yard').getContext('2d').drawImage(tintLand(yardCanvas, se, 'garden'), 0, 0);
  const decorObjs = Object.fromEntries(Object.entries(V.layout).map(([k, id]) => [k, id ? decorById(id) : null]));

  // ---- things standing in the garden, sorted with the buddy by their feet ----
  const stand = (el, x, y, z, fx, fy) => {
    el.style.left = `${Math.round(x - fx)}px`; el.style.top = `${Math.round(y - fy)}px`; el.style.zIndex = Math.round(z);
    world.insertBefore(el, buddyEl);
  };
  // the pieces the yard itself draws standing up (the arch over the gate)
  for (const pc of yardRes?.pieces || []) {
    const c = doc.createElement('canvas');
    c.width = pc.canvas.width; c.height = pc.canvas.height;
    c.getContext('2d').drawImage(spriteFor(pc.canvas, se, 'garden'), 0, 0);
    c.className = 'h-piece';
    c.style.cssText = `left:${pc.x}px;top:${pc.y}px;width:${pc.w}px;height:${pc.h}px;z-index:${pc.foot}`;
    world.insertBefore(c, buddyEl);
  }
  for (const spot of ['water', 'bees', 'seat']) {
    const id = V.layout[spot];
    const sp = Y.spots[spot];
    // the pond is painted flat into the yard
    if (!id || !sp || decorById(id)?.art === 'pond') continue;
    const p = paste(doc, A.decorArt(id), 'h-piece', se);
    if (!p) continue;
    p.el.dataset.piece = spot;
    stand(p.el, sp.x, sp.y, sp.y, p.fx, p.fy);
  }
  // the watering can waits on its spot until the buddy picks it up
  const waitingCan = V.layout.can && A.canArt ? paste(doc, A.canArt(V.layout.can, 0), 'h-piece', se) : null;
  if (waitingCan) { waitingCan.el.dataset.piece = 'can'; stand(waitingCan.el, Y.spots.can.x, Y.spots.can.y, Y.spots.can.y, waitingCan.fx, waitingCan.fy); }
  const plantEls = new Map(); // plot id -> { wrap, badge, x, y }
  const place = (list, where) => list.forEach((info, i) => {
    if (!info) return;
    const at = where === 'beds' ? Y.beds[i].foot : Y.trees[i];
    const p = paste(doc, A.plantArt(info.seed.id, info.stage, { droopy: info.droopy, fruit: info.fruit }), 'g-art', se);
    if (!p) return;
    const wrap = doc.createElement('div');
    wrap.className = `g-plant ${info.droopy ? 'droopy' : ''}`;
    wrap.dataset.id = info.id;
    wrap.style.cssText = `width:${p.el.width}px;height:${p.el.height}px;transform-origin:${p.fx}px ${p.fy}px`;
    wrap.append(p.el);
    let badge = null;
    if (data.thirsty.includes(info.id)) {
      badge = doc.createElement('span');
      badge.className = 'g-thirst';
      badge.textContent = '💧';
      badge.style.left = `${p.fx}px`;
      wrap.append(badge);
    }
    stand(wrap, at.x, at.y, at.y + 1, p.fx, p.fy);
    plantEls.set(info.id, { wrap, badge });
  });
  place(V.beds, 'beds');
  place(V.trees, 'trees');

  // ---- critters: butterflies near the blooms, bees at the bee house, a bird at the water ----
  const critters = [];
  const blooms = [...V.beds, ...V.trees].map((p, i) => (p && p.stage >= 2 && !p.droopy ? i : -1)).filter((i) => i >= 0);
  const spawn = (frames, mk, fn) => {
    const el = doc.createElement('div');
    el.className = 'g-critter';
    const cs = frames.map((f) => paste(doc, mk(f), 'g-cf'));
    if (cs.some((c) => !c)) return;
    cs.forEach((c, i) => { c.el.hidden = i > 0; el.append(c.el); });
    el.style.width = `${cs[0].el.width}px`; el.style.height = `${cs[0].el.height}px`;
    world.insertBefore(el, buddyEl);
    el.style.transformOrigin = `${cs[0].fx}px ${cs[0].fy}px`;
    critters.push({ el, cs, fn, shown: 0 });
  };
  for (let i = 0; i < V.critters.butterflies; i += 1) {
    const idx = blooms.length ? blooms[i % blooms.length] : 0;
    const b = idx < V.beds.length ? Y.beds[idx] : null;
    const cx = b ? b.x + b.w / 2 : (Y.trees[idx - V.beds.length]?.x ?? 160);
    const cy = b ? b.y + b.h / 2 - 8 : (Y.trees[idx - V.beds.length]?.y ?? 80) - 24;
    const hue = [330, 45, 205][i % 3];
    spawn([0, 1, 2], (f) => A.butterflyArt(f, hue), (t) => {
      const u = t * 0.6 + i * 2.1;
      return { x: cx + Math.sin(u) * 22 + Math.sin(u * 2.3) * 5, y: cy + Math.sin(u * 1.4) * 9, z: 900, frame: [0, 1, 2, 1][Math.floor(t * 6 + i) % 4] };
    });
  }
  if (V.critters.bees && Y.spots.bees) {
    const s = Y.spots.bees;
    for (let i = 0; i < V.critters.bees; i += 1) {
      spawn([0, 1], (f) => A.beeArt(f), (t) => {
        const u = t * 1.7 + i * 3.1;
        return { x: s.x + Math.sin(u) * 14 + Math.sin(u * 2.7) * 3, y: s.y - 14 + Math.sin(u * 2) * 7, z: 900, frame: Math.floor(t * 12 + i) % 2, dir: Math.cos(u) + Math.cos(u * 2.7) * 0.5 >= 0 ? 1 : -1 };
      });
    }
  }
  if (V.critters.bird && Y.spots.water) {
    const s = Y.spots.water;
    spawn([0, 1], (f) => A.birdArt(f), (t) => ({ x: s.x + 5, y: s.y - 12, z: s.y + 2, frame: Math.floor(t / 1.3) % 4 === 0 ? 1 : 0 }));
  }

  // the dome some maps put over the garden: the topmost layer, taps go through it
  const shield = A.SHIELDS?.[data.theme];
  if (shield && A.shieldArt) {
    const p = paste(doc, A.shieldArt(shield, data.theme, doc), 'g-shield');
    if (p) { p.el.style.cssText += ';left:0;top:0;z-index:9999'; world.append(p.el); }
  }
  // the season's weather above the yard (and the dome); under a dome the weather stays inside it
  mountWeather(world, { season: se, mapId: shield ? 'garden-dome' : 'garden', W: Y.W, H: Y.H, z: 10000 });

  // ---- where the buddy can walk ----
  const L = {
    W: Y.W, H: Y.H, chest: { x: -100, y: -100 },
    onBridge: () => false, inWater: () => false,
    obstacles: A.yardBlocks(decorObjs),
  };
  const grid = makeGrid(L);

  const mem = memory.get(data.kid) || { ...gateStand(), face: 1, cam: null };
  memory.set(data.kid, mem);
  const me = { x: mem.x, y: mem.y, path: mem.path || [], goal: mem.goal || null, face: mem.face || 1 };
  if (me.path.length) buddyEl.classList.add('walking');
  let S = 3; let vw = 0; let vh = 0;
  const measure = () => { vw = view.clientWidth; vh = view.clientHeight; S = vw >= 600 ? 3 : 2; };
  const camTarget = () => ({
    x: Y.W * S <= vw ? -(vw / S - Y.W) / 2 : Math.max(0, Math.min(Y.W - vw / S, me.x - vw / S / 2)),
    y: Y.H * S <= vh ? -(vh / S - Y.H) / 2 : Math.max(0, Math.min(Y.H - vh / S, me.y - 12 - (vh / S) * (dialog.hidden ? 0.5 : 0.3))),
  });
  measure();
  let cam = mem.cam && mem.S === S ? { ...mem.cam } : camTarget();
  const placeAll = () => {
    world.style.transform = `translate(${Math.round(-cam.x * S)}px, ${Math.round(-cam.y * S)}px) scale(${S})`;
    buddyEl.style.left = `${me.x}px`;
    buddyEl.style.top = `${me.y}px`;
    buddyEl.style.zIndex = Math.round(me.y);
    flip.style.transform = me.face < 0 ? 'scaleX(-1)' : '';
  };
  const justIn = Boolean(mem.entering);
  if (mem.entering) {
    mem.entering = false;
    buddyEl.classList.add('coming-in');
    setTimeout(() => buddyEl.classList.remove('coming-in'), 450);
  }

  // ---- talking ----
  const closeDialog = () => { dialog.hidden = true; dialog.innerHTML = ''; section.classList.remove('talking'); };
  const say = (text, body, buttons) => {
    dialog.innerHTML = `<div class="v-talk"><b class="v-name">${esc(data.name)}'s garden</b><p class="v-text">${esc(text)}</p>${body || ''}<div class="v-buttons">${buttons || '<button class="btn" data-g="bye">OK!</button>'}</div></div>`;
    dialog.hidden = false;
    section.classList.add('talking');
    handlers.sound?.('talk');
  };
  const btn = (act, label, extra = '', cls = '') => `<button class="btn ${cls}" data-g="${act}" ${extra}>${label}</button>`;
  const bye = (label = 'OK!') => btn('bye', label, '', 'ghost');
  const refreshWith = (text) => { if (text) { mem.say = text; } closeDialog(); handlers.refresh?.(); };

  const infoAt = (where, i) => plots[where][i];
  const fits = (where) => SEEDS.filter((s) => (where === 'trees') === (s.kind === 'tree') && (data.seeds[s.id] || 0) > 0);

  const seedPicker = (where, i) => {
    const list = fits(where);
    if (!list.length) {
      say(where === 'trees' ? 'This is a good spot for a fruit tree, but you have no tree seeds yet. Want to look in the shop?' : 'This bed is empty, and you have no seed packets yet. Want to look in the shop?',
        '', `${btn('shop', '🛒 Open the shop')}${bye('Not now')}`);
      return;
    }
    const body = `<div class="g-picks">${list.map((s) => `<button class="g-pick" data-g="seed" data-id="${s.id}" data-where="${where}" data-i="${i}"><img src="${seedUrl(doc, s.id)}" alt=""><b>${esc(s.name)}</b><small>${data.seeds[s.id]} ${data.seeds[s.id] === 1 ? 'packet' : 'packets'} · ${KINDS[s.kind].days} days</small></button>`).join('')}</div>`;
    say(where === 'trees' ? 'Which tree shall we plant?' : 'What shall we plant here?', body, bye('Not now'));
  };
  const chorePicker = (where, i, seedId, relinkMode = false) => {
    const seed = seedById(seedId);
    if (!data.tasks.length) { say('Ask a grown-up to add some chores first. Plants grow when you do a chore.'); return; }
    const body = `<div class="g-picks tasks">${data.tasks.map((t) => `<button class="g-pick" data-g="${relinkMode ? 'relink' : 'task'}" data-id="${esc(t.id)}" data-seed="${seedId || ''}" data-where="${where}" data-i="${i}"><span class="g-pick-icon">${esc(t.icon)}</span><b>${esc(t.name)}</b></button>`).join('')}</div>`;
    say(relinkMode ? 'Which chore should this plant grow with now?' : `Which chore will your ${seed.name.toLowerCase()} grow with? It grows a bit every day you do it.`, body, bye('Not now'));
  };

  const plantTalk = (where, i) => {
    const info = infoAt(where, i);
    if (!info) { seedPicker(where, i); return; }
    const name = info.task?.name || '';
    if (!info.task) {
      say(`Oh, the chore this ${info.seed.name.toLowerCase()} was growing with is gone. Pick another chore for it, or dig it up.`, '',
        `${btn('relinkpick', '🔗 Pick a chore', `data-where="${where}" data-i="${i}"`)}${btn('dig', '⛏ Dig it up', `data-where="${where}" data-i="${i}"`, 'ghost')}${bye('Not now')}`);
      return;
    }
    if (info.kind === 'tree') {
      if (info.ripe) {
        say(`What a lovely ${info.seed.name.toLowerCase()}! It grew because you did “${name}” again and again. Its fruit goes in the fruit bowl in your house.`);
        return;
      }
    } else if (info.ripe) {
      const price = sellPrice(info);
      const keep = info.kind === 'flower' ? 'brighten your table for a week' : 'stay in your kitchen for two weeks';
      say(`Your ${info.seed.name.toLowerCase()} ${/s$/.test(info.seed.name) ? 'are' : 'is'} all grown! That's “${name}” ${info.done} ${info.done === 1 ? 'time' : 'times'}. You can keep ${/s$/.test(info.seed.name) ? 'them' : 'it'}, or sell ${/s$/.test(info.seed.name) ? 'them' : 'it'}.`,
        `<p class="g-hint">Ones you keep ${keep}.</p>`,
        `${btn('keep', info.kind === 'flower' ? '🏺 Keep' : '🧺 Keep', `data-i="${i}"`)}${btn('sell', `🪙 Sell for ${price} ${price === 1 ? 'coin' : 'coins'}`, `data-i="${i}"`)}${bye('Not yet')}`);
      return;
    }
    let text;
    if (info.droopy) text = `It missed you yesterday. Do “${name}” today and it'll perk up!`;
    else text = growingLine(info, name);
    say(text, '', `${bye()}${btn('dig', '⛏ Dig it up', `data-where="${where}" data-i="${i}"`, 'ghost')}`);
  };

  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    e.stopPropagation();
    const act = b.dataset.g;
    const where = b.dataset.where; const i = Number(b.dataset.i);
    if (act === 'bye') closeDialog();
    else if (act === 'shop') { closeDialog(); handlers.onShop?.(); } else if (act === 'seed') chorePicker(where, i, b.dataset.id);
    else if (act === 'task') {
      const seed = seedById(b.dataset.seed);
      const task = data.tasks.find((t) => t.id === b.dataset.id);
      const err = handlers.onPlant(where, i, seed.id, task.id);
      if (err) say(err);
      else refreshWith(`Planted! Your ${seed.name.toLowerCase()} will grow a bit every day you do “${task.name}”.`);
    } else if (act === 'relinkpick') chorePicker(where, i, '', true);
    else if (act === 'relink') { handlers.onRelink(where, i, b.dataset.id); refreshWith('All set! It will grow with that chore now.'); } else if (act === 'dig') {
      const info = infoAt(where, i);
      say(`Dig up the ${info ? info.seed.name.toLowerCase() : 'plant'}? You won't get your coins back.`, '',
        `${btn('dig2', 'Yes, dig it up', `data-where="${where}" data-i="${i}"`)}${btn('bye', 'No, keep it', '', 'ghost')}`);
    } else if (act === 'dig2') { handlers.onDig(where, i); refreshWith('The spot is ready for something new.'); } else if (act === 'keep' || act === 'sell') {
      const info = infoAt('beds', i);
      const price = info ? sellPrice(info) : 0;
      const r = handlers.onHarvest(i, act);
      if (typeof r === 'string') { say(r); return; }
      if (act === 'keep') refreshWith(info?.kind === 'veg' ? 'They will be in your kitchen for two weeks!' : 'These will brighten your table for a week!');
      else refreshWith(`Sold for ${r.coins || price} ${(r.coins || price) === 1 ? 'coin' : 'coins'}! You took such good care of them.`);
    }
  });

  // ---- watering ----
  let water = null; // { queue: [plant ids], id, t (seconds into the pour, or -1 while walking) }
  const noteEl = doc.createElement('div');
  noteEl.className = 'g-note'; noteEl.hidden = true;
  view.append(noteEl);
  let noteTimer = 0;
  const note = (text) => { noteEl.textContent = text; noteEl.hidden = false; clearTimeout(noteTimer); noteTimer = setTimeout(() => { noteEl.hidden = true; }, 2600); };
  const canId = V.layout.can;
  // the can in the buddy's paw, in 4 tilts (upright .. pouring), each hung by its handle; the spray comes off the rose
  const canArts = canId && A.canArt ? [0, 1, 2, 3].map((k) => paste(doc, A.canArt(canId, k / 3), 'g-cf')) : [];
  canArts.forEach((c, k) => { if (c) { c.el.style.left = `${-(c.src.hx ?? c.fx)}px`; c.el.style.top = `${-(c.src.hy ?? c.fy)}px`; c.el.hidden = k > 0; canEl.append(c.el); } });
  const full = canArts[canArts.length - 1];
  const spray = full && A.waterDrops ? [0, 1, 2].map((f) => paste(doc, A.waterDrops(f), 'g-cf')).filter(Boolean) : [];
  spray.forEach((d, f) => { d.el.style.left = `${(full.src.sx ?? 10) - (full.src.hx ?? 0) - d.fx}px`; d.el.style.top = `${(full.src.sy ?? 0) - (full.src.hy ?? 0) - d.fy}px`; d.el.hidden = true; canEl.append(d.el); });
  const setCan = (on) => { canEl.hidden = !on; if (waitingCan) waitingCan.el.hidden = on; };
  const plotOf = (id) => {
    for (const where of ['beds', 'trees']) { const i = plots[where].findIndex((p) => p && p.id === id); if (i >= 0) return { where, i }; }
    return null;
  };
  const standFor = (id) => { const p = plotOf(id); return p.where === 'beds' ? bedStand(p.i) : treeStand(p.i); };
  const stopWater = () => {
    water = null;
    setCan(false);
    section.querySelectorAll('.g-droplet').forEach((d) => d.remove());
  };
  const nextWater = () => {
    if (!water) return;
    const id = water.queue.shift();
    if (!id) { stopWater(); note('Ahh, that feels good! Everything is watered.'); return; }
    water.id = id; water.t = -1;
    const at = standFor(id);
    const p = plotOf(id);
    const px = p.where === 'beds' ? Y.beds[p.i].x + Y.beds[p.i].w / 2 : Y.trees[p.i].x;
    walkTo(at.x, at.y, { water: id, face: at.face || (px >= at.x ? 1 : -1) });
  };
  const startWater = (ids) => {
    const list = ids.filter((id) => plotOf(id) && plantEls.get(id)?.badge);
    if (!list.length || water) return;
    // nearest first, so the buddy doesn't zig-zag
    list.sort((a, b) => { const sa = standFor(a); const sb = standFor(b); return Math.hypot(sa.x - me.x, sa.y - me.y) - Math.hypot(sb.x - me.x, sb.y - me.y); });
    closeDialog();
    water = { queue: list, id: null, t: -1 };
    setCan(canArts.length > 0);
    nextWater();
  };
  waterBtn.addEventListener('click', (e) => { e.stopPropagation(); handlers.sound?.('tap'); startWater(data.thirsty); });
  const pourStep = (dt) => {
    if (!water || water.t < 0) return;
    const POUR = 0.6;
    const before = water.t;
    water.t += dt;
    const k = Math.min(1, water.t / POUR);
    const tilt = k < 0.25 ? k / 0.25 : k > 0.85 ? (1 - k) / 0.15 : 1;
    canArts.forEach((c, n) => { if (c) c.el.hidden = n !== Math.round(tilt * (canArts.length - 1)); });
    spray.forEach((d, f) => { d.el.hidden = !(tilt > 0.6 && f === Math.floor(water.t * 10) % spray.length); });
    if (before === 0 || (before < 0.15 && water.t >= 0.15)) {
      const p = plotOf(water.id);
      const tx = p.where === 'beds' ? Y.beds[p.i].x + Y.beds[p.i].w / 2 : Y.trees[p.i].x;
      const ty = p.where === 'beds' ? Y.beds[p.i].y + Y.beds[p.i].h / 2 : Y.trees[p.i].y - 4;
      for (let n = 0; n < 6; n += 1) {
        const d = doc.createElement('i');
        d.className = 'g-droplet';
        d.style.cssText = `left:${tx + (n - 2.5) * 2.5}px;top:${ty - 12}px;animation-delay:${n * 0.06}s;z-index:998`;
        world.insertBefore(d, buddyEl);
        setTimeout(() => d.remove(), 900);
      }
    }
    if (water.t >= POUR) {
      const id = water.id;
      const rec = plantEls.get(id);
      rec?.wrap.classList.remove('bounce'); void rec?.wrap.offsetWidth; rec?.wrap.classList.add('bounce');
      rec?.badge?.remove();
      handlers.onWatered?.([id]);
      data.thirsty = data.thirsty.filter((x) => x !== id);
      waterBtn.hidden = !data.thirsty.length;
      waterBtn.textContent = `💧 Water (${data.thirsty.length})`;
      canArts.forEach((c, n) => { if (c) c.el.hidden = n > 0; });
      spray.forEach((d) => { d.el.hidden = true; });
      water.t = -1;
      handlers.sound?.('tap');
      setTimeout(nextWater, 300);
    }
  };

  // ---- walking ----
  const arrive = () => {
    const goal = me.goal;
    me.goal = null;
    buddyEl.classList.remove('walking');
    targetEl.hidden = true;
    if (!goal) return;
    if (goal.face) me.face = goal.face;
    if (goal.water) { if (water && water.id === goal.water) water.t = 0; return; }
    if (goal.go === 'door') {
      buddyEl.classList.add('going-out');
      handlers.sound?.('tap');
      setTimeout(() => handlers.onHouse?.(), 380);
    } else if (goal.go === 'gate') {
      buddyEl.classList.add('going-out');
      handlers.sound?.('tap');
      setTimeout(() => handlers.onVillage?.(), 380);
    } else if (goal.where) {
      const p = plots[goal.where][goal.i];
      const tx = goal.where === 'beds' ? Y.beds[goal.i].x + Y.beds[goal.i].w / 2 : Y.trees[goal.i].x;
      me.face = tx >= me.x ? 1 : -1;
      if (p) plantTalk(goal.where, goal.i); else seedPicker(goal.where, goal.i);
    }
  };
  function walkTo(x, y, goal = null) {
    closeDialog();
    me.path = findPath(grid, me, { x, y });
    me.goal = goal;
    if (!me.path.length) { arrive(); return; }
    buddyEl.classList.add('walking');
  }
  const goTo = (at, goal) => {
    if (Math.hypot(me.x - at.x, me.y - at.y) < 6) { me.goal = goal; arrive(); return; }
    walkTo(at.x, at.y, goal);
  };

  view.addEventListener('click', (e) => {
    if (e.target.closest('.v-dialog') || e.target.closest('.g-water')) return;
    e.stopPropagation();
    if (water) stopWater(); // a tap anywhere stops the watering; what is left stays thirsty
    const go = e.target.closest('[data-go]');
    if (go) { handlers.sound?.('tap'); goTo(go.dataset.go === 'door' ? doorStand() : gateStand(), { go: go.dataset.go }); return; }
    const sp = e.target.closest('.g-spot');
    if (sp) {
      handlers.sound?.('tap');
      const where = sp.dataset.where; const i = Number(sp.dataset.i);
      goTo(where === 'beds' ? bedStand(i) : treeStand(i), { where, i });
      return;
    }
    if (!dialog.hidden) { closeDialog(); return; }
    const r = view.getBoundingClientRect();
    const x = (e.clientX - r.left) / S + cam.x;
    const y = (e.clientY - r.top) / S + cam.y;
    targetEl.style.left = `${x}px`; targetEl.style.top = `${y}px`;
    targetEl.hidden = false;
    targetEl.classList.remove('pop'); void targetEl.offsetWidth; targetEl.classList.add('pop');
    walkTo(x, y);
  });

  let last = performance.now();
  const tick = (now) => {
    if (!section.isConnected) { window.removeEventListener('resize', onResize); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (me.path.length) {
      let step = 90 * dt;
      while (step > 0 && me.path.length) {
        const t = me.path[0];
        const dx = t.x - me.x; const dy = t.y - me.y; const d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) me.face = dx > 0 ? 1 : -1;
        if (d <= step) { me.x = t.x; me.y = t.y; me.path.shift(); step -= d; } else { me.x += (dx / d) * step; me.y += (dy / d) * step; step = 0; }
      }
      if (!me.path.length) arrive();
    }
    pourStep(dt);
    if (water) {
      // the can is held out in front of the buddy and tips over the plant
      canEl.style.left = `${12 + me.face * 7}px`;
      canEl.style.transform = `scaleX(${me.face})`;
    }
    const t = camTarget();
    const k = Math.min(1, dt * 5);
    cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k;
    Object.assign(mem, { x: me.x, y: me.y, face: me.face, cam, S, path: me.path, goal: me.goal });
    const sec = now / 1000;
    for (const c of critters) {
      const o = c.fn(sec);
      c.el.style.transform = `translate(${(o.x - c.cs[0].fx).toFixed(1)}px, ${(o.y - c.cs[0].fy).toFixed(1)}px)${o.dir < 0 ? ' scaleX(-1)' : ''}`;
      c.el.style.zIndex = Math.round(o.z);
      const f = o.frame % c.cs.length;
      if (f !== c.shown) { c.cs[c.shown].el.hidden = true; c.cs[f].el.hidden = false; c.shown = f; }
    }
    placeAll();
    requestAnimationFrame(tick);
  };
  const onResize = () => { if (section.isConnected) measure(); else window.removeEventListener('resize', onResize); };
  window.addEventListener('resize', onResize, { passive: true });
  placeAll();
  requestAnimationFrame(tick);

  // a line waiting from the last thing done (planted, picked, ...)
  if (mem.say) { const text = mem.say; mem.say = ''; say(text); }
  // stepping into the garden with thirsty plants: the buddy gets the can out
  if (justIn && data.thirsty.length && dialog.hidden) setTimeout(() => { if (section.isConnected) startWater(data.thirsty); }, 700);
}
