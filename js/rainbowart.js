// Rainbow Land in style B, "soft storybook": a soft mint meadow sprinkled with sugar sparkles and
// tiny pastel flowers, a wall of cotton-candy trees round the edge, paths of pastel jellybean
// cobbles, round rainbow-tiled plazas, a rainbow river with a glittering sugar bank and an arched
// rainbow bridge, mushroom cottages with spotted caps, round doors and windows and little
// chimneys (maplife.js puffs hearts and stars out of them; the kid's cap is their own color),
// cloud puffs resting on the ground, and the green as Rainbow Land has it: a pink lemonade pond
// with floating marshmallows, a sky-blue ice rink, a sugar-sand field with candy-cane goals.
// Whimsy: a gumdrop garden, a marshmallow campfire, a sleeping cloud sheep, a lollipop lamp post,
// a rainbow snail, a sprinkle-cupcake fountain and a star-catcher net.
//
// One canvas pixel per village pixel, painted into one ImageData and shown with a single
// putImageData. villageprops.js calls paintRainbow() for 'bg-rainbow' only.

import { ramp, mix, rng, h2, vnoise, bayer, Buf, grid, inEll, pathField, pixelBuffer } from './pixelkit.js';
import { propB, groundShadow, laundryB } from './meadowart.js';
import { sel, tg } from './castleart.js';

const INK = '#3a2850';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const RBW = {
  mint: ['#3e7e86', '#56a09c', '#76c0b0', '#96d8c2', '#b2ead2', '#cdf6e2', '#e6fdf2'], // base 4
  cloud: ['#6e5c9c', '#8c7cb8', '#ab9ed0', '#c9c0e4', '#e2ddf2', '#f3f0fb', '#ffffff'],
  cream: ['#9a7a86', '#bc9c9c', '#dcbfb2', '#efdcc8', '#fbefdf', '#fff8ef'],
  stem: ['#a08a9a', '#c4b0b4', '#e0d0c8', '#f2e6da', '#fcf4ea', '#fffcf6'],
  wood: ['#6a3e5a', '#94566a', '#bc7a7e', '#d8a092', '#ecc4ac', '#f8e2cc'],
  gold: ['#6e3418', '#9a5418', '#c67a1c', '#e8a42a', '#fcc83c', '#ffe27a', '#fff6c8'],
};
const MI = RBW.mint; const CL = RBW.cloud; const CR = RBW.cream; const ST = RBW.stem; const WD = RBW.wood;
// the rainbow, pastel, each as a ramp dark..light with the base at 2
const BOW = ['#ff7a8e', '#ffab6a', '#ffdc5a', '#86dc92', '#68bcff', '#b292ff'].map((c) => ramp(c, 2, 3));
// candy colors for cobbles, spots, gumdrops and sprinkles
const CANDY = ['#ffb0c6', '#ffcf96', '#fff09a', '#b4eebe', '#a8d6ff', '#d2bcff'].map((c) => ramp(c, 2, 2));
const TREE = [ramp('#f7a0c4', 3, 3), ramp('#b9a0ff', 3, 3), ramp('#86c6ff', 3, 3), ramp('#ffb4d8', 3, 3)];
const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let i = 0; i <= n; i += 1) fn(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), i / n); };
const edgeOf = (t, side) => {
  const k = String(t).split(':')[0];
  if (k === 'cloud') return side === 'bottom' ? CL[1] : side === 'right' ? CL[2] : CL[3];
  if (k === 'glow' || k === 'fx' || k === 'water') return null;
  return sel(t, side);
};

// ---------- the meadow ----------

function groundRB(px, L, seed) {
  const { W, H } = L;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = (bayer(x, y) - 0.5) * 0.18;
      const n = vnoise(x, y, 30, seed) * 0.6 + vnoise(x, y, 9, seed + 1) * 0.4;
      let i = n < 0.3 + t ? 3 : n < 0.62 + t ? 4 : 5;
      // a soft lilac shade under the candy trees round the edge
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      let c;
      if (e < 60 && (60 - e) / 60 > 0.5 + t * 2 + vnoise(x, y, 12, seed + 7) * 0.3) i -= 1;
      // sunny patches
      const sun = vnoise(x, y, 40, seed + 3);
      if (sun > 0.68 + t * 0.5) i += 1;
      c = MI[clamp(i, 2, 6)];
      if (e < 40 && bayer(x, y) < (40 - e) / 80) c = mix(c, '#b8a8e8', 0.3);
      // grass blades and sugar glints
      const hk = h2(x, y, seed + 6);
      if (hk > 0.985) c = MI[6]; else if (hk < 0.012) c = MI[2];
      else if (hk > 0.9975) c = '#ffffff';
      px(x, y, c);
    }
  }
}

/** Little things in the grass: tufts, tiny pastel flowers, clover hearts, sugar sparkles. */
function scatterRB(px, L, seed, busy) {
  const rnd = rng(seed);
  const { W, H } = L;
  for (let n = 0; n < 1400; n += 1) {
    const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H);
    const k = rnd();
    if (busy(x, y)) continue;
    if (k < 0.45) {
      // a tuft of grass
      const tall = rnd() < 0.5;
      grid(px, x, y, tall ? ['.l.l', 'ld.d', '.d..'] : ['l.l', '.d.'], { l: MI[5], d: MI[2] });
    } else if (k < 0.7) {
      // a tiny flower
      const C = CANDY[Math.floor(rnd() * 6)];
      grid(px, x - 1, y - 1, ['.a.', 'aYa', '.g.'], { a: C[2], Y: '#fffbe0', g: MI[2] });
    } else if (k < 0.8) {
      // a clover leaf shaped like a heart
      grid(px, x - 1, y - 1, ['h.h', 'hHh', '.h.'], { h: MI[2], H: MI[3] });
    } else if (k < 0.9) {
      px(x, y, '#ffffff'); px(x + 1, y + 1, CANDY[Math.floor(rnd() * 6)][3]);
    } else if (k < 0.93) {
      // a sugar sparkle
      grid(px, x - 1, y - 1, ['.w.', 'wWw', '.w.'], { w: '#f4fbff', W: '#ffffff' });
    }
  }
}

// ---------- the candy-tree wall round the edge ----------

/** A cotton-candy crown: a puffy ball lit at the top left, with sugar glints. */
function crownInto(put, cx, cy, r, P, seed) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y += 1) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
      const wob = (vnoise(x, y, 4, seed) - 0.5) * 1.6;
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05);
      if (d > r + wob) continue;
      const l = -(((x + 0.5 - cx) / r) * 0.6 + ((y + 0.5 - cy) / r) * 0.8);
      const t = (bayer(x, y) - 0.5) * 0.3;
      let i = l > 0.55 + t ? 6 : l > 0.2 + t ? 5 : l > -0.2 + t ? 4 : l > -0.55 + t ? 3 : 2;
      // little tufts of floss
      if (vnoise(x, y, 3, seed + 1) > 0.72 && i > 2) i -= 1;
      if (d > r + wob - 1) i = l > 0.3 ? 4 : 1;
      put(x, y, P[clamp(i, 0, 6)]);
    }
  }
  if (h2(cx | 0, cy | 0, seed) > 0.4) put(Math.round(cx - r * 0.35), Math.round(cy - r * 0.45), '#ffffff');
}

/** The candy-tree wall: puffy crowns in rows round the edge, back ones first, stripy trunks under the top row. */
function wallRB(px, L, seed, skip) {
  const { W, H } = L;
  const trees = [];
  const add = (x, y, r, k) => { if (!skip(x, y + r * 0.5)) trees.push({ x, y, r, k }); };
  let i = 0;
  for (let x = -6; x < W + 10; x += 22 + (i % 3) * 3, i += 1) {
    add(x, 8 + (i % 2) * 6, 14 + (i % 3), i);
    add(x + 11, -4, 13, i + 1);
    add(x, H - 4 - (i % 2) * 5, 14 + ((i + 1) % 3), i + 2);
    add(x + 10, H + 6, 13, i + 3);
  }
  i = 0;
  for (let y = 24; y < H - 10; y += 20 + (i % 3) * 3, i += 1) {
    add(4 + (i % 2) * 6, y, 13 + (i % 3), i);
    add(-8, y + 10, 13, i + 1);
    add(W - 4 - (i % 2) * 6, y, 13 + ((i + 1) % 3), i + 2);
    add(W + 8, y + 10, 13, i + 3);
  }
  trees.sort((a, b) => a.y - b.y);
  const b = new Buf(W, H + 20, 0);
  trees.forEach((t, n) => {
    // its shadow on the meadow, then a stripy trunk peeking out under the crown, then the crown
    for (let yy = -3; yy <= 3; yy += 1) for (let xx = -t.r; xx <= t.r; xx += 1) if (inEll(t.x + xx, t.y + t.r + yy, t.x + 2, t.y + t.r + 1, t.r, 3.5)) px(t.x + xx, t.y + t.r + yy, 'rgba(70,50,130,0.18)');
    for (let yy = 0; yy < 8; yy += 1) for (let xx = -2; xx <= 1; xx += 1) b.set(t.x + xx, t.y + t.r - 3 + yy, (yy + xx + 8) % 4 < 2 ? (xx < 0 ? '#ffffff' : '#f0e4f4') : (xx < 0 ? '#ff9ab8' : '#e4709a'), tg('trunk', '#c06090'));
    crownInto((x, y, c) => b.set(x, y, c, tg('floss', TREE[t.k % 4][2])), t.x, t.y, t.r, TREE[(t.k + n) % 4], seed + n);
  });
  b.outline((t, side) => (side === 'bottom' || side === 'right' ? mix(TREE[0][1], INK, 0.35) : null));
  b.blit(px, 0, 0);
}

// ---------- paths and plazas ----------

/** Paths of pastel jellybean cobbles set in sugar-white grout, with a soft rim. */
function pathsRB(px, L, seed) {
  const { W, H } = L;
  const pf = pathField(L.paths, 12);
  const xs = L.paths.flat().map((p) => p[0]); const ys = L.paths.flat().map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - 12)); const x1 = Math.min(W, Math.ceil(Math.max(...xs) + 12));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - 12)); const y1 = Math.min(H, Math.ceil(Math.max(...ys) + 12));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = pf(x, y);
      if (p.d > 10) continue;
      const edge = 7 + (vnoise(x, y, 6, seed) - 0.5) * 0.8;
      if (p.d > edge + 1) { if (p.d < edge + 2.6 && bayer(x, y) < 0.5) px(x, y, MI[2]); continue; }
      if (p.d > edge) { px(x, y, '#c68ab4'); continue; }
      if (p.d > edge - 1) { px(x, y, p.nx * 0.6 + p.ny * 0.8 < 0 ? CR[4] : CR[3]); continue; }
      // the cobbles: rows across the path, staggered
      const v = (p.off + 7) / 3.5; const row = Math.floor(v);
      const u = p.along / 4.6 + (row % 2) * 0.5; const cell = Math.floor(u);
      const fu = u - cell; const fv = v - row;
      const grout = fu < 0.2 || fv < 0.22 || (fu < 0.34 && fv < 0.38) || (fu > 0.86 && fv > 0.8);
      if (grout) { px(x, y, (fu < 0.2 && fv < 0.22) ? CR[3] : CR[5]); continue; }
      const C = CANDY[Math.floor(h2(cell, row, seed) * 6)];
      let i = fu > 0.8 || fv > 0.78 ? 1 : fu < 0.42 && fv < 0.5 ? 3 : 2;
      if (h2(x, y, seed + 2) > 0.97) i = 4;
      px(x, y, C[i]);
    }
  }
}

/** A round plaza: a sugar-white kerb, rings of tiles in the rainbow's colors, a heart in the middle. */
function plazaRB(px, cx, cy, r, seed) {
  for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y += 1) {
    for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x += 1) {
      const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
      if (d > r + 2) continue;
      if (d > r + 0.6) { px(x, y, d > r + 1.4 ? 'rgba(70,50,130,0.22)' : '#c68ab4'); continue; }
      const a = Math.atan2(dy, dx);
      const lit = -(dx * 0.6 + dy * 0.8) / Math.max(1, d);
      if (d > r - 3) {
        const seg = (((a + Math.PI) / (Math.PI * 2)) * Math.round(r * 0.8)) % 1;
        px(x, y, seg < 0.1 ? CR[2] : d > r - 1 ? (lit > 0 ? CR[4] : CR[2]) : lit > 0.2 ? CR[5] : CR[4]);
        continue;
      }
      // rings of tiles, a rainbow from the outside in
      const ring = Math.floor((r - 3 - d) / 3.4);
      const n = Math.max(4, Math.round((r - 3 - ring * 3.4) * 1.2));
      const f = (((a + Math.PI) / (Math.PI * 2)) * n + ring * 0.5) % 1;
      const jr = ((r - 3 - d) % 3.4) < 0.8; const ja = Math.abs(f - 0.5) > 0.43;
      if ((jr || ja) && d > 5) { px(x, y, CR[5]); continue; }
      const B = BOW[ring % 6];
      const k = ((r - 3 - d) % 3.4);
      px(x, y, d <= 5 ? CR[5] : k < 1.6 ? B[3] : B[2]);
    }
  }
  // the heart in the middle
  grid(px, Math.round(cx) - 3, Math.round(cy) - 3, ['.hh.hh.', 'hHHhhhh', 'hHhhhhh', '.hhhhh.', '..hhh..', '...h...'], { h: '#ff7aa2', H: '#ffc4d8' });
}

// ---------- the rainbow river and its bridge ----------

/** The river: six pastel bands of rainbow flowing between glittering sugar banks. */
function riverRB(px, L, wa, seed) {
  const { W, H } = L;
  const pf = pathField([wa.pts], wa.w);
  const xs = wa.pts.map((p) => p[0]); const ys = wa.pts.map((p) => p[1]);
  const pad = wa.w / 2 + 10;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)); const x1 = Math.min(W, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)); const y1 = Math.min(H, Math.ceil(Math.max(...ys) + pad));
  const depth = (x, y) => { const wob = Math.sin(x / 13 + y / 17) * 1.2 + Math.sin(x / 5.3 - y / 7.1) * 0.5; return wa.w / 2 + wob - pf(x, y).d; };
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = pf(x, y);
      if (p.d > wa.w / 2 + 9) continue;
      const d = depth(x, y);
      if (d < -7) continue;
      const lit = p.nx * 0.6 + p.ny * 0.8;
      if (d < 0) {
        // the sugar bank: white, glittering, a lilac shade where it meets the water on the lit side
        const b = -d;
        if (b > 4.5) { if (bayer(x, y) < (7 - b) / 3) px(x, y, CL[5]); continue; }
        let c = b < 1.2 ? (lit < 0 ? CL[3] : CL[4]) : b > 3.4 ? CL[5] : CL[6];
        const g = h2(x, y, seed);
        if (b > 1.2 && g > 0.9) c = g > 0.96 ? CANDY[Math.floor(g * 600) % 6][3] : '#ffffff';
        px(x, y, c);
        continue;
      }
      // the bands, across the stream
      const u = clamp((p.off + wa.w / 2) / wa.w, 0, 0.999);
      const band = Math.floor(u * 6); const B = BOW[band];
      const t = (bayer(x, y) - 0.5) * 0.3;
      let i = d < 1.2 ? 1 : d < 3 ? 2 : 3;
      if (((u * 6) % 1) < 0.18 && d > 2) i -= 1;
      // light ripples drifting along
      const st = Math.floor(p.along / 8); const ln = Math.round(p.off / 2.4);
      if (d > 2.5 && h2(st, ln, seed + 1) > 0.8 && ((p.along % 8) + 8) % 8 < 3 + t * 4) i = 4;
      let c = B[clamp(i, 0, 5)];
      if (d > 3 && h2(x, y, seed + 2) > 0.994) c = '#ffffff';
      px(x, y, c);
    }
  }
  return depth;
}

/** Sparkles over the river and sugar lumps on its banks, away from the bridge. */
function riverEdgeRB(px, L, depth, seed, clear) {
  const rnd = rng(seed);
  const { W, H } = L;
  for (let n = 0; n < 700; n += 1) {
    const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H);
    if (!clear(x, y)) continue;
    const d = depth(x, y);
    if (d > 3 && rnd() < 0.08) grid(px, x - 2, y - 2, ['..w..', '..W..', 'wWWWw', '..W..', '..w..'], { w: '#fff4fc', W: '#ffffff' });
    else if (d < -2 && d > -5 && rnd() < 0.08) {
      // a sugar crystal on the bank
      grid(px, x - 1, y - 2, ['.a.', 'aAb', 'abb'], { a: '#ffffff', A: '#f4f0ff', b: CL[3] });
    }
  }
}

/** The rainbow bridge: an arched deck of planks in the rainbow's colors with white rails and star posts. */
function bridgeRB(px, c) {
  const { x: X, y: Y, w, h } = c;
  // the shadow on the river
  for (let y = Y + 4; y < Y + h + 3; y += 1) for (let x = X + 3; x < X + w + 3; x += 1) px(x, y, 'rgba(60,40,120,0.25)');
  propB(px, X, Y - 3, w, h + 6, (b) => {
    const mid = (h + 6) / 2;
    for (let y = 0; y < h + 6; y += 1) {
      const plank = Math.floor(y / 3);
      const B = BOW[plank % 6];
      for (let x = 4; x < w - 4; x += 1) {
        // the arch: lighter where it rises in the middle
        const rise = 1 - Math.abs(y - mid) / mid;
        let c = y % 3 === 2 ? B[1] : x < 7 ? B[3] : x > w - 8 ? B[1] : B[2];
        if (rise > 0.6 && y % 3 === 0 && x > 6 && x < w - 7) c = B[3];
        if ((x * 7 + plank * 3) % 11 === 0 && y % 3 === 1) c = B[4];
        b.set(x, y, c, tg('wood', B[1]));
      }
      // white rails each side, a post with a gold star every few planks
      for (const rx of [1, 2, w - 3, w - 2]) b.set(rx, y, rx < w / 2 ? (rx === 1 ? '#ffffff' : '#f0e8fa') : (rx === w - 2 ? '#c8bce4' : '#e2daf2'), tg('rail', '#b8aad8'));
    }
    for (const py of [0, Math.round(mid) - 1, h + 3]) for (const pxx of [0, w - 4]) {
      grid((x, y, cc) => b.set(x, y, cc, tg('star', '#d89a2a')), pxx, py - 2, ['.y..', 'yYy.', '.y..', '.w..', '.w..'].map((r) => r.slice(0, 4)), { y: '#ffd84a', Y: '#fff3b0', w: '#ffffff' });
    }
  }, { outline: edgeOf, pad: 2 });
}

// ---------- the green ----------

function roundRect(Z, x, y, g = 0, rr = 10) {
  const qx = Math.max(Z.x + rr - g, Math.min(Z.x + Z.w - rr + g, x + 0.5)); const qy = Math.max(Z.y + rr - g, Math.min(Z.y + Z.h - rr + g, y + 0.5));
  return Math.hypot(x + 0.5 - qx, y + 0.5 - qy) <= rr;
}

/** A pink lemonade pond in a rim of sugar cubes, with floating marshmallows and a little rubber duck. */
function lemonadePondRB(px, Z, seed) {
  const cx = Z.x + Z.w / 2; const cy = Z.y + Z.h / 2; const rx = Z.w / 2 + 3; const ry = Z.h / 2 + 3;
  const P = ramp('#ff9ec0', 3, 3);
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y += 1) {
    for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1.2) { if (d < 1.3) px(x, y, 'rgba(70,50,130,0.2)'); continue; }
      if (d > 1) {
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); const f = (((a + Math.PI) / (Math.PI * 2)) * 30) % 1;
        const lit = -((x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.8);
        px(x, y, f < 0.14 ? CL[3] : d > 1.13 ? CL[4] : lit > 0 ? '#ffffff' : CL[5]);
        continue;
      }
      const t = (bayer(x, y) - 0.5) * 0.14;
      let c = d > 0.86 ? (y < cy ? P[1] : P[5]) : d > 0.55 + t ? P[4] : d > 0.25 + t ? P[3] : P[2];
      if (((x - y * 2 + 400) % 17) < 2 && d < 0.8) c = P[5];
      if (h2(x, y, seed + 1) > 0.993) c = '#ffffff';
      px(x, y, c);
    }
  }
  const rnd = rng(seed + 2);
  for (let n = 0; n < 9; n += 1) {
    const a = rnd() * Math.PI * 2; const k = 0.35 + rnd() * 0.45;
    const x = Math.round(cx + Math.cos(a) * rx * k); const y = Math.round(cy + Math.sin(a) * ry * k);
    if (Math.abs(x - cx) < 12 && Math.abs(y - cy) < 5) continue;
    px(x - 1, y + 2, 'rgba(120,40,80,0.3)', 4, 1);
    grid(px, x - 1, y - 1, ['wWw.', 'wwwp', '.pp.'].map((r, i) => (n % 3 === 1 ? r.replace(/w/g, 'q') : r)), { w: '#ffffff', W: '#ffffff', q: '#ffd6e6', p: CL[3] });
  }
  // a rubber duck
  const dx = Math.round(cx + rx * 0.4); const dy = Math.round(cy - ry * 0.2);
  grid(px, dx - 4, dy - 4, ['...yy..', '..yyKo.', '..yyy..', 'yyyyyy.', '.yyYyy.', '..ppp..'], { y: '#ffd84a', Y: '#fff3b0', K: INK, o: '#ff8a3a', p: P[1] });
}

/** A sky-blue ice rink in a frosting rim with sprinkles, and candy-cane goals. */
function iceRinkRB(px, Z, seed) {
  const I = ramp('#bfe4ff', 3, 3);
  for (let y = Z.y - 6; y < Z.y + Z.h + 6; y += 1) {
    for (let x = Z.x - 6; x < Z.x + Z.w + 6; x += 1) {
      if (roundRect(Z, x, y, 5, 13)) {
        if (!roundRect(Z, x, y, 2, 11)) {
          const lit = y < Z.y + Z.h / 2;
          const sp = h2(x, y, seed);
          let c = roundRect(Z, x, y, 3.5, 12) ? (lit ? '#ffe2ee' : '#ffc4d8') : lit ? '#ffd0e2' : '#f0a0c0';
          if (sp > 0.82) c = CANDY[Math.floor(sp * 1000) % 6][3];
          px(x, y, c);
          continue;
        }
        const n = vnoise(x, y, 8, seed + 1); const t = (bayer(x, y) - 0.5) * 0.2;
        let c = n < 0.35 + t ? I[3] : n < 0.65 + t ? I[4] : I[5];
        const sh = ((x - Z.x) * 0.7 - (y - Z.y) + 400) % 24;
        if (sh < 2) c = '#ffffff';
        const mid = Z.x + Z.w / 2;
        if (Math.abs(x + 0.5 - mid) < 0.6) c = '#ff9ec0';
        if (Math.abs(Math.hypot(x + 0.5 - mid, y + 0.5 - (Z.y + Z.h / 2)) - 7) < 0.55) c = '#ff9ec0';
        if (Math.abs(x + 0.5 - (Z.x + 16)) < 0.55 || Math.abs(x + 0.5 - (Z.x + Z.w - 16)) < 0.55) c = '#9cc8ff';
        px(x, y, c);
      } else if (roundRect(Z, x, y, 6.5, 14)) px(x, y, 'rgba(70,50,130,0.22)');
    }
  }
  goalsRB(px, Z, 6, 4);
}

/** Candy-cane goals with sugar-string nets at each end of a patch. */
function goalsRB(px, Z, gw, inset) {
  const mid = Math.round(Z.y + Z.h / 2);
  for (const [gx, dir] of [[Z.x + inset, 1], [Z.x + Z.w - inset - gw, -1]]) {
    propB(px, gx, mid - 8, gw, 16, (b) => {
      for (let y = 0; y < 16; y += 1) for (let x = 0; x < gw; x += 1) {
        const post = y < 2 || y > 13 || (dir > 0 ? x === 0 : x === gw - 1);
        if (post) b.set(x, y, (x + y) % 4 < 2 ? '#ff6b8a' : '#ffffff', tg('wood', '#e05a7a'));
        else if ((x + y) % 2 === 0) b.set(x, y, '#ffffff', tg('net', '#ffffff'));
      }
    }, { outline: sel, pad: 1 });
  }
}

/** A sugar-sand field for soccer or football, raked smooth, with rainbow lines and candy-cane goals or posts. */
function sugarFieldRB(px, Z, kind, seed) {
  const cx = Z.x + Z.w / 2; const cy = Z.y + Z.h / 2;
  const S = ramp('#fff1c4', 3, 2);
  for (let y = Z.y - 5; y < Z.y + Z.h + 5; y += 1) {
    for (let x = Z.x - 5; x < Z.x + Z.w + 5; x += 1) {
      const dx = (x + 0.5 - cx) / (Z.w / 2 + 4); const dy = (y + 0.5 - cy) / (Z.h / 2 + 4);
      const k = 1 - Math.abs(dx) ** 4 - dy ** 4;
      const edgeN = (vnoise(x, y, 4, seed) - 0.5) * 0.25;
      if (k + edgeN < 0) continue;
      if (k + edgeN < 0.1) { if (bayer(x, y) < 0.6) px(x, y, S[2]); continue; }
      const n = vnoise(x, y, 16, seed + 1); const t = (bayer(x, y) - 0.5) * 0.3;
      let c = n < 0.3 + t ? S[3] : n < 0.8 + t ? S[4] : S[5];
      if (h2(x, y, seed + 2) > 0.985) c = CANDY[Math.floor(h2(x, y, 3) * 6)][3];
      // a rainbow halfway line and center circle
      if (Math.abs(x + 0.5 - cx) < 1 && k > 0.2) c = BOW[(Math.floor((y - Z.y) / 3) % 6 + 6) % 6][2];
      if (Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - 7) < 0.6) c = BOW[4][2];
      px(x, y, c);
    }
  }
  const mid = Math.round(cy);
  if (kind === 'football') {
    for (const gx of [Z.x + 4, Z.x + Z.w - 7]) {
      propB(px, gx - 5, mid - 18, 14, 22, (b) => {
        for (let y = 0; y < 22; y += 1) b.set(5, y, y % 4 < 2 ? '#ff6b8a' : '#ffffff', tg('wood', '#e05a7a'));
        for (let x = 0; x < 13; x += 1) b.set(x, 8, x % 4 < 2 ? '#ff6b8a' : '#ffffff', tg('wood', '#e05a7a'));
        for (let y = 0; y < 9; y += 1) { b.set(0, y, y % 4 < 2 ? '#ff6b8a' : '#ffffff', tg('wood', '#e05a7a')); b.set(12, y, y % 4 < 2 ? '#ff6b8a' : '#ffffff', tg('wood', '#e05a7a')); }
      }, { outline: sel, pad: 1 });
    }
  } else goalsRB(px, Z, 8, 0);
}

// ---------- mushroom cottages ----------

/** Where a cottage's chimney puffs from (maplife.js sends hearts and stars up from here). */
export const chimneyOf = (h) => [Math.round(h.x + h.w * 0.72), Math.round(h.y - 24)];

/**
 * A mushroom cottage: a big domed cap with round spots and a frilly underside, a cream stem with
 * a round door and round windows, a little chimney poking out of the cap. o.kid: the kid's own
 * (cap in their color, a heart over the door, flower pots and a pennant); o.sign 'note': the
 * music house (a note sign and a drum by the door).
 */
function cottageRB(px, X, Y, w, h, o = {}) {
  const cap = ramp(o.cap || '#ff6b6b', 3, 3);
  const ov = 6; // the cap hangs over the stem
  const capH = Math.round(h * 0.56); const top = Y - 14;
  const stemW = Math.round(w * 0.72); const sx = X + Math.round((w - stemW) / 2);
  const stemTop = top + capH - 4; const base = Y + h;
  const ccx = X + w / 2; const crx = w / 2 + ov; const cry = capH;
  groundShadow(px, X + w / 2 + 2, base, w / 2 + 6, 4, 0.24);
  const BW = w + ov * 2 + 4; const BH = base - top + 26;
  const ox = X - ov - 2; const oy = top - 22;
  // where the dome's surface is, at a given x
  const domeY = (x) => { const u = (x + 0.5 - ccx) / crx; return top + cry - Math.sqrt(Math.max(0, 1 - u * u)) * cry; };
  propB(px, ox, oy, BW, BH, (b) => {
    const set = (x, y, c, t) => b.set(x - ox, y - oy, c, t);
    // the stem: a soft cream barrel, shaded under the cap, a few faint flecks
    for (let y = stemTop; y < base; y += 1) {
      const bulge = Math.sin(((y - stemTop) / (base - stemTop)) * Math.PI) * 2;
      for (let x = Math.round(sx - bulge); x < sx + stemW + bulge; x += 1) {
        const u = (x + 0.5 - sx + bulge) / (stemW + bulge * 2);
        const t = (bayer(x, y) - 0.5) * 0.12;
        let i = u < 0.12 + t ? 3 : u < 0.6 + t ? 4 : u < 0.86 + t ? 3 : 2;
        if (y < stemTop + 6) i -= 2; else if (y < stemTop + 9 && bayer(x, y) < 0.5) i -= 1;
        if (h2(x, y, 31) > 0.985 && y > stemTop + 9) i -= 1;
        set(x, y, ST[clamp(i, 0, 5)], tg('stem', ST[2]));
      }
    }
    // the round door, sunk a little into the ground, with a round knob in the middle and a step
    const dx = X + w / 2; const dr = Math.round(w * 0.11) + 2; const dyc = base - Math.round(dr * 0.8);
    const D = o.kid ? ramp(o.cap || '#ff6b6b', 2, 3) : [WD[1], WD[2], WD[3], WD[4], WD[5]];
    for (let y = dyc - dr - 2; y < base; y += 1) for (let x = Math.floor(dx - dr - 2); x <= dx + dr + 2; x += 1) {
      const d = Math.hypot(x + 0.5 - dx, y + 0.5 - dyc);
      if (d > dr + 1.6) continue;
      if (d > dr) { set(x, y, d > dr + 0.8 ? WD[1] : WD[3], tg('door', WD[1])); continue; }
      const plank = Math.floor((x - dx + dr) / 3);
      let c = (x - Math.floor(dx - dr)) % 3 === 0 ? D[0] : plank % 2 ? D[2] : D[3];
      if (d < 2.2) c = d < 1.2 ? '#fff4b0' : '#e0a030';
      set(x, y, c, tg('door', D[1]));
    }
    for (let x = Math.floor(dx - dr - 3); x <= dx + dr + 3; x += 1) { set(x, base - 1, CR[4], tg('stone', CR[2])); set(x, base, CR[2], tg('stone', CR[2])); }
    // round windows either side, warm inside, a cross of white frame, a flower box under each
    const wr = w < 90 ? 5 : 6; const wy = dyc - Math.round(dr * 0.5);
    const off = Math.round((dr + stemW / 2) / 2) + 1;
    for (const wx of [Math.round(dx - off), Math.round(dx + off)]) {
      for (let y = wy - wr - 2; y <= wy + wr + 2; y += 1) for (let x = wx - wr - 2; x <= wx + wr + 2; x += 1) {
        const d = Math.hypot(x + 0.5 - wx, y + 0.5 - wy);
        if (d > wr + 1.6) continue;
        if (d > wr) { set(x, y, d > wr + 0.8 ? WD[1] : (o.kid ? cap[3] : WD[3]), tg('door', WD[1])); continue; }
        let c = y < wy ? '#fff2b0' : '#ffd070';
        if (Math.abs(x + 0.5 - wx) < 0.6 || Math.abs(y + 0.5 - wy) < 0.6) c = '#ffffff';
        else if (x < wx && y < wy && d > wr - 1.6) c = '#fffbe6';
        set(x, y, c, tg('glow', '#ffd070'));
      }
      for (let x = wx - wr - 1; x <= wx + wr + 1; x += 1) {
        set(x, wy + wr + 3, WD[4], tg('wood', WD[2])); set(x, wy + wr + 4, WD[2], tg('wood', WD[2]));
        if ((x + wy) % 2 === 0) { set(x, wy + wr + 2, CANDY[(x + 6) % 6][2], tg('fl', CANDY[(x + 6) % 6][1])); set(x, wy + wr + 1, CANDY[(x + 6) % 6][3], tg('fl', CANDY[(x + 6) % 6][1])); } else set(x, wy + wr + 2, '#6ac08a', tg('fl', '#4aa070'));
      }
    }
    // the cap: a dome, lit at the top left, big round white spots, the frilly gills below the rim
    const spots = [];
    const rnd = rng((X * 7 + Y) | 0);
    for (let tries = 0; spots.length < 7 && tries < 200; tries += 1) {
      const u = (rnd() - 0.5) * 1.6; const v = 0.2 + rnd() * 0.65;
      if (u * u + v * v > 0.8) continue;
      const r = 2.6 + rnd() * (w / 26);
      const sxp = ccx + u * crx; const syp = top + cry * (1 - v);
      if (spots.some(([qx, qy, qr]) => Math.hypot(qx - sxp, (qy - syp) * 1.25) < qr + r + 3)) continue;
      spots.push([sxp, syp, r]);
    }
    for (let y = top - 1; y < top + cry + 4; y += 1) {
      for (let x = Math.floor(ccx - crx - 1); x <= ccx + crx + 1; x += 1) {
        const u = (x + 0.5 - ccx) / crx; const v = (top + cry - (y + 0.5)) / cry;
        const inDome = v > 0 && u * u + v * v <= 1;
        const rimY = top + cry + Math.round(Math.cos(u * Math.PI * 4.5) * 0.8);
        if (inDome) {
          const l = -(u * 0.65) + (v - 0.5) * 0.9;
          const t = (bayer(x, y) - 0.5) * 0.25;
          const i = l > 0.45 + t ? 5 : l > 0.1 + t ? 4 : l > -0.3 + t ? 3 : l > -0.62 + t ? 2 : 1;
          let c = cap[clamp(i, 0, 6)];
          const s = spots.find(([qx, qy, r]) => Math.hypot(x + 0.5 - qx, (y + 0.5 - qy) * 1.25) < r);
          if (s) {
            const dd = Math.hypot(x + 0.5 - s[0] - 0.8, (y + 0.5 - s[1] + 0.8) * 1.25);
            c = l < -0.35 ? '#ecdcee' : dd > s[2] - 0.6 && x + 0.5 > s[0] ? '#f2e2f0' : '#ffffff';
          }
          if (v < 0.07) c = cap[1];
          set(x, y, c, tg('cap', cap[1]));
        } else if (y >= top + cry && y <= rimY + 3 && Math.abs(u) < 0.9) {
          // the frilly gills under the rim
          const g = (x + 1) % 3 === 0;
          set(x, y, g ? mix(cap[0], ST[1], 0.4) : mix(cap[1], ST[2], 0.5), tg('cap', cap[1]));
        }
      }
    }
    // a striped candy chimney poking up out of the cap, with a lip
    const [cx0, cy0] = chimneyOf({ x: X, y: Y, w, h });
    const sink = Math.round(domeY(cx0 + 3)) + 2;
    for (let y = cy0; y < sink; y += 1) for (let x = cx0 - 3; x <= cx0 + 3; x += 1) {
      const lip = y < cy0 + 2;
      if (!lip && (x < cx0 - 2 || x > cx0 + 2)) continue;
      const c = lip ? (y === cy0 ? (x < cx0 ? CR[5] : CR[4]) : (x < cx0 ? CR[4] : CR[2]))
        : (y - cy0) % 4 < 2 ? (x < cx0 ? '#ffffff' : '#e8e0f0') : (x < cx0 ? '#ff9ab8' : '#e4709a');
      set(x, y, c, tg('stone', '#c06090'));
    }
    if (o.kid) {
      // a heart over the door, a pennant on the cap in their color, flower pots by the step
      grid((x, y, c) => set(x, y, c, tg('fl', '#d04070')), Math.round(dx) - 3, dyc - dr - 8, ['.hh.hh.', 'hHhhhhh', '.hhhhh.', '..hhh..', '...h...'], { h: cap[3], H: cap[5] });
      const fx = Math.round(ccx - crx * 0.42); const fy = Math.round(domeY(fx)) + 2;
      for (let y = fy - 16; y < fy; y += 1) set(fx, y, WD[1], tg('wood', WD[1]));
      set(fx, fy - 17, '#ffd84a', tg('metal', '#c09020'));
      for (let y = 0; y < 6; y += 1) for (let x = 1; x <= 10 - y * 1.6; x += 1) set(fx + x, fy - 16 + y, y < 2 ? cap[5] : cap[3], tg('cloth', cap[1]));
      for (const fxx of [Math.round(dx - dr - 8), Math.round(dx + dr + 4)]) grid((x, y, c) => set(x, y, c, tg('fl', '#c04070')), fxx, base - 8, ['a.b.', 'aGbb', '.gG.', 'pppp', 'PPPp', '.pp.'], { a: CANDY[0][2], b: CANDY[2][2], G: '#6ac08a', g: '#4aa070', p: WD[3], P: WD[4] });
    }
    if (o.sign === 'note') {
      grid((x, y, c) => set(x, y, c, tg('wood', WD[1])), Math.round(dx) + dr + 4, dyc - 12, ['wwwwwww', 'wPPPPPw', 'wPPkkPw', 'wPPkPPw', 'wPkkPPw', 'wPkkPPw', 'wwwwwww', '...w...', '...w...'], { w: WD[2], P: '#fff4e6', k: INK });
    }
  }, { outline: edgeOf, soften: ['cap:' + cap[1]] });
}

// ---------- props ----------

/** The washing line, hung between two candy-cane posts with heart knobs (the clothes are the Forest Village's). */
function laundryRB(px, X, Y, w) {
  laundryB(px, X, Y, w);
  for (const x of [X, X + w - 4]) {
    propB(px, x - 3, Y, 10, 27, (b) => {
      for (let y = 2; y < 27; y += 1) for (let i = 0; i < 3; i += 1) {
        const red = (y + i) % 6 < 3;
        b.set(4 + i, y, red ? ['#ff9ab8', '#f06a96', '#d04a7a'][i] : ['#ffffff', '#f2eaf6', '#dcd0e4'][i], tg('wood', '#c04a78'));
      }
      for (let i = 1; i < 10; i += 1) { b.set(i, 0, CR[5], tg('wood', '#c04a78')); b.set(i, 1, i % 3 ? '#ffb0c8' : '#ffffff', tg('wood', '#c04a78')); b.set(i, 2, '#e07aa0', tg('wood', '#c04a78')); }
    }, { outline: sel });
  }
}

/** A candy stall: a scalloped striped awning, jars of sweets on a pastel counter. */
function stallRB(px, X, Y, pal = {}) {
  groundShadow(px, X + 22, Y + 31, 22, 3, 0.26);
  const A = ramp(pal.a || '#ff8787', 3, 2);
  propB(px, X, Y, 44, 33, (b) => {
    for (const x of [2, 40]) for (let y = 6; y < 33; y += 1) { b.set(x, y, (y % 4 < 2) ? '#ffffff' : A[2], tg('wood', A[1])); b.set(x + 1, y, (y % 4 < 2) ? '#e8e0f0' : A[1], tg('wood', A[1])); }
    for (let y = 20; y < 33; y += 1) for (let x = 3; x < 41; x += 1) {
      const top = y < 22;
      b.set(x, y, top ? (y === 20 ? WD[5] : WD[4]) : (x - 3) % 6 < 3 ? CANDY[5][3] : CANDY[5][2], tg('wood', WD[2]));
    }
    grid((x, y, c) => b.set(x, y, c, tg('glass', '#a898c8')), 5, 11, [
      '.gg....gg....gg....gg....gg....gg.',
      'gaag..gbbg..gccg..gddg..geeg..gaag',
      'gaAg..gbBg..gcCg..gdDg..geEg..gaAg',
      'gaag..gbbg..gccg..gddg..geeg..gaag',
      '.gg....gg....gg....gg....gg....gg.',
    ].map((r) => r.slice(0, 35)), { g: '#e8f4ff', a: CANDY[0][2], A: '#ffffff', b: CANDY[1][2], B: '#ffffff', c: CANDY[2][2], C: '#ffffff', d: CANDY[3][2], D: '#ffffff', e: CANDY[4][2], E: '#ffffff' });
    grid((x, y, c) => b.set(x, y, c, tg('candy', '#c05080')), 6, 16, ['.p.....y.....o.....', 'pPp...yYy...oOo....', '.p.....y.....o.....'], { p: CANDY[0][1], P: '#ffffff', y: CANDY[2][1], Y: '#ffffff', o: CANDY[4][1], O: '#ffffff' });
    // the awning: stripes, scalloped at the front edge
    for (let y = 0; y < 11; y += 1) for (let x = -2; x < 46; x += 1) {
      const u = (x + 2) % 8; const tipY = 8 + Math.round(Math.sin((u / 8) * Math.PI) * 2.5);
      if (y > tipY) continue;
      const stripe = Math.floor((x + 2) / 4) % 2;
      let c = stripe ? '#ffffff' : A[2];
      if (y === 0) c = stripe ? '#ffffff' : A[3];
      if (y >= tipY - 1) c = stripe ? '#e8e0f0' : A[1];
      b.set(x, y, c, tg('cloth', A[1]));
    }
  }, { outline: sel });
}

/** A swirly lollipop, 16 x 34. */
function lollipopRB(px, X, Y, c = '#ff6b6b') {
  groundShadow(px, X + 9, Y + 33, 5, 1.6, 0.24);
  const P = ramp(c, 2, 3);
  propB(px, X, Y, 16, 34, (b) => {
    for (let y = 14; y < 34; y += 1) { b.set(7, y, '#ffffff', tg('stick', '#c8bce0')); b.set(8, y, '#e4dcf0', tg('stick', '#c8bce0')); }
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
      if (!inEll(x, y, 8, 8, 7.6, 7.6)) continue;
      const a = Math.atan2(y + 0.5 - 8, x + 0.5 - 8) + Math.hypot(x + 0.5 - 8, y + 0.5 - 8) / 2.6;
      const sw = Math.floor(((a + Math.PI * 4) / Math.PI) * 2) % 2;
      const l = -((x + 0.5 - 8) * 0.6 + (y + 0.5 - 8) * 0.8) / 8;
      let col = sw ? (l > 0.1 ? '#ffffff' : '#f0e8f4') : P[l > 0.3 ? 3 : l > -0.3 ? 2 : 1];
      if (inEll(x, y, 5, 5, 2, 1.5)) col = '#ffffff';
      b.set(x, y, col, tg('candy', P[1]));
    }
    // a ribbon bow on the stick
    grid((x, y, cc) => b.set(x, y, cc, tg('cloth', P[1])), 4, 15, ['pp.pp', '.pPp.', '.p.p.'], { p: P[2], P: P[4] });
  }, { outline: sel });
}

/** A little spotted mushroom, 22 x 24. */
function mushroomRB(px, X, Y, c = '#ff6b6b') {
  groundShadow(px, X + 11, Y + 23, 8, 2, 0.24);
  const P = ramp(c, 3, 3);
  propB(px, X, Y, 22, 24, (b) => {
    for (let y = 10; y < 24; y += 1) for (let x = 7; x < 15; x += 1) b.set(x, y, x < 9 ? ST[5] : x < 12 ? ST[4] : ST[2], tg('stem', ST[2]));
    for (let y = 0; y < 13; y += 1) for (let x = 0; x < 22; x += 1) {
      const u = (x + 0.5 - 11) / 11; const v = (12 - y - 0.5) / 12;
      if (v < 0 || u * u + v * v > 1) continue;
      const l = -u * 0.6 + (v - 0.5) * 0.8;
      let col = P[l > 0.35 ? 5 : l > 0 ? 4 : l > -0.35 ? 3 : 2];
      if ([[6, 5, 2.4], [14, 4, 2], [11, 9, 1.8], [3, 9, 1.4], [18, 9, 1.4]].some(([qx, qy, r]) => Math.hypot(x + 0.5 - qx, y + 0.5 - qy) < r)) col = l > -0.2 ? '#ffffff' : '#ece0f0';
      if (y === 12) col = P[1];
      b.set(x, y, col, tg('cap', P[2]));
    }
  }, { outline: sel });
}

/** A cloud puff resting on the meadow, 32 x 16. */
function cloudRB(px, X, Y, tint = '#ffffff') {
  for (let x = 0; x < 30; x += 1) for (let y = 13; y < 17; y += 1) if (inEll(x, y, 16, 15, 14, 2.4)) px(X + x, Y + y, 'rgba(70,50,130,0.18)');
  propB(px, X, Y, 32, 16, (b) => {
    const puffs = [[9, 10, 7.5], [17, 7, 8.5], [25, 10, 6.5], [14, 12, 5]];
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 32; x += 1) {
      const p = puffs.find(([cx, cy, r]) => inEll(x, y, cx, cy, r, r * 0.8));
      if (!p) continue;
      const l = -((x + 0.5 - p[0]) * 0.5 + (y + 0.5 - p[1]) * 0.9) / p[2];
      const col = l > 0.4 ? CL[6] : l > -0.1 ? CL[5] : l > -0.5 ? CL[4] : CL[3];
      b.set(x, y, tint === '#ffffff' ? col : mix(col, tint, 0.35), tg('cloud', CL[3]));
    }
  }, { outline: edgeOf });
}

/** A cotton-candy tree inside the village, 32 x 40: a stripy trunk and a tall puffy crown. */
function candyTreeRB(px, X, Y, pal = {}) {
  groundShadow(px, X + 17, Y + 37, 13, 3, 0.24);
  const P = ramp(pal.G || '#ffd43b', 3, 3);
  propB(px, X, Y, 32, 40, (b) => {
    for (let y = 22; y < 40; y += 1) for (let x = 13; x < 19; x += 1) b.set(x, y, (y + x) % 6 < 3 ? (x < 16 ? '#ffffff' : '#ece4f4') : (x < 16 ? '#ff9ab8' : '#e4709a'), tg('wood', '#c06090'));
    const put = (x, y, c) => b.set(x, y, c, tg('floss', P[2]));
    crownInto(put, 9, 18, 8, P, 3); crownInto(put, 23, 18, 8, P, 4); crownInto(put, 16, 12, 10, P, 5);
  }, { outline: sel });
}

// ---------- whimsy ----------

/** A gumdrop garden: a raised bed of chocolate soil, two rows of sugared gumdrops sprouting leaves, a candy-stripe edge, 36 x 20 (foot [2, 8, 32, 11]). */
export function gumdropsRB(px, X, Y) {
  groundShadow(px, X + 18, Y + 18, 18, 3, 0.22);
  propB(px, X, Y, 36, 20, (b) => {
    // the bed: soft chocolate soil, a candy-striped board along the front
    for (let y = 8; y < 20; y += 1) for (let x = 0; x < 36; x += 1) {
      const e = inEll(x, y, 18, 13.5, 18, 6.6);
      if (!e) continue;
      if (y >= 16) { b.set(x, y, y === 16 ? ((x >> 1) % 2 ? '#ffffff' : '#ff9ab8') : y < 19 ? ((x >> 1) % 2 ? '#e8e0f0' : '#e4709a') : '#c05080', tg('wood', '#a04070')); continue; }
      b.set(x, y, h2(x, y, 3) > 0.75 ? '#8a5a6e' : y < 10 ? '#7a4c62' : '#634056', tg('wood', '#6a3a5a'));
    }
    const drops = [[7, 11, 0], [14, 11, 2], [21, 11, 4], [28, 11, 1], [10, 15, 3], [18, 15, 5], [25, 15, 0], [32, 15, 2]];
    drops.forEach(([cx, cy, k]) => {
      const C = CANDY[k];
      for (let y = cy - 6; y <= cy; y += 1) for (let x = cx - 4; x <= cx + 4; x += 1) {
        const u = (x + 0.5 - cx) / 3.8; const v = (cy + 0.5 - y) / 6.2;
        if (v < 0 || u * u + v * v > 1) continue;
        const l = -u * 0.7 + v * 0.55;
        let c = C[l > 0.5 ? 4 : l > 0.05 ? 3 : l > -0.35 ? 2 : 1];
        if (h2(x, y, k + 9) > 0.8) c = l > 0 ? '#ffffff' : C[4];
        b.set(x, y, c, tg('candy', C[1]));
      }
      b.set(cx, cy - 7, '#4aa070', tg('leaf', '#2a7050')); b.set(cx - 1, cy - 8, '#7ad09a', tg('leaf', '#2a7050')); b.set(cx + 1, cy - 8, '#6ac08a', tg('leaf', '#2a7050'));
    });
  }, { outline: sel, pad: 4 });
}

/** A marshmallow campfire: candy-stick logs, a pastel fire, marshmallows toasting on sticks, 28 x 22 (foot [4, 12, 20, 9]). */
export function campfireRB(px, X, Y) {
  // a warm glow on the grass
  for (let y = -4; y < 10; y += 1) for (let x = -6; x < 34; x += 1) { const e = ((x - 14) / 18) ** 2 + ((y - 17) / 7) ** 2; if (e < 1 && bayer(X + x, Y + y) < 0.6 - e * 0.5) px(X + x, Y + y + 6, 'rgba(255,220,150,0.22)'); }
  propB(px, X, Y, 28, 22, (b) => {
    // a ring of sugar stones
    for (let k = 0; k < 10; k += 1) { const a = (k / 10) * Math.PI * 2; const x = Math.round(14 + Math.cos(a) * 9); const y = Math.round(17 + Math.sin(a) * 3.4); grid((xx, yy, c) => b.set(xx, yy, c, tg('stone', CL[2])), x - 1, y - 1, ['ab', 'bc'], { a: '#ffffff', b: CL[4], c: CL[3] }); }
    // crossed logs, striped like candy sticks
    line(7, 18, 21, 14, (x, y, t) => { b.set(x, y, Math.floor(t * 6) % 2 ? '#ffffff' : '#b0784e', tg('wood', '#7a4a3a')); b.set(x, y + 1, '#8a5a40', tg('wood', '#7a4a3a')); });
    line(7, 14, 21, 18, (x, y, t) => { b.set(x, y, Math.floor(t * 6) % 2 ? '#ffffff' : '#c8885a', tg('wood', '#7a4a3a')); b.set(x, y + 1, '#8a5a40', tg('wood', '#7a4a3a')); });
    // the fire: pink, peach and lemon tongues
    grid((x, y, c) => b.set(x, y, c, tg('glow', '#ff8a6a')), 9, 2, [
      '....p.....',
      '...pp..p..',
      '..ppo..pp.',
      '..pooo.po.',
      '.ppoyo.oo.',
      '.poyyoooo.',
      'ppoyYyyoop',
      'poyyYYyyop',
      '.oyYYYYyo.',
      '..yyyyyy..',
    ], { p: '#ff7aa0', o: '#ffaa6a', y: '#ffe07a', Y: '#fffbe0' });
    // two marshmallows on sticks, leaning in
    line(0, 8, 8, 12, (x, y) => b.set(x, y, '#b0784e', tg('wood', '#7a4a3a')));
    grid((x, y, c) => b.set(x, y, c, tg('candy', '#d8c0c0')), -2, 5, ['www', 'wWw', 'wtt'], { w: '#ffffff', W: '#fff8f0', t: '#e8b07a' });
    line(27, 7, 20, 12, (x, y) => b.set(x, y, '#b0784e', tg('wood', '#7a4a3a')));
    grid((x, y, c) => b.set(x, y, c, tg('candy', '#d8c0c0')), 26, 4, ['www', 'wWw', 'ttw'], { w: '#ffc8dc', W: '#ffe4ee', t: '#e8a07a' });
  }, { outline: edgeOf, pad: 4 });
}

/** A cloud sheep curled up asleep on the grass, eyes shut, a z over it, 24 x 18 (foot [3, 9, 18, 8]). */
export function cloudsheepRB(px, X, Y) {
  groundShadow(px, X + 13, Y + 17, 11, 2, 0.22);
  propB(px, X, Y, 24, 18, (b) => {
    // the fleece: a heap of little cloud puffs
    const wool = [[12, 12, 5.2], [17, 12, 4.8], [8, 13, 3.8], [20, 14, 3.4], [8, 8, 3.2], [12.5, 6.5, 3.6], [17, 7, 3.4], [21, 10, 2.8]];
    for (let y = 0; y < 18; y += 1) for (let x = 0; x < 24; x += 1) {
      const p = wool.filter(([cx, cy, r]) => inEll(x, y, cx, cy, r, r)).sort((a, c) => c[1] + c[2] - a[1] - a[2])[0];
      if (!p) continue;
      const l = -((x + 0.5 - p[0]) * 0.55 + (y + 0.5 - p[1]) * 0.85) / p[2];
      // a soft seam where a puff sits in front of another
      const seam = !inEll(x, y, p[0], p[1], p[2] - 1, p[2] - 1) && y < p[1] - p[2] * 0.3 && wool.some((q) => q !== p && q[1] < p[1] && inEll(x, y, q[0], q[1], q[2], q[2]));
      b.set(x, y, seam ? CL[4] : l > 0.4 ? CL[6] : l > -0.15 ? CL[5] : l > -0.6 ? CL[4] : CL[3], tg('cloud', CL[3]));
    }
    // its sleepy face at the front, an ear, a pink cheek, eyes shut
    grid((x, y, c) => b.set(x, y, c, tg('body', '#5a3a6a')), 0, 9, ['ee...', '.hhh.', 'hhhhh', 'hsshh', 'hhhph', '.hhh.'], { h: '#a888b8', e: '#8a6a9a', s: '#3a2448', p: '#ff9ab8' });
    for (const x of [9, 13, 18]) b.set(x, 17, '#5a3a6a', tg('body', '#5a3a6a'));
  }, { outline: edgeOf, after: (b) => grid((x, y, c) => b.set(x, y, c), 15, -4, ['....ZZZ', '.....Z.', '....ZZZ', 'zzzz...', '..z....', '.z.....', 'zzzz...'], { z: '#8a74c0', Z: '#a898d8' }) });
}

/** A lollipop lamp post: a striped post holding up a glowing candy lamp, 12 x 40 (foot [4, 34, 5, 5]). */
export function lamppostRB(px, X, Y) {
  groundShadow(px, X + 7, Y + 39, 5, 1.6, 0.24);
  for (let y = -4; y < 14; y += 1) for (let x = -6; x < 18; x += 1) { const e = ((x - 6) / 11) ** 2 + ((y - 5) / 9) ** 2; if (e < 1 && bayer(X + x, Y + y) < 0.55 - e * 0.5) px(X + x, Y + y, 'rgba(255,240,200,0.3)'); }
  propB(px, X, Y, 12, 40, (b) => {
    for (let y = 12; y < 38; y += 1) { b.set(5, y, (y % 6) < 3 ? '#ffffff' : '#ff8ab0', tg('wood', '#c06090')); b.set(6, y, (y % 6) < 3 ? '#e8e0f0' : '#e4709a', tg('wood', '#c06090')); }
    for (let x = 3; x < 9; x += 1) { b.set(x, 38, CL[4], tg('stone', CL[2])); b.set(x, 39, CL[2], tg('stone', CL[2])); }
    // the lamp: a round swirl lollipop, glowing at its heart
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 12; x += 1) {
      if (!inEll(x, y, 6, 6, 5.8, 5.8)) continue;
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 6);
      const a = Math.atan2(y + 0.5 - 6, x + 0.5 - 6) + d / 2.2;
      const sw = Math.floor(((a + Math.PI * 4) / Math.PI) * 2) % 2;
      b.set(x, y, d < 2.4 ? '#fffbe0' : d < 3.6 ? '#ffe680' : sw ? '#ffffff' : '#b292ff', tg('glow', '#b292ff'));
    }
    grid((x, y, c) => b.set(x, y, c, tg('metal', '#c8a040')), 4, 11, ['yyyy', '.yy.'], { y: '#ffd84a' });
  }, { outline: edgeOf });
}

/** A rainbow snail: a spiral shell striped in the rainbow, a friendly face, a sugar trail, 22 x 14 (foot [3, 8, 14, 5]). */
export function snailRB(px, X, Y) {
  // its glittery trail behind it
  for (let x = -14; x < 2; x += 1) if (bayer(X + x, Y + 12) < 0.6) px(X + x, Y + 12 + (x % 3 === 0 ? 1 : 0), x % 4 === 0 ? '#ffffff' : 'rgba(255,255,255,0.55)');
  propB(px, X, Y, 22, 14, (b) => {
    // the body: a soft lilac foot along the ground, its head up at the front with feelers
    for (let x = 0; x < 20; x += 1) for (let y = 10; y < 14; y += 1) if (inEll(x, y, 10, 12, 10, 2.4)) b.set(x, y, y < 12 ? '#e4d4ff' : '#c4b0f0', tg('body', '#9a84d0'));
    for (let y = 4; y < 12; y += 1) for (let x = 15; x < 21; x += 1) if (inEll(x, y, 18, 8, 3, 4)) b.set(x, y, x < 18 ? '#eee2ff' : '#d4c4f8', tg('body', '#9a84d0'));
    b.set(17, 1, '#c4b0f0', tg('body', '#9a84d0')); b.set(17, 2, '#c4b0f0', tg('body', '#9a84d0')); b.set(17, 3, '#c4b0f0', tg('body', '#9a84d0')); b.set(16, 0, '#ff8ab0', tg('body', '#9a84d0'));
    b.set(20, 1, '#c4b0f0', tg('body', '#9a84d0')); b.set(20, 2, '#c4b0f0', tg('body', '#9a84d0')); b.set(20, 3, '#c4b0f0', tg('body', '#9a84d0')); b.set(21, 0, '#ff8ab0', tg('body', '#9a84d0'));
    b.set(18, 7, INK, 'face'); b.set(20, 7, INK, 'face'); b.set(19, 9, '#ff8ab0', 'face');
    // the shell: a spiral of the rainbow's colors
    for (let y = 0; y < 12; y += 1) for (let x = 2; x < 15; x += 1) {
      if (!inEll(x, y, 8.5, 6.2, 6.4, 6)) continue;
      const dx = x + 0.5 - 8.5; const dy = y + 0.5 - 6.2;
      const a = Math.atan2(dy, dx); const r = Math.hypot(dx, dy);
      const k = Math.floor((r + ((a + Math.PI) / (Math.PI * 2)) * 2.4) / 1.2);
      const B = BOW[((k % 6) + 6) % 6];
      const l = -(dx * 0.6 + dy * 0.8) / 6;
      b.set(x, y, B[l > 0.3 ? 3 : l > -0.3 ? 2 : 1], tg('shell', B[1]));
    }
  }, { outline: (t, side) => (String(t).startsWith('face') ? null : sel(t, side)) });
}

/** A sprinkle-cupcake fountain: a pleated cupcake-case basin of pink lemonade, a frosted cupcake in the middle with sprinkles, and a cherry spouting two arcs into the basin, 34 x 32 (foot [2, 18, 30, 13]). */
export function cupcakeRB(px, X, Y) {
  groundShadow(px, X + 18, Y + 30, 17, 3, 0.24);
  const P = ramp('#ff9ec0', 3, 3);
  propB(px, X, Y, 34, 32, (b) => {
    // the basin: a big round cupcake case, pleated blue, a white lip, pink lemonade inside
    for (let y = 17; y < 32; y += 1) for (let x = 0; x < 34; x += 1) {
      if (y < 23) {
        if (!inEll(x, y, 17, 21, 17, 4.6)) continue;
        if (inEll(x, y, 17, 21, 15, 3.2)) {
          const ring = Math.abs(Math.hypot((x + 0.5 - 17) / 2.6, y + 0.5 - 21.5) - 2.4) < 0.5;
          b.set(x, y, ring ? '#ffffff' : y < 21 ? P[5] : P[4], tg('water', P[3]));
        } else b.set(x, y, y < 21 ? '#ffffff' : '#f0e8f8', tg('cream', CL[3]));
        continue;
      }
      const half = 16.5 - (y - 23) * 0.4;
      if (Math.abs(x + 0.5 - 17) > half) continue;
      const pleat = Math.floor((x + 0.5 - 17 + half) / 3) % 2;
      const l = -(x + 0.5 - 17) / half;
      b.set(x, y, l > 0.2 ? (pleat ? CANDY[4][4] : CANDY[4][3]) : l > -0.5 ? (pleat ? CANDY[4][3] : CANDY[4][2]) : (pleat ? CANDY[4][2] : CANDY[4][1]), tg('wood', CANDY[4][0]));
    }
    // the cupcake in the middle: a little case, then a frosting swirl in three tiers
    for (let y = 15; y < 21; y += 1) for (let x = 11; x < 23; x += 1) {
      if (Math.abs(x + 0.5 - 17) > 5.5 - (y - 15) * 0.25) continue;
      b.set(x, y, (x % 2) ? CANDY[0][3] : CANDY[0][2], tg('wood', CANDY[0][0]));
    }
    for (let y = 5; y < 16; y += 1) for (let x = 9; x < 25; x += 1) {
      const tier = y < 8 ? 3.5 : y < 12 ? 5.5 : 7.2;
      if (Math.abs(x + 0.5 - 17) > tier) continue;
      const l = -(x + 0.5 - 17) / tier;
      b.set(x, y, (y === 7 || y === 11) ? '#f4c4dc' : l > 0.3 ? '#ffffff' : l > -0.4 ? '#fff0f6' : '#f0d0e2', tg('cream', P[2]));
    }
    [[12, 9], [15, 13], [20, 10], [22, 14], [14, 6], [18, 14], [11, 13], [19, 6], [16, 10]].forEach(([x, y], i) => b.set(x, y, CANDY[i % 6][1], tg('cream', P[2])));
    // the cherry on top
    grid((x, y, c) => b.set(x, y, c, tg('fruit', '#c02040')), 15, 1, ['.rr.', 'rRrr', 'rrrr', '.rr.'], { r: '#ff4a6a', R: '#ffc0cc' });
    b.set(17, 0, '#4aa070', tg('leaf', '#2a7050'));
  }, {
    outline: edgeOf,
    // the cherry spouts two arcs of lemonade that splash down into the basin
    after: (b) => {
      for (const dir of [-1, 1]) {
        for (let k = 0; k <= 14; k += 1) {
          const x = 17 + dir * (2 + k); const y = Math.round(1 + (k - 3) * (k - 3) * 0.11 - 0.9);
          if (Math.abs(x + 0.5 - 17) < 8 && y < 16) { if (k < 3 || y < 4) b.set(x, y - 1, k % 3 ? '#ffffff' : P[5]); continue; }
          b.set(x, y, k % 3 ? '#ffffff' : P[5]); b.set(x, y + 1, P[4]);
        }
        b.set(17 + dir * 15, 18, '#ffffff'); b.set(17 + dir * 16, 17, P[5]); b.set(17 + dir * 13, 17, '#ffffff');
      }
    },
  });
}

/** A star-catcher net leaning on its pole, a caught star glowing in the net bag, a jar of stars by its foot, 22 x 34 (foot [4, 28, 14, 5]). */
export function starnetRB(px, X, Y) {
  groundShadow(px, X + 11, Y + 33, 9, 1.8, 0.24);
  propB(px, X, Y, 22, 34, (b) => {
    // the pole
    line(12, 12, 9, 33, (x, y) => { b.set(x, y, WD[4], tg('wood', WD[2])); b.set(x + 1, y, WD[2], tg('wood', WD[2])); });
    // the net bag, hanging from the hoop: a lattice of sugar string
    for (let y = 3; y < 16; y += 1) for (let x = 2; x < 20; x += 1) {
      const half = 7.4 * Math.sqrt(Math.max(0, 1 - ((y - 3) / 13) ** 2));
      const cx = 11 - (y - 3) * 0.3;
      if (Math.abs(x + 0.5 - cx) > half) continue;
      if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) b.set(x, y, Math.abs(x + 0.5 - cx) > half - 1.2 || y > 13 ? '#b8a4dc' : '#f4f0ff', tg('net', '#b8a8d8'));
    }
    // the star caught in it
    grid((x, y, c) => b.set(x, y, c, tg('glow', '#ffc83c')), 6, 6, ['..y..', '.yYy.', 'yYYYy', '.yyy.', '.y.y.'], { y: '#ffe060', Y: '#fffbe0' });
    // the hoop, seen a little from above
    for (let y = 0; y < 7; y += 1) for (let x = 2; x < 21; x += 1) {
      if (inEll(x, y, 11, 3, 8.6, 3.2) && !inEll(x, y, 11, 3, 7.2, 1.8)) b.set(x, y, y < 3 ? '#ffe27a' : '#e8a42a', tg('metal', '#b07020'));
    }
    // a little jar of caught stars
    grid((x, y, c) => b.set(x, y, c, tg('glass', '#9a8ac8')), 13, 24, ['.ccc.', 'gGggg', 'gyGyg', 'gYyyg', 'gyyYg', 'ggggg'], { c: '#ff9ab8', g: '#d8ecff', G: '#ffffff', y: '#ffe680', Y: '#fffbe0' });
    for (let x = 6; x < 13; x += 1) b.set(x, 33, CL[3], tg('stone', CL[2]));
  }, { outline: edgeOf });
}

// ---------- the whole village ----------

export function paintRainbow(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 8807;
  const PROPS = lib.PROPS || {};
  const areas = opts.areas || [];
  const lm = L.landmark;
  const riverF = pathField(L.water.map((wa) => wa.pts), 40);
  const inArea = (x, y, pad) => areas.some((a) => x > a.x - pad && x < a.x + a.w + pad && y > a.y - pad && y < a.y + a.h + pad);
  const inLandmark = (x, y) => lm && lm.w && x > lm.x - 4 && x < lm.x + lm.w + 4 && y > lm.y + lm.h * 0.6 && y < lm.y + lm.h;

  groundRB(px, L, seed);
  const busy = (x, y) => L.blocked(x, y, 4) || L.onPath(x, y, 9) || L.inWater(x, y, 8) || inArea(x, y, 8) || inLandmark(x, y);
  scatterRB(px, L, seed + 1, busy);
  pathsRB(px, L, seed + 2);
  L.plazas.forEach(([x, y, r], i) => plazaRB(px, x, y, r, seed + 40 + i));
  const depths = L.water.map((wa, i) => riverRB(px, L, wa, seed + 60 + i));
  const nearBridge = (x, y) => L.crossings.some((c) => x > c.x - 8 && x < c.x + c.w + 8 && y > c.y - 8 && y < c.y + c.h + 8);
  depths.forEach((d, i) => riverEdgeRB(px, L, d, seed + 66 + i, (x, y) => !nearBridge(x, y) && !inArea(x, y, 6) && Math.min(x, L.W - x, L.H - y, y) > 26));
  areas.forEach((a, i) => {
    if (a.kind === 'pond') lemonadePondRB(px, a, seed + 70 + i);
    else if (a.kind === 'hockey') iceRinkRB(px, a, seed + 70 + i);
    else sugarFieldRB(px, a, a.kind, seed + 70 + i);
  });
  L.crossings.forEach((c) => bridgeRB(px, c));
  wallRB(px, L, seed + 100, (x, y) => riverF(x, y).d < 18);

  // the border trees are the candy wall itself: only the trees inside it are drawn
  const border = (p) => p.kind === 'candytree' && (p.x < 20 || p.x + PROPS.candytree.w > L.W - 20 || p.y < 20 || p.y + PROPS.candytree.h > L.H - 14);
  const DRAW = {
    stall: (p) => stallRB(px, p.x, p.y, p.pal),
    laundry: (p) => laundryRB(px, p.x, p.y, p.w || 84),
    lollipop: (p) => lollipopRB(px, p.x, p.y, p.c),
    mushroom: (p) => mushroomRB(px, p.x, p.y, p.c),
    cloud: (p) => cloudRB(px, p.x, p.y, p.c),
    candytree: (p) => candyTreeRB(px, p.x, p.y, p.pal),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  const props = L.props.filter((p) => !border(p));
  const under = (p) => areas.some((a) => p.x < a.x + a.w + 6 && p.x + (p.w || PROPS[p.kind].w) > a.x - 6 && p.y < a.y + a.h + 6 && p.y + (p.h || PROPS[p.kind].h) > a.y - 6);
  props.filter((p) => PROPS[p.kind]?.flat && !under(p)).forEach(draw);
  const home = L.home;
  const stand = [
    { y: home.y + home.h, draw: () => cottageRB(px, home.x, home.y, home.w, home.h, { cap: opts.homeRoof || '#ff6b6b', kid: true }) },
    ...L.houses.map((hs) => ({ y: hs.y + hs.h, draw: () => cottageRB(px, hs.x, hs.y, hs.w, hs.h, { cap: hs.roof, sign: hs.sign }) })),
    ...props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  stand.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
