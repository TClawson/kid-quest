// Live buddies: <canvas> buddies drawn by rig.js, 12 poses a second, with feelings
// the app sets (see feelFor in app.js) and reactions to taps.
//
// A buddy has a key (like "kid:abc"): every canvas with that key shows the same
// brain, so the kid screen and the map walker move as one buddy, and its feelings
// carry over when the page redraws.
//
// Taps: on the head = a pat (happy eyes, hearts). Lots of quick taps = dizzy and
// giggly. The eyes follow a finger. The app decides what a tap on the body does
// (a sports move or a giggle): the canvas's data-zone says where the tap landed.
// Left alone (when the app asks for it), a buddy gets bored, then dozes off; a tap
// wakes it with a jump.
import { buildRig, render, Brain, CALM } from './rig.js';

const FPS = 12;
const BORED_AFTER = 45_000;
const DOZE_AFTER = 120_000;

const buddies = new Map(); // key -> state
const looks = new Map(); // key -> buddy look
const rigs = new Map(); // look + background -> rig
const rgb = new Map();
let timer = 0;
let seed = 1;
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function stateOf(key) {
  let st = buddies.get(key);
  if (!st) {
    st = { brain: new Brain(seed++), base: { ...CALM }, idle: false, touched: performance.now(), dozing: false, beat: null, lookAt: null, lookUntil: 0, taps: [], pose: null, frame: -1, notes: false, fresh: true };
    buddies.set(key, st);
  }
  return st;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The markup for a live buddy, and what it should feel right now.
 * opts: { background: bool, feel: targets for rig.js feelings, idle: bool (bored when left alone), label }
 */
export function liveHtml(key, buddy, opts = {}) {
  looks.set(key, buddy);
  const st = stateOf(key);
  if (opts.feel) feel(key, opts.feel, { idle: opts.idle });
  // the look is in the markup too, so a changed outfit (say, synced from another device) changes the page
  const look = [buddy?.species, ...Object.values(buddy?.outfit || {})].filter(Boolean).join(' ');
  return `<canvas class="live-buddy" width="24" height="24" data-live="${esc(key)}" data-look="${esc(look)}" data-bg="${opts.background === false ? 0 : 1}" role="img" aria-label="${esc(opts.label || `${buddy?.species || 'buddy'} buddy`)}"></canvas>`;
}

/** Sets where a buddy's feelings are heading. opts.idle: gets bored when nobody taps it. */
export function feel(key, targets, opts = {}) {
  const st = stateOf(key);
  st.base = { ...CALM, ...targets };
  if (opts.idle != null) st.idle = opts.idle;
  st.notes = Boolean(targets.notes);
  applyFeel(st, performance.now());
  if (st.fresh) { st.brain.settle(); st.fresh = false; }
}

function applyFeel(st, now) {
  const quiet = now - st.touched;
  let extra = {};
  if (st.idle && quiet > DOZE_AFTER) extra = { sleep: 1, arousal: 0.1, valence: 0.1 };
  else if (st.idle && quiet > BORED_AFTER) extra = { valence: Math.min(st.base.valence, -0.15), arousal: 0.2, sleep: 0.35 };
  st.dozing = Boolean(extra.sleep);
  const { notes, ...base } = st.base;
  st.brain.set({ ...base, ...extra });
}

/** Reactions the app can trigger on a buddy by key. */
export function live(key) {
  const st = stateOf(key);
  const b = st.brain;
  return {
    cheer: () => b.impulse('cheer', 1),
    surprise: () => b.impulse('surprise', 1),
    giggle: () => b.impulse('giggle', 1),
    pat: () => b.impulse('pat', 1),
    kick: () => b.impulse('kick', 1),
    hop: () => b.impulse('hop', 1),
    /** A beat just happened; p is the time to the next one, in ms. */
    beat: (p) => {
      const now = performance.now();
      st.beat = { at: now, period: Math.max(250, p), index: (st.beat?.index ?? -1) + 1 };
    },
    noBeat: () => { st.beat = null; },
    touch: () => wake(st, performance.now()),
  };
}

function wake(st, now) {
  if (st.dozing) st.brain.impulse('surprise', 1);
  st.touched = now;
  applyFeel(st, now);
}

function beatNow(st, now) {
  const b = st.beat;
  if (!b) return null;
  const phase = (now - b.at) / b.period;
  if (phase > 1.6) { st.beat = null; return null; }
  return { index: b.index + Math.floor(phase), phase: phase % 1 };
}

function rigFor(key, bg) {
  const look = looks.get(key);
  const id = JSON.stringify([look?.species, look?.outfit, bg]);
  let rig = rigs.get(id);
  if (!rig) {
    rig = buildRig(look, { background: bg });
    if (rigs.size > 40) rigs.clear();
    rigs.set(id, rig);
  }
  return rig;
}

function paint(canvas, buf) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(24, 24);
  for (let i = 0; i < buf.length; i += 1) {
    const c = buf[i];
    if (!c) continue;
    let v = rgb.get(c);
    if (!v) { v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; rgb.set(c, v); }
    img.data[i * 4] = v[0]; img.data[i * 4 + 1] = v[1]; img.data[i * 4 + 2] = v[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

let lastT = 0;
// Poses change 12 times a second, so the loop runs 12 times a second (not every
// screen frame): easy on the battery.
function tick() {
  timer = 0;
  const ms = performance.now();
  const canvases = document.querySelectorAll('canvas.live-buddy');
  if (!canvases.length || document.visibilityState === 'hidden') return;
  const t = ms / 1000;
  const dt = Math.min(0.1, Math.max(0, t - lastT));
  lastT = t;
  const step = Math.floor(t * (reduced ? 3 : FPS));
  timer = setTimeout(tick, 1000 / FPS);
  const seen = new Set();
  for (const canvas of canvases) {
    const key = canvas.dataset.live;
    const st = buddies.get(key);
    if (!st || !looks.has(key)) continue;
    if (!seen.has(key)) {
      seen.add(key);
      applyFeel(st, ms);
      const lookAt = ms < st.lookUntil ? st.lookAt : null;
      const pose = st.brain.pose(t, dt, { beat: beatNow(st, ms), lookAt, notes: st.notes });
      // style A: the pose only changes 12 times a second
      if (step !== st.frame || !st.pose) { st.frame = step; st.pose = pose; st.drawn = new WeakSet(); }
    }
    if (st.pose && !st.drawn.has(canvas)) {
      st.drawn.add(canvas);
      paint(canvas, render(rigFor(key, canvas.dataset.bg !== '0'), st.pose, step));
    }
  }
}

/** Starts drawing (call after the page changes). Stops by itself when no live buddy is on screen. */
export function liveStart() {
  if (typeof document === 'undefined') return;
  // draw new canvases right away, so a redrawn page never shows an empty buddy
  clearTimeout(timer);
  tick();
}

// ---------- fingers ----------
function scenePoint(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 24, ((e.clientY - r.top) / r.height) * 24];
}

if (typeof document !== 'undefined') {
  let down = null;
  document.addEventListener('pointerdown', (e) => {
    const canvas = e.target.closest?.('canvas.live-buddy');
    if (!canvas) return;
    const st = buddies.get(canvas.dataset.live);
    if (!st) return;
    const now = performance.now();
    const p = scenePoint(canvas, e);
    down = { canvas, at: now };
    wake(st, now);
    st.lookAt = p; st.lookUntil = now + 1500;
    // the top of the head (ears and forehead) gets a pat; lower down is a poke
    canvas.dataset.zone = p[1] < 11 ? 'head' : 'body';
  }, true);
  document.addEventListener('pointermove', (e) => {
    const canvas = down?.canvas || e.target.closest?.('canvas.live-buddy');
    if (!canvas || (!down && e.pointerType !== 'mouse')) return;
    const st = buddies.get(canvas.dataset.live);
    if (!st) return;
    st.lookAt = scenePoint(canvas, e); st.lookUntil = performance.now() + 1200;
  }, true);
  document.addEventListener('pointerup', () => {
    if (!down) return;
    const { canvas, at } = down;
    down = null;
    const st = buddies.get(canvas.dataset.live);
    if (!st) return;
    const now = performance.now();
    st.taps = st.taps.filter((x) => now - x < 1600);
    st.taps.push(now);
    if (st.taps.length >= 5) { st.brain.impulse('dizzy', 1); st.brain.impulse('giggle', 1); st.taps = []; canvas.dataset.zone = 'silly'; return; }
    if (canvas.dataset.zone === 'head') st.brain.impulse('pat', 1, now - at > 500 ? 2 : 1.2);
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') liveStart(); });
}
