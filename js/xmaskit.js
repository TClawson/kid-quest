// Small shared helpers for the December art (xmaslights.js, adventart.js, santaart.js), in the
// village's style B: sprites drawn into a Buf of colors and tags, then outlined selectively (each
// shape edged in a darker shade of its own color, deeper on the shaded bottom-right; near-black
// ink only where it stands on the ground), at one art pixel per village pixel.
//
// Cells tagged 'lit...' give off light: they are never outlined, and at night they keep their
// colors while everything else goes through the map's night colors (nightfx.js).

import { Buf, mix, ramp, hexRgb } from './pixelkit.js';
import { nightColor } from './nightfx.js';

export const INK = '#3b2235';

/** The outline color beside a cell of color c, on its side of the shape. */
export function edgeOf(c, side) {
  return mix(c.slice(0, 7), INK, side === 'bottom' || side === 'right' ? 0.55 : 0.34);
}

/**
 * Draws a sprite: draw(b) fills a Buf (w x h, local coordinates); then the outline goes round the
 * silhouette in the shape's own darker colors. o: { ground: rows from the bottom that sit on the
 * ground (their bottom edge goes ink), noLine: tags with no outline, night: mapId to draw it at
 * night (nightMix: how far into the night's colors, 1 by default; less for things in their own light), ax, ay: the anchor (its foot) in sprite coordinates }. Returns a canvas with ax, ay.
 */
export function spriteOf(w, h, draw, o = {}) {
  const pad = o.pad ?? 2;
  const b = new Buf(w, h, pad);
  draw(b);
  const marks = [];
  const lit = (t) => String(t || '').startsWith('lit');
  const noLine = o.noLine || [];
  if (o.outline !== false) {
    b.each((x, y) => {
      if (b.get(x, y)) return;
      let side = null; let nx = 0; let ny = 0;
      for (const [dx, dy, s] of [[0, -1, 'bottom'], [-1, 0, 'right'], [0, 1, 'top'], [1, 0, 'left']]) {
        const c = b.get(x + dx, y + dy); const t = b.tag(x + dx, y + dy);
        if (c && !lit(t) && !noLine.includes(String(t).split(':')[0]) && !String(t).endsWith(':edge')) { side = s; nx = x + dx; ny = y + dy; break; }
      }
      if (!side) return;
      const c = b.get(nx, ny);
      const grounded = o.ground && side === 'bottom' && y >= h - o.ground;
      marks.push([x, y, grounded ? INK : edgeOf(c, side), `${b.tag(nx, ny) || ''}:edge`]);
    });
    marks.forEach(([x, y, c, t]) => b.set(x, y, c, t));
  }
  const cv = document.createElement('canvas'); cv.width = b.W; cv.height = b.H;
  const ctx = cv.getContext('2d');
  b.each((x, y) => {
    let c = b.get(x, y);
    if (!c) return;
    if (o.night && !lit(b.tag(x, y))) c = o.nightMix != null ? mix(c.slice(0, 7), nightColor(c.slice(0, 7), o.night), o.nightMix) : nightColor(c.slice(0, 7), o.night);
    ctx.fillStyle = c; ctx.fillRect(x + pad, y + pad, 1, 1);
  });
  cv.ax = (o.ax ?? Math.floor(w / 2)) + pad; cv.ay = (o.ay ?? h - 1) + pad;
  cv.buf = b;
  return cv;
}

/** A hue-shifted ramp, 6 colors dark to light, round a base color (pixelkit's ramp). */
export const R6 = (c) => ramp(c, 3, 2);
export const lighter = (c, t = 0.45) => mix(c, '#fffbe8', t);
export const darker = (c, t = 0.4) => mix(c, '#2a1840', t);
export const lum = (c) => { const [r, g, b] = hexRgb(c); return (r * 0.3 + g * 0.55 + b * 0.15) / 255; };

/** A 3 x 5 pixel font for numbers on little doors and tags. */
export const DIGITS = {
  0: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], 1: ['.x.', 'xx.', '.x.', '.x.', 'xxx'], 2: ['xx.', '..x', '.x.', 'x..', 'xxx'],
  3: ['xx.', '..x', '.x.', '..x', 'xx.'], 4: ['x.x', 'x.x', 'xxx', '..x', '..x'], 5: ['xxx', 'x..', 'xx.', '..x', 'xx.'],
  6: ['.xx', 'x..', 'xxx', 'x.x', 'xxx'], 7: ['xxx', '..x', '.x.', '.x.', '.x.'], 8: ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'], 9: ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
};
/** Writes a number in the 3 x 5 font: put(x, y) for each lit cell. Returns its width. */
export function number(put, X, Y, n) {
  const s = String(n);
  s.split('').forEach((ch, i) => DIGITS[ch].forEach((row, y) => { for (let x = 0; x < 3; x += 1) if (row[x] === 'x') put(X + i * 4 + x, Y + y); }));
  return s.length * 4 - 1;
}
