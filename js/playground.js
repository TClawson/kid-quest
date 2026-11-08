// The playground screen: a full-screen field where the kid's buddy plays a
// game (see play.js) with a visiting buddy. Opened from a visitor on the map.
import { Play, GAME_NAMES } from './play.js';
import { Hockey } from './hockey.js';
import { Fishing } from './fishing.js';
import { Football } from './football.js';

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
 * opts: { kid, visitor: { buddy, name, gear }, kind, best, sounds, onScore(score) }
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

  const Game = opts.kind === 'hockey' ? Hockey : opts.kind === 'fishing' ? Fishing : opts.kind === 'football' ? Football : Play;
  // fishing: the lake for the kid's map, and today's bait odds
  const game = new Game({ W, H, kind: opts.kind, kid: opts.kid, visitor: opts.visitor, best: opts.best, map: opts.map, day: opts.day, seed: Date.now() % 100000 });
  root.game = game; // for tests
  // fishing draws its lake and fish with finer pixels
  if (game.Z) { field.width = W * game.Z; field.height = H * game.Z; }
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
      navigator.vibrate?.(game.newBest ? [30, 60, 30] : 60);
    }
    // for tests: what the game is doing
    root.dataset.phase = game.phase;
    root.dataset.score = game.kind === 'soccer' ? game.count : game.kind === 'hockey' ? game.goals.kid : game.kind === 'fishing' || game.kind === 'football' ? game.score : game.free.toFixed(1);
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
  const onDown = (e) => {
    if (e.target.closest('.play-close')) return;
    e.preventDefault();
    const p = at(e);
    if (!game.holdAnywhere && game.press && game.onButton?.(...p) && game.phase === 'play') { button = e.pointerId; game.press(); listen(); return; }
    down = e.pointerId;
    game.tap(...p);
    listen();
  };
  const onMove = (e) => { if (down === e.pointerId) game.drag(...at(e)); };
  const onUp = (e) => {
    if (button === e.pointerId) { button = null; game.release(); listen(); }
    if (down === e.pointerId) { down = null; if (game.holdAnywhere) { game.release(); listen(); } }
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

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
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
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
