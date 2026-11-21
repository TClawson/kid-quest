// The playground screen: a full-screen field where the kid's buddy plays a
// game (see play.js) with a visiting buddy. Opened from a visitor on the map.
import { Play, GAME_NAMES } from './play.js';
import { Hockey } from './hockey.js';
import { Fishing } from './fishing.js';
import { Football } from './football.js';
import { Sledding } from './sledding.js';
import { PhotoTrain } from './phototrain.js';

let open = null;

/** Pixel size for the screen: buddies about a sixth of the short side tall. */
function layout(vw, vh) {
  const S = Math.max(2, Math.round(Math.min(vw, vh) / 130));
  const W = Math.floor(vw / S);
  // tall phones: keep the field a sensible shape, centered on the screen
  const H = Math.min(Math.floor(vh / S), Math.round(W * 1.15));
  return { S, W, H };
}

/**
 * opts: { kid, visitor: { buddy, name, gear }, kind, best, sounds, onScore(score): a new best, onOver(score): any game's end,
 *   onCatch(fish): fishing only, the kid landed a fish (see Fishing);
 *   onFind(find), onRun(run), dry, season: the sled's treasure hill only (see Sledding) }
 * Returns a function that closes the screen.
 */
export function openPlay(opts) {
  if (open) open();
  const root = document.createElement('div');
  root.className = 'playground';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `${GAME_NAMES[opts.kind]} with ${opts.visitor.name}`);
  root.innerHTML = `
    <div class="play-stage"><canvas class="play-field"></canvas><canvas class="play-hud"></canvas></div>
    <div class="play-top"><b>${GAME_NAMES[opts.kind]} with ${opts.visitor.name.replace(/[&<>"']/g, '')}<small class="play-left"></small></b><button class="btn play-close" aria-label="Done playing">Done</button></div>`;
  document.body.appendChild(root);
  const stage = root.querySelector('.play-stage');
  const field = root.querySelector('.play-field');
  const hud = root.querySelector('.play-hud');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const { S, W, H } = layout(window.innerWidth, window.innerHeight);
  field.width = W; field.height = H;
  hud.width = Math.round(W * S * dpr); hud.height = Math.round(H * S * dpr);
  for (const c of [field, hud]) { c.style.width = `${W * S}px`; c.style.height = `${H * S}px`; }
  stage.style.width = `${W * S}px`; stage.style.height = `${H * S}px`;

  const Game = opts.kind === 'hockey' ? Hockey : opts.kind === 'fishing' ? Fishing : opts.kind === 'football' ? Football : opts.kind === 'sledding' ? Sledding : opts.kind === 'train' ? PhotoTrain : Play;
  // fishing: the lake for the kid's map, and today's bait odds
  const game = new Game({ W, H, kind: opts.kind, kid: opts.kid, visitor: opts.visitor, best: opts.best, map: opts.map, day: opts.day, seed: Date.now() % 100000, onCatch: opts.onCatch, onFind: opts.onFind, onRun: opts.onRun, dry: opts.dry, season: opts.season, weather: opts.weather, clues: opts.clues, onPhoto: opts.onPhoto, onClue: opts.onClue });
  root.game = game; // for tests
  // fishing draws its lake and fish with finer pixels, and a better rod shows more of the
  // lake (fieldW x fieldH lake pixels, shrunk to fit the same screen)
  if (game.Z) { field.width = (game.fieldW || W) * game.Z; field.height = (game.fieldH || H) * game.Z; }
  // the daily limit: opts.gamesLeft() says how many games are left today
  const left = () => (opts.gamesLeft ? opts.gamesLeft() : Infinity);
  const $left = root.querySelector('.play-left');
  const showLeft = () => {
    const n = left();
    game.locked = n <= 0;
    if ($left) $left.textContent = Number.isFinite(n) ? `${n} ${n === 1 ? 'game' : 'games'} left today` : '';
  };
  showLeft();
  const fctx = field.getContext('2d');
  const hctx = hud.getContext('2d');
  const snd = opts.sounds || {};

  // sounds and scores follow what the game did
  let seen = { count: 0, pops: 0, phase: game.phase, it: null };
  const listen = () => {
    if (game.kind === 'soccer' && game.count > seen.count) snd.kick?.(game.count);
    const pops = game.pops.length ? game.pops[game.pops.length - 1].at : 0;
    if (pops !== seen.pops && game.kind === 'tag' && game.it !== seen.it && game.it) snd.tag?.();
    if (game.phase === 'play' && seen.phase !== 'play') { opts.onStart?.(); showLeft(); }
    if (game.sound) { snd[game.sound]?.(); game.sound = null; }
    if (game.phase === 'over' && seen.phase !== 'over') {
      snd.over?.(game.newBest);
      if (game.newBest) opts.onScore?.(game.score);
      opts.onOver?.(game.score);
      navigator.vibrate?.(game.newBest ? [30, 60, 30] : 60);
    }
    // for tests: what the game is doing
    root.dataset.phase = game.phase;
    root.dataset.score = game.kind === 'soccer' ? game.count : game.kind === 'hockey' ? game.goals.kid : game.kind === 'fishing' || game.kind === 'football' || game.kind === 'sledding' || game.kind === 'train' ? game.score : game.free.toFixed(1);
    if (game.buzz) { navigator.vibrate?.(game.buzz); game.buzz = null; }
    const n = game.kind === 'soccer' && game.next();
    root.dataset.next = n ? String(Math.round((n.at - game.t) * 1000)) : '';
    // whose turn it is in keepy-uppy, and where they are across the field (0-1)
    root.dataset.want = game.want ? (game.want === game.kid ? 'kid' : 'vis') : '';
    root.dataset.wantx = game.want ? (game.want.x / game.W).toFixed(3) : '';
    seen = { count: game.kind === 'soccer' ? game.count : 0, pops, phase: game.phase, it: game.it };
  };

  const at = (e) => {
    const r = field.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  // one finger can hold the hockey button while another steers
  let down = null; let button = null;
  // Android sends pointercancel when it decides a still-held finger might be a scroll, a
  // long-press or a palm, even with touch-action: none. That is not a lift: the finger is
  // still on the glass (Taylor, 2026-11-21: "I was continuing to hold in many cases where it
  // thought I had let go"). So a cancelled touch stays held, keeps steering from touchmove,
  // and lets go only when a real touchend/touchcancel leaves no finger on the screen.
  let lost = null; // { down, button, x, y } held touches whose pointer events were cancelled
  let lastXY = null;
  const onDown = (e) => {
    if (e.target.closest('.play-close')) return;
    e.preventDefault();
    try { root.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
    lost = null;
    const p = at(e);
    lastXY = [e.clientX, e.clientY];
    if (!game.holdAnywhere && game.press && game.onButton?.(...p) && game.phase === 'play') { button = e.pointerId; game.press(); listen(); return; }
    down = e.pointerId;
    game.tap(...p);
    listen();
  };
  const onMove = (e) => { if (down === e.pointerId) { lastXY = [e.clientX, e.clientY]; game.drag(...at(e)); } };
  const letGo = (isButton, isDown) => {
    if (isButton) { button = null; game.release(); listen(); }
    if (isDown) { down = null; game.up?.(); if (game.holdAnywhere) { game.release(); listen(); } }
  };
  const onUp = (e) => letGo(button === e.pointerId, down === e.pointerId);
  const onCancel = (e) => {
    const isButton = button === e.pointerId; const isDown = down === e.pointerId;
    if (!isButton && !isDown) return;
    if (e.pointerType !== 'touch') { letGo(isButton, isDown); return; }
    lost = { button: isButton || lost?.button, down: isDown || lost?.down };
  };
  const onTouchMove = (e) => {
    if (!lost?.down || !e.touches.length) return;
    // follow the finger nearest to where the steering finger last was
    let best = e.touches[0]; let bd = Infinity;
    for (const t of e.touches) {
      const d = lastXY ? (t.clientX - lastXY[0]) ** 2 + (t.clientY - lastXY[1]) ** 2 : 0;
      if (d < bd) { bd = d; best = t; }
    }
    lastXY = [best.clientX, best.clientY];
    game.drag(...at(best));
  };
  const onTouchEnd = (e) => {
    if (!lost || e.touches.length) return;
    const l = lost; lost = null;
    letGo(l.button && button != null, l.down && down != null);
  };
  const noMenu = (e) => e.preventDefault();
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('contextmenu', noMenu);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);

  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.step(dt);
    listen();
    game.draw(fctx);
    game.drawHud(hctx, S * dpr);
  };
  raf = requestAnimationFrame(frame);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  const close = () => {
    cancelAnimationFrame(raf);
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('contextmenu', noMenu);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    document.removeEventListener('visibilitychange', onVis);
    root.remove();
    open = null;
    opts.onClose?.();
  };
  root.querySelector('.play-close').addEventListener('click', close);
  open = close;
  return close;
}

export const playing = () => Boolean(open);
