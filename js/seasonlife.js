// Seasons in the live app: the glue between the rules (seasons.js), the art (seasonfx.js)
// and the pages that show them (the village, the backyard).
//
//   seasonNow(day)        -> { season, progress, tried } for a day, honouring a parent's try-out
//   tintLand(canvas, se, mapId)  a painted background recoloured for the season (once per paint)
//   spriteFor(canvas, se, mapId) a standing sprite or layer recoloured (cached by seasonfx.js)
//   mountWeather(host, opts)     one overlay canvas with the season's weather, one cheap loop (30 frames a second at most, paused while the page is hidden)
//
// Summer is the colours the art was drawn in, so it is never recoloured.

import { shownSeason, seasonOf, seasonProgress } from './seasons.js';
import { seasonTint, seasonSprite, weather, stepParticles, drawParticles } from './seasonfx.js';

export function seasonNow(day) {
  const key = day || new Date().toISOString().slice(0, 10);
  const season = shownSeason(key);
  const tried = season !== seasonOf(key);
  // a try-out shows the middle of the season, so autumn is properly orange and winter properly white
  return { season, tried, progress: tried ? 0.5 : seasonProgress(key) };
}

export const tintLand = (canvas, se, mapId) => (se.season === 'summer' ? canvas : seasonTint(canvas, se.season, mapId, se.progress));
export const spriteFor = (canvas, se, mapId) => (se.season === 'summer' ? canvas : seasonSprite(canvas, se.season, se.progress, mapId));

const TICK_MS = 1000 / 30; // weather does not need more than 30 frames a second

/**
 * Puts the season's weather over host (a positioned element): a canvas of W x H pixels with
 * pointer-events none. opts: { season: seasonNow(), mapId, W, H, z, cssW, cssH }.
 * Few particles on small screens; with reduced motion, one still picture of the weather.
 * Returns the canvas (or null when the season has no weather here).
 */
export function mountWeather(host, opts) {
  const { season: se, mapId, W, H } = opts;
  const wx = weather(se.season, mapId, se.progress);
  if (!wx) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'season-weather';
  canvas.width = W; canvas.height = H;
  canvas.dataset.kind = wx.kind;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = `width:${opts.cssW || W}px;height:${opts.cssH || H}px;z-index:${opts.z || 9500}`;
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const o = { scale: (globalThis.innerWidth || 1000) < 600 ? 0.6 : 1, reduce: Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) };
  let state = stepParticles(null, 0, W, H, wx, o); // starts spread over the whole map
  drawParticles(ctx, state);
  if (o.reduce) return canvas; // a few flakes standing still
  let last = performance.now(); let acc = 0;
  const tick = (now) => {
    if (!canvas.isConnected) return;
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    if (document.visibilityState !== 'hidden' && acc * 1000 >= TICK_MS * 0.8) {
      state = stepParticles(state, acc, W, H, wx, o);
      acc = 0;
      canvas.dataset.frames = String((Number(canvas.dataset.frames) || 0) + 1);
      drawParticles(ctx, state);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return canvas;
}
