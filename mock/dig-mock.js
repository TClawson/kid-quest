// A stand-alone page to play the dino dig (js/dig.js) outside the app, for the mockup.
import { Dig } from '../js/dig.js';
import { SITES, DINOS, findInfo, skeletonProgress, boneKey, CONDITIONS, recordDig, ALL_TREASURES } from '../js/digfinds.js';
import { findPic, skeletonPic, displayPic } from '../js/digart.js';

const $ = (s) => document.querySelector(s);
const MAP_NAMES = { 'bg-meadow': 'Sunny meadow', 'bg-sunset': 'Sunset beach', 'bg-ocean': 'Under the sea', 'bg-space': 'Outer space', 'bg-castle': 'Castle', 'bg-volcano': 'Volcano island', 'bg-rainforest': 'Rainforest', 'bg-fjord': 'Alaskan Fjord', 'bg-rainbow': 'Rainbow land', 'bg-galaxy': 'Golden galaxy' };
for (const [id, n] of Object.entries(MAP_NAMES)) $('#map').insertAdjacentHTML('beforeend', `<option value="${id}">${n}</option>`);
const q = new URLSearchParams(location.search);
if (q.get('map')) $('#map').value = q.get('map');
if (q.get('tier')) $('#tier').value = q.get('tier');

// the kid's collection for the mockup (kept in this browser)
const KEY = 'digmock.v1';
let col;
try { col = JSON.parse(localStorage.getItem(KEY)) || null; } catch { col = null; }
if (!col || q.get('fresh')) col = { bones: {}, treasures: {}, dry: {}, best: 0, show: {} };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(col)); } catch { /* private mode */ } };

// sounds: little synth blips (the app has its own)
let ac = null;
const tone = (f, d = 0.08, type = 'square', v = 0.05, slide = 0) => {
  try {
    ac ||= new AudioContext();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.value = f; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), ac.currentTime + d);
    g.gain.value = v; g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch { /* no audio */ }
};
const SOUNDS = {
  dig: () => tone(140, 0.07, 'triangle', 0.08, -60),
  'clink-tok': () => tone(520, 0.09, 'triangle', 0.09),
  'clink-ting': () => { tone(1760, 0.18, 'sine', 0.07); setTimeout(() => tone(2350, 0.2, 'sine', 0.05), 60); },
  'clink-clank': () => { tone(330, 0.12, 'square', 0.06); tone(470, 0.1, 'square', 0.04); },
  find: () => { tone(660, 0.08); setTimeout(() => tone(880, 0.12), 80); },
  fanfare: () => [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => tone(f, 0.16, 'square', 0.06), k * 110)),
  big: () => tone(110, 0.4, 'sawtooth', 0.06, 60),
  heave: () => tone(200, 0.12, 'triangle', 0.08, 80),
  critter: () => tone(1200, 0.06, 'sine', 0.05, 400),
  tok: () => tone(600, 0.05, 'triangle', 0.08),
  thud: () => tone(90, 0.06, 'triangle', 0.08),
  whoosh: () => tone(300, 0.4, 'sawtooth', 0.02, -200),
  rain: () => tone(200, 0.6, 'sawtooth', 0.015, -100),
  meteor: () => tone(900, 1.1, 'sawtooth', 0.04, -800),
  over: () => [784, 659, 523].forEach((f, k) => setTimeout(() => tone(f, 0.14), k * 120)),
};

const buddy = { species: q.get('buddy') || 'fox', outfit: { hat: 'hat-cap' } };
const visitor = { species: 'panda', outfit: {} };
let game = null; let raf = 0;
const field = $('#field'); const hud = $('#hud'); const wrap = $('#wrap');
const fctx = field.getContext('2d'); const hctx = hud.getContext('2d');
let S; let W; let H; let dpr;

function layout() {
  const vw = window.innerWidth; const vh = window.innerHeight - 44;
  S = Math.max(2, Math.round(Math.min(vw, vh) / 130));
  W = Math.floor(vw / S); H = Math.min(Math.floor(vh / S), Math.round(W * 1.15));
  dpr = Math.min(3, window.devicePixelRatio || 1);
}

function start() {
  cancelAnimationFrame(raf);
  layout();
  const map = $('#map').value; const tier = Number($('#tier').value);
  game = new Dig({
    W, H, map, day: new Date().toISOString().slice(0, 10), seed: Number(q.get('seed')) || (Date.now() % 100000),
    kid: { buddy, name: 'Ava', gear: { shovel: tier } }, visitor: { buddy: visitor, name: 'Bear', gear: { shovel: 1 } },
    best: col.best, dry: col.dry[map] || 0, bones: col.bones, treasures: col.treasures, maps: Object.keys(MAP_NAMES),
    onFind: ({ key, kind, q: qq }) => { const ans = recordDig(kind === 'bone' ? col.bones : col.treasures, { key, q: qq, date: 'today' }); save(); return ans; },
    onRound: ({ key }) => { col.dry[map] = key ? 0 : (col.dry[map] || 0) + 1; if (game.score > col.best) col.best = game.score; save(); },
  });
  window.game = game;
  field.width = game.fieldW * game.Z; field.height = game.fieldH * game.Z;
  hud.width = Math.round(W * S * dpr); hud.height = Math.round(H * S * dpr);
  for (const c of [field, hud, wrap]) { c.style.width = `${W * S}px`; c.style.height = `${H * S}px`; }
  let last = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    game.step(dt);
    if (game.sound) { SOUNDS[game.sound]?.(); game.sound = null; }
    if (game.phase === 'over' && !game.overSounded) { game.overSounded = true; SOUNDS.over(); }
    if (game.phase !== 'over') game.overSounded = false;
    game.draw(fctx); game.drawHud(hctx, S * dpr);
  };
  raf = requestAnimationFrame(frame);
}

const at = (e) => { const r = field.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
$('#stage').addEventListener('pointerdown', (e) => {
  if (!game) return;
  e.preventDefault();
  const p = at(e);
  if (game.onButton(...p) && game.phase === 'play') game.press(); else if (game.onButton(...p) && game.phase !== 'over') game.press(); else game.tap(...p);
});
// taps only (no holds), but block long-press menus and text selection anyway
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && game) { e.preventDefault(); game.press(); } });
$('#go').onclick = () => { hide(); start(); };
$('#map').onchange = () => { hide(); start(); };
$('#tier').onchange = () => { hide(); start(); };
$('#reset').onclick = () => { col = { bones: {}, treasures: {}, dry: {}, best: 0, show: {} }; save(); hide(); start(); };
window.addEventListener('resize', () => start());

// ---------- the dig book ----------
const pix = (c, scale) => { const d = document.createElement('canvas'); d.width = c.width * scale; d.height = c.height * scale; const x = d.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, d.width, d.height); return d; };
const hide = () => { $('#book').style.display = 'none'; $('#house').style.display = 'none'; };
let bookTab = 'skeletons';
function book() {
  const el = $('#book'); el.style.display = 'block'; $('#house').style.display = 'none';
  el.innerHTML = `<div class="tabs"><button data-t="skeletons" class="${bookTab === 'skeletons' ? 'on' : ''}">Skeletons</button><button data-t="treasures" class="${bookTab === 'treasures' ? 'on' : ''}">Treasures</button><button id="closeBook">Back to the dig</button></div><div class="grid"></div>`;
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { bookTab = b.dataset.t; book(); }; });
  el.querySelector('#closeBook').onclick = hide;
  const grid = el.querySelector('.grid');
  if (bookTab === 'skeletons') {
    for (const d of DINOS) {
      const p = skeletonProgress(d.id, col.bones);
      const card = document.createElement('div'); card.className = `card${p.have ? '' : ' missing'}`;
      card.appendChild(pix(skeletonPic(d.id, col.bones), 2));
      card.insertAdjacentHTML('beforeend', `<div>${d.short || d.name}</div><div>${p.have}/${p.total} bones${d.common ? '' : ` · skull: ${MAP_NAMES[d.skullMap]}`}</div>`);
      card.onclick = () => dinoPage(d);
      grid.appendChild(card);
    }
  } else {
    for (const [map, s] of Object.entries(SITES)) {
      grid.insertAdjacentHTML('beforeend', `<div style="grid-column:1/-1;font-size:22px;margin-top:6px">${MAP_NAMES[map]}</div>`);
      for (const t of [...s.treasures, ...(s.special ? [s.special] : [])]) {
        const key = `${map.replace(/^bg-/, '')}-${t.id}`; const have = col.treasures[key];
        const card = document.createElement('div'); card.className = `card${have ? '' : ' missing'}`;
        const c = pix(findPic(key), 4); if (!have) c.style.filter = 'brightness(0)';
        card.appendChild(c);
        card.insertAdjacentHTML('beforeend', `<div>${have ? t.name : '???'}</div><div style="font-size:15px">${t.rarity === 'special' ? 'Super special' : t.rarity}${have ? ` · ${CONDITIONS[have.q].stars}` : ''}</div>`);
        card.onclick = () => { if (have) treasurePage(key); };
        grid.appendChild(card);
      }
    }
  }
}
function dinoPage(d) {
  const el = $('#book');
  const a = d.about;
  el.innerHTML = `<button class="back">← Dig book</button><div class="page"><h2>${d.name}</h2><div><i>Say it: ${d.say}</i>${d.notDino ? ' · <b>Not a dinosaur!</b>' : ''}</div><div class="sk"></div>
  <table class="facts"><tr><td>Name means</td><td>${a.means}</td></tr><tr><td>When</td><td>${a.when}</td></tr><tr><td>Where</td><td>${a.where}</td></tr><tr><td>Size</td><td>${a.size}</td></tr><tr><td>Ate</td><td>${a.eats}</td></tr><tr><td>Wow!</td><td>${a.wow}</td></tr>
  <tr><td>Skull</td><td>${d.common ? 'Found on every map' : `Only at ${MAP_NAMES[d.skullMap]}`}</td></tr></table><div class="bones"></div></div>`;
  el.querySelector('.back').onclick = book;
  el.querySelector('.sk').appendChild(pix(skeletonPic(d.id, col.bones), 4));
  const bones = el.querySelector('.bones');
  for (const b of d.bones) {
    const key = boneKey(d.id, b.part); const have = col.bones[key];
    const div = document.createElement('div'); div.className = `bone${have ? '' : ' no'}`;
    const c = pix(findPic(key), 3); if (!have) c.style.filter = 'brightness(0.2)';
    div.appendChild(c);
    div.insertAdjacentHTML('beforeend', `<div><b>${b.name}</b>${have ? ` ${CONDITIONS[have.q].stars}` : ''}<br>${have ? b.fact : 'Not found yet.'}</div>`);
    bones.appendChild(div);
  }
}
function treasurePage(key) {
  const el = $('#book'); const t = findInfo(key); const have = col.treasures[key];
  el.innerHTML = `<button class="back">← Dig book</button><div class="page"><h2>${t.name}</h2><div class="pic"></div><p>${t.fact}</p><p>Found ${have.n} · best ${CONDITIONS[have.q].stars} ${CONDITIONS[have.q].name} · ${MAP_NAMES[t.map]}</p><p style="font-size:14px;color:#666">Real finders tell a museum. In parks, fossils stay where they are.</p></div>`;
  el.querySelector('.back').onclick = book;
  el.querySelector('.pic').appendChild(pix(findPic(key), 8));
}
$('#bookBtn').onclick = book;

// ---------- the house: the display stand and the pedestal ----------
function house() {
  const el = $('#house'); el.style.display = 'block'; $('#book').style.display = 'none';
  const done = DINOS.filter((d) => skeletonProgress(d.id, col.bones).have === d.bones.length);
  const tre = ALL_TREASURES.filter((t) => col.treasures[t.key]);
  if (!col.show.skeleton || !done.find((d) => d.id === col.show.skeleton)) col.show.skeleton = done[0]?.id || q.get('show') || null;
  if (!col.show.pedestal || !col.treasures[col.show.pedestal]) col.show.pedestal = tre[0]?.key || null;
  el.innerHTML = `<div class="tabs"><button id="closeHouse">Back to the dig</button></div>
  <div class="page"><h2>In your house</h2><p>A finished skeleton stands on the display stand, and one treasure sits on the pedestal. Tap one to swap.</p><div class="room" style="background:#e9d8b4;padding:12px;border-radius:8px;display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap"></div>
  <p class="pick"></p></div>`;
  el.querySelector('#closeHouse').onclick = hide;
  const room = el.querySelector('.room');
  const stand = pix(displayPic('stand', col.show.skeleton), 4); stand.style.cursor = 'pointer';
  const ped = pix(displayPic('pedestal', col.show.pedestal), 4); ped.style.cursor = 'pointer';
  room.appendChild(stand); room.appendChild(ped);
  stand.onclick = () => { if (!done.length) return; const i = done.findIndex((d) => d.id === col.show.skeleton); col.show.skeleton = done[(i + 1) % done.length].id; save(); house(); };
  ped.onclick = () => { if (!tre.length) return; const i = tre.findIndex((t) => t.key === col.show.pedestal); col.show.pedestal = tre[(i + 1) % tre.length].key; save(); house(); };
  el.querySelector('.pick').textContent = `${done.length ? `Skeletons finished: ${done.map((d) => d.short || d.name).join(', ')}.` : 'No skeleton finished yet: the stand waits empty.'} ${tre.length} treasures found.`;
}
$('#houseBtn').onclick = house;

if (q.get('view') === 'book') book();
start();

// ---------- an art sheet (?view=sheet): every skeleton, find, critter and display ----------
if (q.get('view') === 'sheet') {
  const el = $('#book'); el.style.display = 'block';
  el.innerHTML = '<div class="page" style="max-width:none"><h2>Dino dig art sheet</h2><div id="s1" style="display:flex;flex-wrap:wrap;gap:10px"></div><h2>Half found</h2><div id="s2" style="display:flex;flex-wrap:wrap;gap:10px"></div><h2>Bones and treasures</h2><div id="s3" style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end"></div><h2>House</h2><div id="s4" style="display:flex;gap:20px;align-items:flex-end;background:#e9d8b4;padding:10px"></div></div>';
  for (const d of DINOS) {
    const box = document.createElement('div'); box.style.textAlign = 'center';
    box.appendChild(pix(skeletonPic(d.id, {}, true), 3)); box.insertAdjacentHTML('beforeend', `<div>${d.short || d.name}</div>`);
    $('#s1').appendChild(box);
    const half = {}; d.bones.forEach((bb, i) => { if (i % 2 === 0) half[boneKey(d.id, bb.part)] = { n: 1, q: 1 }; });
    const box2 = document.createElement('div'); box2.appendChild(pix(skeletonPic(d.id, half), 2)); $('#s2').appendChild(box2);
    for (const bb of d.bones) { const c = pix(findPic(boneKey(d.id, bb.part)), 4); c.title = bb.name; $('#s3').appendChild(c); }
  }
  for (const t of ALL_TREASURES) { const c = pix(findPic(t.key), 4); c.title = t.name; $('#s3').appendChild(c); }
  for (const id of ['critter-worm', 'critter-grub', 'critter-mole', 'critter-crab', 'critter-bolt', 'critter-twinkle']) $('#s3').appendChild(pix(findPic(id), 4));
  $('#s4').appendChild(pix(displayPic('stand', 'trex'), 3));
  $('#s4').appendChild(pix(displayPic('stand', 'stego'), 3));
  $('#s4').appendChild(pix(displayPic('stand', null), 3));
  $('#s4').appendChild(pix(displayPic('pedestal', 'volcano-diamond'), 4));
  $('#s4').appendChild(pix(displayPic('pedestal', 'galaxy-ureilite'), 4));
}
