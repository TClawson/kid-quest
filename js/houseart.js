// The buddy's house inside, in the village's soft storybook style (style B, like
// meadowart.js): warm hue-shifted ramps, ordered dithering, and selective outlines (each
// thing edged in a darker shade of its own color, near-black only where it meets the floor).
// One art pixel per village pixel, so the room lines up with the buddy's pixels.
//
// A single room plus a bathroom, seen from above and a little in front like the village:
// the back wall stands up at the top, the floor runs down to the front wall and its door.
// paintRoom() paints the room and everything against its walls into one canvas; pieces that
// stand out on the floor (the table, the cozy chair, the hammock, the gear rack...) come
// back as their own little canvases, so the buddy can walk behind them (house.js sorts them).

import { ramp, mix, h2, vnoise, bayer, Buf, grid, inEll, pixelBuffer } from './pixelkit.js';
import { HOME_COLORS, furnitureById } from './furniture.js';

export const INK = '#3b2235';
const WD = ['#4a2a36', '#7a4436', '#a8663e', '#cc8a50', '#e8b674', '#f8dca0'];
const FLR = ['#5e3832', '#82523c', '#a46e48', '#bc8654', '#d4a066', '#e8be84', '#f6dca8'];
const WP = ['#b0948a', '#d2b6a4', '#e8d2bc', '#f4e4cc', '#fdf2e0'];
const SAGE = ['#3e5650', '#56705e', '#6e8a70', '#8aa686', '#a8c2a0', '#cadcbc'];
const CAP = ['#2e1e2a', '#46303a', '#5e4044', '#78564e', '#94705e'];
const TILE = ['#4e7a8a', '#78aab4', '#a6d0d2', '#cce8e4', '#eaf8f4', '#ffffff'];
const CHROME = ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde', '#ffffff'];
const PORC = ['#94788c', '#c9aeb2', '#e8d6cc', '#fbf0e0', '#fffaf0', '#ffffff'];
const LEAF = ['#244a40', '#33704a', '#4a9450', '#6cb85a', '#9ed46a', '#d0ec8c'];
const GOLD = ['#7a4a1e', '#a8701e', '#d89a2a', '#f0c040', '#ffe27a', '#fff6c8'];
const SILVER = ['#5a5670', '#86829c', '#b0aec0', '#d8d6e0', '#f4f2f8'];
const SKY = ['#4f8ad8', '#6ea8e8', '#9ccaf4', '#d4ecfc'];
const GLOW = ['#c86a3a', '#f0a848', '#ffd878', '#fff4c8'];

// ---------- the room's plan (village pixels) ----------

export const ROOM = {
  W: 320, H: 184,
  floorTop: 48, // the floor line: the back wall stands above it
  floorBottom: 174, // the front wall's top edge
  partition: { x: 236, w: 8, gapTop: 64, gapBottom: 102 }, // the wall between the room and the bathroom, with a doorway
  door: { x: 100, w: 24 }, // the way out, in the front wall
  mat: { x: 99, y: 161, w: 26, h: 10 },
  // where each piece stands: its art's top-left corner
  at: {
    bed: { x: 10, y: 20 },
    window: { x: 50, y: 11 },
    shelf: { x: 84, y: 8 },
    chart: { x: 124, y: 11 },
    couch: { x: 152, y: 25 },
    art: { x: 164, y: 8 },
    lamp: { x: 204, y: 14 },
    table: { x: 92, y: 92 }, // centered on 120
    chair: { x: 190, y: 96 },
    corner: { x: 10, y: 128 },
    gear: { x: 194, y: 134 },
    rug: { x: 84, y: 88 },
    sink: { x: 252, y: 10 },
    towel: { x: 273, y: 18 },
    shower: { x: 287, y: 6 },
    bathmat: { x: 252, y: 66 },
    basket: { x: 292, y: 148 },
    tank: { x: 132, y: 133 }, // the fish tank on its cabinet, against the front wall right of the door
  },
};
const R = ROOM;

// ---------- drawing helpers ----------

const edgeCache = new Map();
/** A darker shade of a color for its outline: deeper on the shaded (bottom, right) sides. */
function edgeOf(c, side) {
  const k = `${c}|${side}`;
  if (!edgeCache.has(k)) edgeCache.set(k, mix(c.slice(0, 7), INK, side === 'bottom' || side === 'right' ? 0.55 : 0.36));
  return edgeCache.get(k);
}

/**
 * A sprite: draw(b) paints it into a buffer, then it gets selective outlines worked out from
 * its silhouette (ink only along its very bottom, where it stands on the floor). Cells tagged
 * 'soft' (glows, shadows, light) never get an outline.
 */
export function sprite(w, h, draw, o = {}) {
  const b = new Buf(w, h, o.pad ?? 3);
  draw(b);
  const marks = [];
  const solid = (x, y) => b.get(x, y) && b.tag(x, y) !== 'soft';
  b.each((x, y) => {
    if (b.get(x, y)) return;
    let side; let c;
    if (solid(x, y - 1)) { side = 'bottom'; c = b.get(x, y - 1); } else if (solid(x - 1, y)) { side = 'right'; c = b.get(x - 1, y); } else if (solid(x, y + 1)) { side = 'top'; c = b.get(x, y + 1); } else if (solid(x + 1, y)) { side = 'left'; c = b.get(x + 1, y); } else return;
    const ground = o.ground !== false && side === 'bottom' && y >= h - 1 - (o.inkUp || 0);
    marks.push([x, y, ground ? INK : edgeOf(c, side)]);
  });
  marks.forEach(([x, y, c]) => b.set(x, y, c, 'edge'));
  if (o.after) o.after(b);
  b.w = w; b.h = h;
  return b;
}

/** A soft shadow on the floor (see-through). */
export function shadow(px, cx, cy, rx, ry, a = 0.22) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1) px(x, y, `rgba(42,24,56,${d < 0.5 ? a : a * 0.55})`);
    }
  }
}

const rampCache = new Map();
/** The shaded ramp for a furniture color name (or a hex color): 6 shades, base at 3. */
function rampOf(c) {
  const hex = HOME_COLORS[c]?.c || c;
  if (!rampCache.has(hex)) rampCache.set(hex, ramp(hex, 3, 2));
  return rampCache.get(hex);
}
// a second color that goes with each fabric, for stripes and patchwork
const PARTNER = { red: 'cream', orange: 'cream', yellow: 'orange', green: 'yellow', teal: 'cream', blue: 'yellow', purple: 'pink', pink: 'cream', cream: 'red', brown: 'cream' };

/**
 * Fabric: the color of cloth with a look { c, p } at (x, y), shade k (-2 deep shadow .. +2
 * light). Patterns: plain, stripes, checks, dots, flowers, patch, stars.
 */
function fabric(look, x, y, k = 0) {
  const F = rampOf(look.c);
  const P = rampOf(PARTNER[look.c] || 'cream');
  const s = (i) => F[Math.max(0, Math.min(5, 3 + k + i))];
  const ps = (i) => P[Math.max(0, Math.min(5, 3 + k + i))];
  switch (look.p) {
    case 'stripes': return Math.floor(x / 2) % 3 === 0 ? ps(0) : s(0);
    case 'checks': { const a = Math.floor(x / 3) % 2; const b = Math.floor(y / 3) % 2; return a && b ? s(-1) : a || b ? s(0) : ps(1); }
    case 'dots': return (x % 4 === 1 && y % 4 === 1) || (x % 4 === 3 && y % 4 === 3) ? ps(2) : s(0);
    case 'flowers': { const fx = x % 6; const fy = y % 6; const off = Math.floor(y / 6) % 2 ? 3 : 0; const gx = (x + off) % 6; if (fy === 2 && gx === 2) return '#ffe27a'; if ((Math.abs(gx - 2) + Math.abs(fy - 2)) === 1) return ps(2); return fx === 5 && fy === 5 ? s(-1) : s(0); }
    case 'patch': { const q = (Math.floor(x / 5) + Math.floor(y / 5) * 3) % 3; const c = q === 0 ? s(0) : q === 1 ? ps(0) : s(1); return x % 5 === 0 || y % 5 === 0 ? mix(c, '#fffaf0', 0.35) : c; }
    case 'stars': { const gx = (x + (Math.floor(y / 5) % 2) * 3) % 6; const gy = y % 5; if (gx === 2 && gy === 2) return '#fff4c8'; if ((gx === 2 && (gy === 1 || gy === 3)) || (gy === 2 && (gx === 1 || gx === 3))) return '#ffd878'; return s(0); }
    default: return s(0);
  }
}

// ---------- the room itself ----------

/** The back wall: a wood cap along the top, warm wallpaper, a sage wainscot and baseboard. */
function backWall(px) {
  const { W } = R; const ft = R.floorTop;
  const px0 = R.partition.x; const px1 = px0 + R.partition.w;
  for (let y = 0; y < ft; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const bath = x >= px1;
      let c;
      if (y < 5) c = y === 0 ? CAP[1] : y === 4 ? CAP[0] : (x + y) % 9 === 0 ? CAP[3] : CAP[2];
      else if (bath) {
        // tiles in the bathroom: 6 x 6, light grout, a darker band at the bottom
        const ty = y - 5; const tx = x - px1;
        const band = y >= ft - 10;
        const g = ty % 6 === 5 || tx % 6 === 5;
        const T = band ? [TILE[1], TILE[2], TILE[3]] : [TILE[2], TILE[3], TILE[4]];
        c = g ? (band ? TILE[3] : TILE[5]) : (tx % 6 === 0 || ty % 6 === 0) ? T[2] : (tx % 6 === 4 || ty % 6 === 4) ? T[0] : T[1];
        if (!g && h2(Math.floor(tx / 6), Math.floor(ty / 6), 7) < 0.15) c = mix(c, TILE[1], 0.3);
      } else if (y >= ft - 16) {
        // the wainscot: tongue-and-groove boards, a rail on top, a baseboard at the foot
        if (y === ft - 16) c = SAGE[5];
        else if (y === ft - 15) c = SAGE[3];
        else if (y >= ft - 3) c = y === ft - 3 ? WD[4] : y === ft - 1 ? WD[1] : WD[2];
        else c = x % 6 === 0 ? SAGE[1] : x % 6 === 1 ? SAGE[4] : (y < ft - 12 ? SAGE[3] : SAGE[2]);
      } else {
        // wallpaper: soft stripes with tiny sprigs
        const st = x % 10;
        c = st < 2 ? WP[2] : WP[3];
        if (st === 6 && y % 8 === 3) c = '#e8a8a0';
        if (st === 6 && y % 8 === 4) c = SAGE[3];
        if (st === 2 && y % 2 === 0) c = WP[2];
        // shadow under the cap
        if (y < 9 && bayer(x, y) < (9 - y) / 5) c = WP[1];
      }
      px(x, y, c);
    }
  }
}

/** The floors: honey planks in the room, checked tiles in the bathroom, a shadow along the walls. */
function floors(px) {
  const ft = R.floorTop; const fb = R.floorBottom;
  const px1 = R.partition.x + R.partition.w;
  for (let y = ft; y < fb; y += 1) {
    for (let x = 0; x < R.W; x += 1) {
      let c;
      if (x >= px1) {
        const tx = x - px1; const ty = y - ft;
        const g = tx % 8 === 7 || ty % 8 === 7;
        const dark = (Math.floor(tx / 8) + Math.floor(ty / 8)) % 2;
        c = g ? '#c8dcd8' : dark ? (tx % 8 < 1 || ty % 8 < 1 ? '#c4e0e0' : '#b2d4d6') : (tx % 8 < 1 || ty % 8 < 1 ? '#fffaf0' : '#eef4ec');
      } else {
        // planks run across, 5 px tall, with staggered joints and a little grain
        const row = Math.floor((y - ft) / 5); const yy = (y - ft) % 5;
        const off = Math.floor(h2(row, 3, 11) * 40);
        const len = 34 + Math.floor(h2(row, 5, 11) * 18);
        const seg = Math.floor((x + off) / len);
        const at = (x + off) % len;
        const tone = h2(seg, row, 5);
        let k = tone < 0.22 ? 3 : tone > 0.82 ? 5 : 4;
        if (yy === 4) k = 2; // the gap between rows
        else if (yy === 0) k += 1;
        else if (vnoise(x * 0.5, y * 3, 6, row) > 0.72) k -= 1; // grain
        if (at === 0 && yy !== 4) k = 2; // a joint
        if (h2(seg, row, 9) < 0.08 && at === 9 && yy === 2) k = 1; // a knot
        c = FLR[Math.max(0, Math.min(6, k))];
      }
      // ambient shadow along the back wall and the sides
      const dy = y - ft;
      if (dy < 6 && bayer(x, y) < (6 - dy) / 7) c = mix(c, INK, 0.28);
      if ((x < 10 || (x >= px1 && x < px1 + 5)) && bayer(x, y) < (x < 10 ? (10 - x) / 12 : (px1 + 5 - x) / 8)) c = mix(c, INK, 0.2);
      px(x, y, c);
    }
  }
}

/** Window light falling on the floor (dithered warm patches). */
function sunlight(px) {
  const w = R.at.window;
  for (let y = R.floorTop + 2; y < R.floorTop + 40; y += 1) {
    const t = (y - R.floorTop) / 40;
    const x0 = w.x + 2 + Math.round(t * 18); const x1 = w.x + 24 + Math.round(t * 22);
    for (let x = x0; x < x1; x += 1) if (bayer(x, y) < 0.5 - t * 0.4) px(x, y, 'rgba(255,240,190,0.14)');
  }
}

/** The side walls and the front wall (seen from above: their tops), with the doorway. */
function frontWalls(px, doorColor) {
  const { W, H } = R; const fb = R.floorBottom;
  const capC = (x, y, w) => (y === 0 || x === 0 ? CAP[3] : (x === w - 1) ? CAP[0] : CAP[2]);
  // side walls
  for (let y = 0; y < H; y += 1) for (let x = 0; x < 6; x += 1) { px(x, y, x === 5 ? CAP[1] : x === 0 ? CAP[0] : CAP[2]); px(W - 1 - x, y, x === 5 ? CAP[3] : x === 0 ? CAP[0] : CAP[2]); }
  // the front wall: a cap strip, with a darker face below it
  const d = R.door;
  for (let y = fb; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (x >= d.x && x < d.x + d.w) continue;
      const yy = y - fb;
      px(x, y, yy === 0 ? CAP[4] : yy < 6 ? ((x + yy) % 11 === 0 ? CAP[3] : CAP[2]) : yy === 6 ? CAP[0] : CAP[1]);
    }
  }
  // the doorway: a stone step, and the morning outside
  const D = ramp(doorColor, 3, 2);
  for (let y = fb; y < H; y += 1) {
    for (let x = d.x; x < d.x + d.w; x += 1) {
      const yy = y - fb;
      let c = yy < 3 ? (yy === 0 ? '#e2ddde' : '#c0bcc8') : (h2(x, y, 3) < 0.2 ? '#7bd66b' : '#68bf55');
      if (yy >= 3 && bayer(x, y) < 0.3) c = '#8dd263';
      px(x, y, c);
    }
  }
  // the open door, swung in against the wall to the right of the doorway
  for (let y = fb - 2; y < H; y += 1) for (let x = d.x + d.w; x < d.x + d.w + 4; x += 1) px(x, y, x === d.x + d.w ? D[4] : x === d.x + d.w + 3 ? D[1] : D[3]);
  px(d.x + d.w + 1, fb + 4, GOLD[3]);
  // door posts
  for (let y = fb - 1; y < H; y += 1) { px(d.x - 1, y, WD[2]); px(d.x - 2, y, WD[1]); }
}

/** The wall between the room and the bathroom, with an open doorway. */
function partition(px) {
  const p = R.partition;
  for (let y = 0; y < R.floorBottom; y += 1) {
    if (y >= p.gapTop && y < p.gapBottom) continue;
    for (let x = p.x; x < p.x + p.w; x += 1) {
      const xx = x - p.x;
      let c = xx === 0 ? CAP[3] : xx === p.w - 1 ? CAP[0] : (y + xx) % 13 === 0 ? CAP[3] : CAP[2];
      if (y === p.gapBottom) c = CAP[4];
      if (y === p.gapTop - 1) c = CAP[0];
      px(x, y, c);
    }
  }
  // the door frame on the floor between them
  for (let x = p.x; x < p.x + p.w; x += 1) for (let y = p.gapTop; y < p.gapBottom; y += 1) px(x, y, (y - p.gapTop) % 5 === 4 ? FLR[2] : FLR[4]);
}

// ---------- things on the walls ----------

function windowArt() {
  return sprite(26, 25, (b) => {
    // frame, sky with a cloud and a far hill, crossbars
    b.rect(0, 0, 26, 2, WD[4]); b.rect(0, 2, 26, 1, WD[2]);
    for (let y = 3; y < 21; y += 1) {
      for (let x = 2; x < 24; x += 1) {
        let c = y < 9 ? SKY[1] : y < 14 ? SKY[2] : SKY[3];
        if (inEll(x, y, 9, 8, 4, 1.6) || inEll(x, y, 12, 7, 3, 1.6)) c = '#ffffff';
        if (y > 15 - Math.round(Math.sin(x / 4) * 1.5)) c = y > 18 ? LEAF[2] : LEAF[3];
        if (x === 12 || x === 13) c = WD[3];
        if (y === 11) c = WD[3];
        if (x === 13 || y === 12) c = x === 13 && y === 12 ? WD[2] : (x === 13 ? WD[2] : WD[2]);
        b.set(x, y, c);
      }
    }
    for (let y = 3; y < 21; y += 1) { b.set(0, y, WD[4]); b.set(1, y, WD[3]); b.set(24, y, WD[2]); b.set(25, y, WD[1]); }
    // curtains, tied back
    const C = rampOf('#e8846a');
    for (let y = 0; y < 21; y += 1) {
      const wl = y < 10 ? 4 : y < 14 ? 3 - (y - 10 > 1 ? 1 : 0) : 3;
      for (let x = 0; x < wl; x += 1) b.set(-2 + x, y, x === 0 ? C[2] : (x + y) % 3 ? C[3] : C[4]);
      for (let x = 0; x < wl; x += 1) b.set(27 - x, y, x === 0 ? C[1] : (x + y) % 3 ? C[2] : C[3]);
    }
    b.set(-1, 11, GOLD[3]); b.set(26, 11, GOLD[3]);
    // the sill with a little flower pot
    b.rect(-1, 21, 28, 2, WD[4]); b.rect(-1, 23, 28, 1, WD[1]);
    grid((x, y, c) => b.set(x, y, c), 18, 15, ['.r.r.', 'rRrRr', '.gLg.', '.ppp.', '.PPP.', '..P..'], { r: '#e0546a', R: '#ff9a9a', g: LEAF[2], L: LEAF[4], p: '#e08a5a', P: '#b05a3a' });
  }, { ground: false });
}

/** The leaderboard chart pinned on the wall: a paper with colored bars and a star. */
function chartArt() {
  return sprite(22, 26, (b) => {
    const P = ['#d8c8a8', '#efe2c4', '#fbf4e2', '#fffdf4'];
    for (let y = 0; y < 26; y += 1) for (let x = 0; x < 22; x += 1) {
      let c = P[2];
      if (x === 21 || y === 25) c = P[0];
      else if (x === 20 || y === 24) c = P[1];
      if (y >= 22 && x >= 17 && x + y >= 40) c = null; // a curled corner
      if (y >= 22 && x >= 17 && x + y === 39) c = P[1];
      b.set(x, y, c);
    }
    // the title strip and a gold star
    b.rect(2, 2, 18, 3, '#3e6ab0'); b.rect(2, 2, 18, 1, '#6ea0f0');
    grid((x, y, c) => b.set(x, y, c), 9, 5, ['..y..', 'yYYYy', '.yYy.', '.y.y.'], { y: GOLD[3], Y: GOLD[4] });
    // bars: one per kid
    const bars = [[3, 9, '#e0546a'], [7, 13, '#f0a848'], [11, 7, '#4a9a50'], [15, 11, '#6ea0f0']];
    for (const [x, hgt, c] of bars) { const C = ramp(c, 1, 1); for (let y = 21 - hgt; y < 21; y += 1) { b.set(x, y, C[1]); b.set(x + 1, y, C[1]); b.set(x + 2, y, C[0]); } b.set(x, 21 - hgt, C[2]); b.set(x + 1, 21 - hgt, C[2]); }
    b.rect(2, 21, 18, 1, '#b0948a');
    // pins
    b.set(1, 0, '#e03131'); b.set(20, 0, '#4dabf7');
  }, { ground: false });
}

/** Wall art: a framed picture. look.p is the scene. */
function pictureArt(look) {
  return sprite(26, 20, (b) => {
    const F = rampOf(look.c === 'cream' ? 'brown' : 'yellow');
    const scene = (x, y) => {
      switch (look.p) {
        case 'sunset': { if (inEll(x, y, 11, 10, 4, 4) && y < 11) return '#ffe27a'; if (y > 11) return y % 3 === 0 ? '#e8846a' : '#3e6ab0'; return y < 4 ? '#7a4ab0' : y < 7 ? '#e0709a' : '#f0a848'; }
        case 'mountain': { const peak = 4 + Math.abs(x - 8) * 0.9; const peak2 = 6 + Math.abs(x - 15) * 1.1; if (y > 12) return LEAF[3]; if (y >= Math.min(peak, peak2)) return y < Math.min(peak, peak2) + 2 ? '#ffffff' : '#7a86a8'; return SKY[2]; }
        case 'flower': { if (y > 11) return '#a8663e'; if (inEll(x, y, 11, 6, 3, 3)) return (x + y) % 2 ? '#ffd23f' : '#f0a020'; if (x === 11 && y > 8) return LEAF[2]; if (inEll(x, y, 13, 10, 2, 1)) return LEAF[3]; return '#f8e8f0'; }
        case 'fish': { if (inEll(x, y, 11, 7, 5, 3)) return x > 13 ? '#ff9a5a' : '#f06a3a'; if (x > 15 && x < 19 && Math.abs(y - 7) <= x - 15) return '#f06a3a'; if (y > 12) return '#e8cc90'; return (x + y * 3) % 11 === 0 ? '#cdeefc' : '#4f9ad8'; }
        case 'boat': { if (y > 10) return y % 2 ? '#3878c4' : '#4f9ad8'; if (y > 8 && x > 5 && x < 17) return '#a8663e'; if (x === 11 && y < 9) return '#4a2a36'; if (x > 11 && x < 11 + (9 - y) && y > 1) return '#ffffff'; if (x < 11 && x > 11 - (9 - y) * 0.7 && y > 3) return '#e0546a'; return SKY[3]; }
        case 'night': { if (y > 12) return '#2a3f6a'; if (inEll(x, y, 16, 4, 2.5, 2.5) && !inEll(x, y, 17, 3.5, 2, 2)) return '#fff4c8'; return h2(x, y, 4) < 0.07 ? '#fff4c8' : y < 6 ? '#2a2458' : '#3a3a7a'; }
        case 'map': { if ((x === 6 && y > 3 && y < 9) || (y === 6 && x > 3 && x < 9)) return '#a8663e'; if ((x - y === 10 || x + y === 22) && x > 12 && x < 17 && y > 4 && y < 10) return '#e03131'; if ((x + y) % 4 === 0 && y > 9 && x < 12) return '#a8663e'; return (x * 7 + y * 3) % 13 === 0 ? '#e8cc90' : '#f6e2b4'; }
        case 'rainbow': { const d = Math.hypot(x - 11, y - 14); const bands = ['#e0546a', '#f0a848', '#ffd23f', '#6cb85a', '#4f9ad8', '#7a4ab0']; const i = Math.floor(11 - d); if (i >= 0 && i < 6 && y < 14) return bands[i]; if (inEll(x, y, 4, 13, 3, 1.5) || inEll(x, y, 18, 13, 3, 1.5)) return '#ffffff'; return SKY[3]; }
        default: return SKY[2];
      }
    };
    for (let y = 0; y < 20; y += 1) {
      for (let x = 0; x < 26; x += 1) {
        const inner = x >= 3 && x < 23 && y >= 3 && y < 17;
        if (inner) b.set(x, y, scene(x - 2, y - 2));
        else b.set(x, y, y === 0 || x === 0 ? F[5] : y === 19 || x === 25 ? F[1] : (y === 2 || x === 2) ? F[2] : (x === 23 || y === 17) ? F[4] : F[3]);
      }
    }
  }, { ground: false });
}

/** The bathroom mirror over the sink. */
function mirrorArt() {
  return sprite(16, 13, (b) => {
    for (let y = 0; y < 13; y += 1) for (let x = 0; x < 16; x += 1) {
      if (!inEll(x, y, 8, 6.5, 8, 6.5)) continue;
      const rim = !inEll(x, y, 8, 6.5, 6.8, 5.3);
      b.set(x, y, rim ? (x + y < 12 ? CHROME[4] : CHROME[2]) : (x - y > 2 && x - y < 6 ? '#eaf8f4' : x < 6 ? TILE[3] : TILE[2]));
    }
  }, { ground: false });
}

function towelArt() {
  return sprite(13, 20, (b) => {
    b.rect(0, 0, 13, 2, CHROME[3]); b.rect(0, 1, 13, 1, CHROME[2]);
    const T = rampOf('#e8846a');
    for (let y = 2; y < 19; y += 1) for (let x = 1; x < 12; x += 1) {
      let c = x < 3 ? T[4] : x > 9 ? T[2] : T[3];
      if (y === 14 || y === 15) c = '#fff4e6';
      if (y === 18) c = x % 2 ? T[2] : null;
      b.set(x, y, c);
    }
  }, { ground: false });
}

// ---------- the trophy shelf ----------

// little trophies and treasures, 5-6 px wide, for the shelf
const TROPHY_MINI = [
  [['y.yyy.y', 'yyYYYyy', '.yYYYy.', '..yYy..', '...y...', '..yyy..', '.ddddd.'], { y: GOLD[2], Y: GOLD[4], d: WD[1] }], // a gold cup
  [['...s...', '..sSs..', 'sSSSSSs', '.sSSSs.', '.sS.Ss.', '..ddd..', '.ddddd.'], { s: SILVER[2], S: SILVER[4], d: WD[1] }], // a silver star
  [['.......', 'o..ooo.', 'ooOOOOo', 'o.ooOo.', '...o...', '..ddd..', '.ddddd.'], { o: GOLD[2], O: GOLD[5], d: WD[1] }], // a golden fish
  [['..www..', '.wkwkw.', 'wwkkkww', '.wkwkw.', '..www..', '..ddd..', '.ddddd.'], { k: '#343a40', w: '#ffffff', d: WD[1] }], // a soccer ball
  [['..mmm..', '.mMMMm.', 'mMMMMMm', 'mkkkkkm', 'mMmMmMm', 'mm...mm'], { m: SILVER[1], M: SILVER[3], k: '#3b2235' }], // a knight's helmet
  [['..eee..', '.eEeEe.', 'eEeeeEe', 'eeEeeee', '.eeEee.', '..eee..', '.ddddd.'], { e: '#4a9a50', E: '#b8e080', d: WD[1] }], // a dragon egg
  [['...r...', '..rRr..', '..wbw..', '..www..', '.rwwwr.', 'rr.o.rr'], { r: '#d8443a', R: '#ff9a9a', w: '#f4f2f8', b: '#4dabf7', o: '#f0a030' }], // a toy rocket
  [['kkkkkkk', 'kwkwkwk', 'kwkwkwk', 'kwwwwwk', 'kkkkkkk', '.k...k.'], { k: '#2a2438', w: '#ffffff' }], // a tiny piano
  [['.ooooo.', 'oOOoOOo', 'okOoOko', 'ooOOOoo', 'oowwwoo', '.ooooo.'], { o: '#a8663e', O: '#e8b674', k: '#3b2235', w: '#fffaf0' }], // a tiki mask
  [['.r...b.', '..r.b..', '...y...', '..yYy..', '.yYYYy.', '..yYy..', '...y...'], { r: '#e0546a', b: '#4dabf7', y: GOLD[2], Y: GOLD[4] }], // a gold medal
  [['.......', '..bbb..', '.bBsBb.', 'bbsbsbb', '.bbbbb.', '..ddd..', '.ddddd.'], { b: GOLD[2], B: GOLD[4], s: '#fffaf0', d: WD[1] }], // a golden football
  [['y.....y', 'yy...yy', '.yyyyy.', 'yyYYYyy', '.yyyyy.', 'y.y.y.y'], { y: GOLD[2], Y: GOLD[4] }], // a golden crab
];

/** The trophy shelf: an open wooden bookcase, empty (0), a few (1), mostly full (2) or full (3). */
export function shelfArt(level = 0) {
  return sprite(34, 46, (b) => {
    // the case: sides, top, three shelves, a back board
    for (let y = 0; y < 46; y += 1) {
      for (let x = 0; x < 34; x += 1) {
        let c;
        if (y < 3) c = y === 0 ? WD[5] : y === 1 ? WD[4] : WD[3];
        else if (x < 3 || x > 30) c = x === 0 ? WD[4] : x === 33 ? WD[1] : x < 3 ? WD[3] : WD[2];
        else if (y > 42) c = y === 43 ? WD[3] : WD[2];
        else if ((y - 3) % 13 >= 11) c = (y - 3) % 13 === 11 ? WD[4] : WD[2];
        else { const yy = (y - 3) % 13; c = yy < 2 ? WD[0] : (x % 8 === 4 ? WD[1] : (yy < 4 ? mix(WD[1], WD[2], 0.4) : WD[2])); }
        b.set(x, y, c);
      }
    }
    // little feet
    b.rect(1, 46, 3, 1, WD[1]); b.rect(30, 46, 3, 1, WD[1]);
    // trophies: 4 a shelf, filled in this order
    const order = [1, 6, 9, 4, 2, 8, 11, 0, 5, 10, 3, 7];
    const n = [0, 3, 8, 12][level] || 0;
    const slot = (i) => [3 + (i % 4) * 7, 3 + Math.floor(i / 4) * 13 + 11];
    for (let k = 0; k < n; k += 1) {
      const i = order[k];
      const [x, base] = slot(i);
      const [rows, pal] = TROPHY_MINI[(i * 5 + 3) % TROPHY_MINI.length];
      grid((xx, yy, c) => b.set(xx, yy, c), x, base - rows.length, rows, pal);
    }
    // full: a banner and a big star on top
    if (level >= 3) {
      grid((xx, yy, c) => b.set(xx, yy, c), 13, -6, ['...y...', '..yYy..', 'yyYYYyy', '.yYYYy.', '.yy.yy.', 'y.....y'], { y: GOLD[3], Y: GOLD[5] });
      for (let x = 3; x < 31; x += 1) { b.set(x, 3 + ((x % 7 === 3) ? 1 : 0), ['#e0546a', '#ffd23f', '#6ea0f0', '#6cb85a'][Math.floor(x / 7) % 4]); if (x % 7 === 3) b.set(x, 5, ['#e0546a', '#ffd23f', '#6ea0f0', '#6cb85a'][Math.floor(x / 7) % 4]); }
    }
  }, { pad: 7 });
}

// ---------- furniture ----------
// Each piece: (look, state) -> a sprite. The bed shows if it's made.

/** A bed seen from above with its headboard on the wall; made or messy. */
function bedArt(item, made) {
  const look = item.look;
  const kind = item.art;
  const w = kind === 'canopy' ? 34 : kind === 'quilt' ? 32 : 30;
  const h = 78;
  return sprite(w, h, (b) => {
    const top = kind === 'canopy' ? 8 : 4; // the headboard's top
    // the headboard
    const HB = kind === 'bed' ? WD : kind === 'quilt' ? ['#3e2834', '#5e3a36', '#8a5440', '#a86a48', '#c88a60', '#e8b080'] : WD;
    for (let y = top; y < top + 20; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let c;
        const round = kind === 'quilt' ? inEll(x, y, w / 2, top + 9, w / 2, 9) || y > top + 8 : true;
        if (!round) continue;
        c = x < 2 ? HB[4] : x >= w - 2 ? HB[1] : (x % 5 === 2 ? HB[2] : HB[3]);
        if (y === top) c = HB[5];
        if (kind === 'quilt' && inEll(x, y, w / 2, top + 9, 5, 4)) c = inEll(x, y, w / 2, top + 9, 3, 2) ? '#ff9a9a' : HB[4]; // a carved heart-ish knot
        b.set(x, y, c);
      }
    }
    // the mattress and sheet
    const mx0 = 1; const mx1 = w - 1; const my0 = top + 16; const my1 = h - 4;
    for (let y = my0; y < my1; y += 1) for (let x = mx0; x < mx1; x += 1) b.set(x, y, x < mx0 + 1 ? PORC[4] : x >= mx1 - 1 ? PORC[1] : PORC[3]);
    // the pillow
    const pill = made ? [w / 2, my0 + 5] : [w / 2 + 3, my0 + 8];
    for (let y = my0; y < my0 + 12; y += 1) for (let x = mx0; x < mx1; x += 1) {
      const rx = (w - 8) / 2; const ry = 4;
      const dx = made ? 0 : (y - my0 - 6) * 0.6;
      if (!inEll(x - dx, y, pill[0], pill[1], rx, ry)) continue;
      b.set(x, y, inEll(x - dx, y, pill[0] - 1, pill[1] - 1, rx - 2, ry - 1.6) ? PORC[5] : y > pill[1] ? PORC[2] : PORC[4]);
    }
    // the blanket
    const by0 = my0 + 12;
    if (made) {
      // a neat folded sheet band, then the blanket smooth to the foot, hanging a little over the sides
      for (let y = by0; y < my1 + 2; y += 1) {
        for (let x = 0; x < w; x += 1) {
          let c;
          if (y < by0 + 3) c = y === by0 ? PORC[5] : y === by0 + 2 ? PORC[2] : PORC[4];
          else {
            const k = x < 2 ? 1 : x >= w - 2 ? -1 : y >= my1 ? -1 : 0;
            c = fabric(look, x, y, k);
            if (y === by0 + 3) c = fabric(look, x, y, 1);
          }
          b.set(x, y, c);
        }
      }
    } else {
      // slept in: the sheet rumpled, the blanket kicked down into a lumpy heap at the foot,
      // a corner of it hanging off the side onto the floor
      for (let y = by0 - 2; y < my1; y += 1) for (let x = mx0; x < mx1; x += 1) {
        const wr = Math.sin(x * 0.7 + y * 0.45) + Math.sin(y * 0.9 - x * 0.35);
        if (b.get(x, y) && b.get(x, y) === PORC[5]) continue; // keep the pillow
        if (wr > 1.2) b.set(x, y, PORC[1]);
        else if (wr > 0.7) b.set(x, y, PORC[2]);
        else if (wr < -1.3) b.set(x, y, PORC[4]);
      }
      const heapTop = my1 - 24;
      const edge = (x) => heapTop + Math.round(Math.sin(x * 0.9) * 2 + Math.sin(x * 0.37 + 1) * 2);
      for (let y = heapTop - 4; y < my1 + 3; y += 1) {
        for (let x = 0; x < w + 4; x += 1) {
          if (y < edge(x)) continue;
          if (x >= w - 1 && (y < my1 - 18 || y > my1 + 2 - (x - w))) continue; // the part hanging off the side
          const fold = Math.sin(x * 0.75 + y * 0.5) + Math.sin(y * 0.95 - x * 0.4) * 0.8;
          let k = fold > 0.9 ? 1 : fold < -0.9 ? -1 : 0;
          if (y === edge(x)) k = 2;
          if (x >= w - 1) k = -1;
          b.set(x, y, fabric(look, x, y, k));
        }
      }
    }
    // the footboard (and canopy posts)
    for (let x = 0; x < w; x += 1) { b.set(x, h - 4, made ? WD[3] : WD[3]); b.set(x, h - 3, x % 5 === 2 ? WD[2] : WD[3]); b.set(x, h - 2, WD[2]); b.set(x, h - 1, WD[1]); }
    if (kind === 'canopy') {
      const C = rampOf(look.c);
      for (const px0 of [0, w - 2]) for (let y = 0; y < h; y += 1) { if (y > top + 18 && y < h - 6) continue; b.set(px0, y, WD[4]); b.set(px0 + 1, y, WD[2]); }
      // the canopy: a draped valance across the top, curtains tied at the head posts
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < w; x += 1) {
        const drop = 5 + Math.round(Math.abs(Math.sin(x / 3.6)) * 2.4);
        if (y > drop) continue;
        b.set(x, y, y === 0 ? C[5] : y === drop ? C[1] : fabric(look, x, y, y < 2 ? 1 : 0));
      }
      for (let y = 8; y < top + 22; y += 1) { b.set(-1, y, C[4]); b.set(0, y, C[3]); b.set(w - 1, y, C[2]); b.set(w, y, C[1]); }
    }
  }, { inkUp: 0 });
}

/** A table with chairs, seen from above and in front. */
function tableArt(item) {
  const look = item.look;
  const kind = item.art;
  if (kind === 'table') {
    // a plain wood table and one chair
    return sprite(44, 30, (b) => {
      chair(b, 1, 6, WD, { c: 'green' }, 1);
      for (let y = 4; y < 18; y += 1) for (let x = 14; x < 42; x += 1) b.set(x, y, y === 4 ? WD[5] : y < 15 ? ((y - 5) % 4 === 3 ? WD[3] : WD[4]) : y === 15 ? WD[3] : WD[2]);
      for (const lx of [15, 39]) for (let y = 18; y < 30; y += 1) { b.set(lx, y, WD[3]); b.set(lx + 1, y, WD[2]); }
      for (const lx of [18, 36]) for (let y = 18; y < 26; y += 1) b.set(lx, y, WD[1]);
      // a mug and an apple
      grid((x, y, c) => b.set(x, y, c), 32, 3, ['wwwp', 'wWwp', 'www.'], { w: '#fffaf0', W: '#e8846a', p: '#fffaf0' });
      grid((x, y, c) => b.set(x, y, c), 20, 4, ['.g.', 'rRr', 'rrr'], { g: LEAF[3], r: '#d8443a', R: '#ff8a7a' });
    });
  }
  const T = kind === 'paintedtable' ? rampOf(look.c) : WD;
  return sprite(60, 34, (b) => {
    const cush = kind === 'roundtable' ? { c: PARTNER[look.c] === 'cream' ? 'yellow' : PARTNER[look.c] } : null;
    chair(b, 1, 8, T, cush, 1);
    chair(b, 47, 8, T, cush, -1);
    if (kind === 'roundtable') {
      // a round table with a cloth hanging down all round
      for (let y = 2; y < 30; y += 1) for (let x = 13; x < 47; x += 1) {
        const top = inEll(x, y, 30, 10, 17, 8);
        const skirt = y >= 10 && y < 26 && x >= 13 + Math.max(0, (y - 22)) && x < 47 - Math.max(0, (y - 22)) && inEll(x, 10, 30, 10, 17.5, 8.5);
        if (!top && !skirt) continue;
        const k = top ? (inEll(x, y, 28, 8, 12, 5) ? 1 : 0) : (x < 18 ? 0 : x > 41 ? -2 : -1);
        let c = fabric(look, x, y, k);
        if (!top && y >= 24) c = (x % 3 === 0) ? fabric(look, x, y, -2) : c; // the scalloped hem
        if (!top && y === 25 && x % 4 === 1) c = null;
        if (c) b.set(x, y, c);
      }
      // a vase of flowers
      grid((x, y, c) => b.set(x, y, c), 27, -1, ['.r.y.', 'rRgYy', '.gLg.', '.bBb.', '.bbb.'], { r: '#e0546a', R: '#ff9a9a', y: '#ffd23f', Y: '#fff4a8', g: LEAF[2], L: LEAF[4], b: '#6ea0f0', B: '#c0dcff' });
    } else {
      // a painted rectangle table with turned legs and a little pattern on the apron
      for (let y = 4; y < 20; y += 1) for (let x = 13; x < 47; x += 1) {
        let c = y === 4 ? T[5] : y < 15 ? (x < 15 ? T[5] : x > 44 ? T[2] : T[4]) : y === 15 ? T[2] : T[3];
        if (y >= 16 && (x - 13) % 6 === 3) c = '#fff4e6';
        b.set(x, y, c);
      }
      for (const lx of [14, 44]) for (let y = 20; y < 34; y += 1) { b.set(lx, y, y % 4 === 2 ? T[4] : T[3]); b.set(lx + 1, y, T[1]); }
      for (const lx of [18, 40]) for (let y = 20; y < 28; y += 1) b.set(lx, y, T[1]);
      // a bowl of fruit and two plates
      grid((x, y, c) => b.set(x, y, c), 26, 3, ['.oyr.', 'oyrro', 'wwwww', '.www.'], { o: '#f08c3a', y: '#ffd23f', r: '#d8443a', w: '#fffaf0' });
      grid((x, y, c) => b.set(x, y, c), 16, 8, ['.ww.', 'wWWw', '.ww.'], { w: '#fffaf0', W: '#e8e0d0' });
      grid((x, y, c) => b.set(x, y, c), 40, 8, ['.ww.', 'wWWw', '.ww.'], { w: '#fffaf0', W: '#e8e0d0' });
    }
  });
}

/** A dining chair pulled up to a table end, seen from the side: a ladder back and a seat. dir 1 faces right. */
function chair(b, x, y, T, cushion, dir) {
  const back = dir > 0 ? 0 : 9; // the back's two columns
  for (let yy = 0; yy < 22; yy += 1) {
    for (let xx = 0; xx < 12; xx += 1) {
      let c = null;
      const inBack = xx >= back && xx < back + 3;
      if (yy < 12 && inBack) {
        c = xx === back ? T[4] : xx === back + 2 ? T[2] : T[3];
        if (yy === 0) c = T[5];
        if (yy % 4 === 2 && xx === back + 1) c = T[1]; // the ladder's rungs
      } else if (yy >= 11 && yy < 15) {
        const top = yy === 11;
        c = cushion ? (top ? rampOf(cushion.c)[5] : rampOf(cushion.c)[yy === 14 ? 2 : 4]) : (top ? T[5] : yy === 14 ? T[2] : T[4]);
      } else if (yy >= 15 && (xx === 1 || xx === 10)) c = yy === 21 ? T[1] : T[3];
      else if (yy >= 15 && yy < 20 && (xx === 3 || xx === 8)) c = T[1];
      if (c) b.set(x + xx, y + yy, c);
    }
  }
}

/** A couch against the wall: a tall back, two armrests, three seat cushions, little feet. */
function couchArt(item) {
  const look = item.look;
  return sprite(48, 34, (b) => {
    for (let y = 0; y < 34; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        let c = null;
        const arm = x < 7 || x >= 41;
        if (y < 14 && x >= 3 && x < 45) {
          // the back, with buttoned cushions
          const k = y < 2 ? 2 : y > 11 ? -1 : (x - 3) % 14 === 0 ? -1 : 0;
          c = fabric(look, x, y, k);
          if (y === 6 && (x - 3) % 14 === 7) c = rampOf(look.c)[1];
          if (y === 0 && (x < 5 || x > 42)) c = null;
        }
        if (arm && y >= 8 && y < 30) {
          const left = x < 7;
          const k = y < 10 ? 2 : (left ? (x < 2 ? 1 : 0) : (x > 45 ? -2 : -1));
          c = fabric(look, x, y, k);
          if ((left && x === 0 && y === 8) || (!left && x === 47 && y === 8)) c = null;
        }
        if (!arm && y >= 14 && y < 26) {
          // seat cushions, with a seam between each
          const seam = (x - 7) % 11 === 0;
          const k = y === 14 ? 2 : y < 17 ? 1 : y > 23 ? -1 : 0;
          c = seam ? fabric(look, x, y, -1) : fabric(look, x, y, k);
        }
        if (!arm && y >= 26 && y < 30) c = fabric(look, x, y, -2);
        if (y >= 30 && (x === 3 || x === 4 || x === 43 || x === 44)) c = WD[2];
        if (c) b.set(x, y, c);
      }
    }
    // a little throw pillow
    const P = rampOf(PARTNER[look.c] || 'cream');
    grid((x, y, c) => b.set(x, y, c), 9, 10, ['.pPp.', 'pPPPp', 'pPpPp', '.ppp.'], { p: P[2], P: P[4] });
  });
}

/** The cozy armchair: round, plump, with a soft cushion. */
function armchairArt(item) {
  const look = item.look;
  if (item.art === 'beanbag') {
    return sprite(24, 20, (b) => {
      for (let y = 0; y < 20; y += 1) for (let x = 0; x < 24; x += 1) {
        const body = inEll(x, y, 12, 12, 12, 8) || inEll(x, y, 12, 6, 8, 6);
        if (!body) continue;
        const dent = inEll(x, y, 12, 9, 6, 3.5);
        const k = dent ? -1 : inEll(x, y, 9, 6, 5, 4) ? 1 : y > 16 ? -1 : 0;
        b.set(x, y, fabric(look, x, y, k));
      }
    });
  }
  return sprite(28, 28, (b) => {
    for (let y = 0; y < 28; y += 1) {
      for (let x = 0; x < 28; x += 1) {
        let c = null;
        const back = inEll(x, y, 14, 9, 13, 10) && y < 16;
        if (back) c = fabric(look, x, y, y < 3 ? 2 : x < 5 ? 1 : x > 23 ? -1 : 0);
        const arm = (x < 6 || x > 21) && y >= 9 && y < 24;
        if (arm) c = fabric(look, x, y, y < 11 ? 2 : x < 2 ? 1 : x > 25 ? -2 : x > 21 ? -1 : 0);
        if (arm && ((x < 6 && inEll(x, y, 3, 10, 3, 2.2)) || (x > 21 && inEll(x, y, 24.5, 10, 3, 2.2)))) c = fabric(look, x, y, 2);
        if (!arm && x >= 6 && x <= 21 && y >= 14 && y < 22) c = fabric(look, x, y, y === 14 ? 2 : y < 17 ? 1 : 0);
        if (!arm && x >= 6 && x <= 21 && y >= 22 && y < 24) c = fabric(look, x, y, -2);
        if (y >= 24 && (x === 3 || x === 24)) c = WD[2];
        if (y >= 24 && y < 27 && (x === 4 || x === 23)) c = WD[1];
        if (c) b.set(x, y, c);
      }
    }
    // a folded blanket over one arm
    const P = rampOf(PARTNER[look.c] || 'cream');
    for (let y = 10; y < 20; y += 1) for (let x = 21; x < 27; x += 1) if (x - 21 + (y - 10) * 0.2 < 5) b.set(x, y, (y - 10) % 3 === 0 ? P[2] : P[3]);
  });
}

/** The corner piece: a hammock between two posts, or a big leafy plant in a pot. */
function cornerArt(item) {
  const look = item.look;
  if (item.art === 'plant') {
    return sprite(22, 36, (b) => {
      const P = rampOf(look.c);
      // leaves: big ones fanning out
      const leaves = [[11, 10, 6, 3, -0.7], [11, 8, 6, 3, 0.7], [11, 4, 3, 6, 0], [6, 14, 6, 2.5, -0.3], [16, 14, 6, 2.5, 0.3], [9, 2, 3, 5, -0.4], [14, 3, 3, 5, 0.4]];
      for (const [cx, cy, rx, ry, tilt] of leaves) {
        for (let y = cy - 8; y < cy + 8; y += 1) for (let x = cx - 9; x < cx + 9; x += 1) {
          const dx = x - cx - (y - cy) * tilt; const dy = y - cy;
          if (!inEll(dx + cx, dy + cy, cx, cy, rx, ry)) continue;
          const vein = Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6;
          b.set(x, y, vein ? LEAF[4] : dx + dy < 0 ? LEAF[3] : LEAF[2]);
        }
      }
      for (let y = 16; y < 22; y += 1) b.set(11, y, LEAF[1]);
      for (let y = 21; y < 36; y += 1) for (let x = 4; x < 18; x += 1) {
        const taper = Math.floor((y - 21) / 6);
        if (x < 4 + taper || x >= 18 - taper) continue;
        let c = y < 23 ? P[4] : x < 7 ? P[4] : x > 14 ? P[2] : P[3];
        if (look.p === 'stripes' && (y - 23) % 4 === 1) c = '#fffaf0';
        b.set(x, y, c);
      }
    });
  }
  return sprite(54, 40, (b) => {
    const C = rampOf(look.c);
    // two posts
    for (const x0 of [0, 50]) for (let y = 0; y < 40; y += 1) { b.set(x0, y, WD[4]); b.set(x0 + 1, y, WD[3]); b.set(x0 + 2, y, WD[2]); if (y === 0) { b.set(x0, y, WD[5]); b.set(x0 + 2, y, WD[3]); } }
    // ropes and the hammock's sagging cloth, with a fringe
    for (let x = 3; x < 50; x += 1) {
      const t = (x - 26.5) / 23.5;
      const sag = Math.round(14 + (1 - t * t) * 12);
      const top = Math.round(6 + (1 - t * t) * 10);
      if (x < 9 || x > 44) { const ry = Math.round(5 + (x < 9 ? (x - 3) : (50 - x)) * 1.5); b.set(x, ry, '#e8d0a0'); b.set(x, ry + 1, '#b89a70'); continue; }
      for (let y = top; y <= sag; y += 1) {
        const k = y === top ? 2 : y > sag - 2 ? -1 : 0;
        b.set(x, y, fabric(look, x, y, k));
      }
      if (x % 2 === 0) b.set(x, sag + 1, C[2]);
      if (x % 4 === 0) b.set(x, sag + 2, C[1]);
    }
    // a pillow at one end
    grid((x, y, c) => b.set(x, y, c), 10, 11, ['.www.', 'wWWWw', 'wwWww', '.www.'], { w: '#fbf0e0', W: '#ffffff' });
  });
}

/** A floor lamp (or a mushroom lamp), lit and glowing warm. */
function lampArt(item) {
  const look = item.look;
  if (item.art === 'mushlamp') {
    return sprite(18, 28, (b) => {
      const C = rampOf(look.c);
      for (let y = 0; y < 12; y += 1) for (let x = 0; x < 18; x += 1) {
        if (!inEll(x, y, 9, 10, 9, 9.5) || y > 10) continue;
        let c = y > 9 ? C[1] : x < 5 ? C[4] : x > 13 ? C[2] : C[3];
        if (look.p === 'dots' && ((x - 4) % 5 === 0 && y % 4 === 2)) c = '#fffaf0';
        if (look.p === 'stars' && h2(x, y, 3) < 0.12) c = '#fff4c8';
        b.set(x, y, c);
      }
      for (let y = 11; y < 26; y += 1) for (let x = 6; x < 12; x += 1) b.set(x, y, y === 11 ? GLOW[2] : x === 6 ? PORC[5] : x === 11 ? PORC[2] : PORC[4]);
      for (let x = 4; x < 14; x += 1) { b.set(x, 26, PORC[2]); b.set(x, 27, PORC[1]); }
    }, { after: (b) => { for (let y = 12; y < 16; y += 1) for (let x = -2; x < 20; x += 1) if (!b.get(x, y) && bayer(x, y) < 0.18 && inEll(x, y, 9, 13, 11, 4)) b.set(x, y, 'rgba(255,220,140,0.5)', 'soft'); } });
  }
  return sprite(14, 48, (b) => {
    const C = rampOf(look.c);
    // the shade: a drum, lit from inside
    for (let y = 0; y < 13; y += 1) for (let x = 0; x < 14; x += 1) {
      const half = 4 + y * 0.25;
      if (Math.abs(x + 0.5 - 7) > half) continue;
      let c = x < 4 ? C[5] : x > 10 ? C[3] : C[4];
      if (look.p === 'dots' && (x + y * 2) % 5 === 0) c = C[2];
      if (look.p === 'stripes' && x % 3 === 0) c = C[2];
      if (y === 12) c = GLOW[3];
      b.set(x, y, c);
    }
    for (let y = 13; y < 45; y += 1) { b.set(6, y, CHROME[3]); b.set(7, y, CHROME[1]); }
    for (let x = 2; x < 12; x += 1) { b.set(x, 45, CHROME[3]); b.set(x, 46, CHROME[1]); }
  }, { after: (b) => { for (let y = 13; y < 22; y += 1) for (let x = -3; x < 17; x += 1) if (!b.get(x, y) && bayer(x, y) < 0.25 - (y - 13) * 0.025 && Math.abs(x - 7) < 3 + (y - 13)) b.set(x, y, 'rgba(255,220,140,0.45)', 'soft'); } });
}

/** A rug on the floor (flat): round or striped with a fringe. lift: a corner flipped up (messy room). */
function rugArt(item, lift = 0) {
  const look = item.look;
  if (item.art === 'ruground') {
    return sprite(66, 40, (b) => {
      for (let y = 0; y < 40; y += 1) for (let x = 0; x < 66; x += 1) {
        if (!inEll(x, y, 33, 20, 33, 20)) continue;
        const r = ((x + 0.5 - 33) / 33) ** 2 + ((y + 0.5 - 20) / 20) ** 2;
        let c = fabric(look, x, y, r > 0.82 ? -1 : r > 0.62 ? 1 : r > 0.3 ? 0 : 1);
        if (r > 0.62 && r < 0.7) c = rampOf(PARTNER[look.c] || 'cream')[4];
        if (lift && x > 50 && y > 26 && x + y > 82) c = r > 0.82 ? '#d8c0a0' : '#e8d6b8';
        b.set(x, y, c);
      }
    }, { ground: false });
  }
  return sprite(74, 40, (b) => {
    for (let y = 0; y < 40; y += 1) for (let x = 0; x < 74; x += 1) {
      let c;
      if (x < 3 || x > 70) { if (y % 2 === 0) b.set(x, y, '#f4e4cc'); continue; } // fringe
      const bd = x < 6 || x > 67 || y < 3 || y > 36;
      c = bd ? rampOf(look.c)[1] : look.p === 'stripes' ? (Math.floor(y / 4) % 2 ? fabric({ ...look, p: 'plain' }, x, y, 0) : rampOf(PARTNER[look.c] || 'cream')[4]) : fabric(look, x, y, 0);
      if (!bd && (x === 7 || x === 66 || y === 4 || y === 35)) c = rampOf(look.c)[4];
      if (lift && x > 56 && y > 26 && (x - 56) + (y - 26) > 12) c = '#e8d6b8';
      b.set(x, y, c);
    }
  }, { ground: false });
}

// ---------- sports gear ----------
// palettes like the buddy's gear (avatar.js): regular, good, super
const BALL = [{ w: '#ffffff', d: '#343a40', s: '#ced4da' }, { w: '#ffffff', d: '#1c7ed6', s: '#ced4da' }, { w: '#ffe066', d: '#e8590c', s: '#f59f00' }];
const FOOT = [{ b: '#a0522d', l: '#c97a4a', d: '#6e3517', s: '#ffffff' }, { b: '#7a2e1c', l: '#a0522d', d: '#4a1a0e', s: '#ffd43b' }, { b: '#fcc419', l: '#ffe066', d: '#e67700', s: '#e03131' }];
const STICK = [{ s: '#c98a4b', l: '#f0c48a', t: '#343a40', b: '#ffffff' }, { s: '#343a40', l: '#5c636a', t: '#e03131', b: '#1c7ed6' }, { s: '#fcc419', l: '#ffe066', t: '#e03131', b: '#e03131' }];
const ROD = [{ r: '#c98a4b', c: '#868e96' }, { r: '#495057', c: '#e03131' }, { r: '#fcc419', c: '#4dabf7' }];
const SHOE = [{ s: '#e03131', l: '#ff6b6b', w: '#ffffff' }, { s: '#1c7ed6', l: '#4dabf7', w: '#ffd43b' }, { s: '#fcc419', l: '#ffe066', w: '#ffffff' }];

/**
 * The gear corner: a wooden rack with whatever sports gear the kid owns (gear: bestGear(owned),
 * { soccer: 1-3, football, hockey, rod, shoes }), each at its best version. Null when none.
 */
export function gearArt(gear = {}) {
  if (!Object.values(gear).some(Boolean)) return null;
  return sprite(38, 36, (b) => {
    // the rack: two uprights and a top bar with pegs
    for (let y = 0; y < 30; y += 1) { b.set(2, y, WD[4]); b.set(3, y, WD[2]); b.set(34, y, WD[3]); b.set(35, y, WD[1]); }
    for (let x = 2; x < 36; x += 1) { b.set(x, 2, WD[4]); b.set(x, 3, WD[2]); }
    // the hockey stick and fishing rod hang from the bar
    if (gear.hockey) {
      const p = STICK[gear.hockey - 1];
      for (let y = 4; y < 24; y += 1) { const x = 8 + Math.floor((y - 4) / 7); b.set(x, y, p.l); b.set(x + 1, y, p.s); }
      b.set(8, 4, p.t); b.set(9, 4, p.t); b.set(8, 5, p.t);
      for (let x = 10; x < 16; x += 1) { b.set(x, 24, p.s); b.set(x, 25, p.b); }
      b.set(10, 23, p.s); b.set(11, 23, p.s);
    }
    if (gear.rod) {
      const p = ROD[gear.rod - 1];
      for (let y = 1; y < 26; y += 1) { b.set(17, y, p.r); }
      b.set(17, 0, p.r); b.set(18, 18, p.c); b.set(18, 19, p.c); b.set(19, 19, '#343a40');
      for (let y = 1; y < 12; y += 1) b.set(16 - Math.floor(y / 6), y + 1, 'rgba(255,255,255,0.7)', 'soft');
    }
    // a crate along the bottom for the balls
    for (let y = 24; y < 36; y += 1) for (let x = 0; x < 38; x += 1) {
      if (x > 23 && y < 30) continue;
      let c = y === 24 || (x > 23 && y === 30) ? WD[5] : (y - 24) % 4 === 3 ? WD[2] : WD[3];
      if (x === 0 || x === 37 || x === 23) c = WD[2];
      b.set(x, y, c);
    }
    if (gear.soccer) {
      const p = BALL[gear.soccer - 1];
      grid((x, y, c) => b.set(x, y, c), 3, 18, ['..www..', '.wdwdw.', 'wdddwww', 'wwdwwdw', 'wdwwddw', '.wwdws.', '..sss..'], { w: p.w, d: p.d, s: p.s });
    }
    if (gear.football) {
      const p = FOOT[gear.football - 1];
      grid((x, y, c) => b.set(x, y, c), 12, 19, ['..bbbb..', '.blsslb.', 'bbsbbsbb', '.bddddb.', '..dddd..'], { b: p.b, l: p.l, d: p.d, s: p.s });
    }
    if (gear.shoes) {
      const p = SHOE[gear.shoes - 1];
      grid((x, y, c) => b.set(x, y, c), 25, 25, ['.ll...', 'lsss..', 'swwsss', 'wwwwww'], { s: p.s, l: p.l, w: p.w });
      grid((x, y, c) => b.set(x, y, c), 30, 26, ['.ll..', 'lsss.', 'swwss', 'wwwww'], { s: p.s, l: p.l, w: p.w });
    }
  });
}

// ---------- the bathroom ----------

/** The sink, on a pedestal, with a toothbrush cup. teeth: the toothbrush is put away in the cup. */
function sinkArt(teethDone) {
  return sprite(20, 46, (b) => {
    // the basin: a wide oval bowl with a chrome tap
    for (let y = 18; y < 28; y += 1) for (let x = 0; x < 20; x += 1) {
      if (!inEll(x, y, 10, 22, 10, 6)) continue;
      const bowl = inEll(x, y, 10, 21.5, 7, 3.4);
      b.set(x, y, bowl ? (y < 21 ? PORC[1] : PORC[2]) : y < 21 ? PORC[5] : y > 25 ? PORC[2] : PORC[4]);
    }
    b.set(9, 22, CHROME[1]); b.set(10, 22, CHROME[0]);
    grid((x, y, c) => b.set(x, y, c), 8, 15, ['.hh.', 'cccc', '..c.', '..c.'], { h: '#e03131', c: CHROME[3] });
    // the pedestal
    for (let y = 28; y < 46; y += 1) for (let x = 7; x < 13; x += 1) { const flare = y > 42 ? 1 : 0; b.set(x, y, x === 7 ? PORC[4] : x === 12 ? PORC[1] : PORC[3]); if (flare) { b.set(6, y, PORC[3]); b.set(13, y, PORC[1]); } }
    // the cup on the sink's edge, and the toothbrush: in the cup, or out by the tap with toothpaste on
    grid((x, y, c) => b.set(x, y, c), 15, 15, ['cCc', 'cCc', 'ccc'], { c: '#6ea0f0', C: '#c0dcff' });
    if (teethDone) {
      grid((x, y, c) => b.set(x, y, c), 15, 9, ['..w', '.wg', '.g.', 'g..', 'g..', 'g..'], { w: '#ffffff', g: '#4ac0a0' });
      grid((x, y, c) => b.set(x, y, c), 17, 11, ['..', 'p.', 'p.', 'p.'], { p: '#ff9a9a' });
    } else {
      // lying on the basin's front edge, bristles up with a blob of paste, and the tube beside
      grid((x, y, c) => b.set(x, y, c), 1, 23, ['.......ww', 'gggggggWW', '.......pp'], { g: '#4ac0a0', w: '#9ad8ff', W: '#ffffff', p: '#ffffff' });
      grid((x, y, c) => b.set(x, y, c), 2, 16, ['bbbbbr', 'bwwbbr', 'bbbbbr'], { b: '#ffffff', w: '#4dabf7', r: '#e03131' });
    }
  });
}

/** The shower: a tiled stall in the corner with a chrome head and a curtain half drawn. */
function showerArt() {
  return sprite(27, 76, (b) => {
    // the stall's back tiles (darker than the wall), the tray on the floor
    for (let y = 2; y < 42; y += 1) for (let x = 0; x < 27; x += 1) {
      const g = y % 5 === 4 || x % 5 === 4;
      b.set(x, y, g ? TILE[4] : (x + y) % 10 < 5 ? TILE[1] : TILE[2]);
    }
    for (let y = 42; y < 74; y += 1) for (let x = 0; x < 27; x += 1) {
      const rim = x < 2 || x > 24 || y > 71;
      b.set(x, y, rim ? (y > 71 ? PORC[2] : x < 2 ? PORC[5] : PORC[2]) : (x + y) % 4 === 0 ? PORC[1] : PORC[3]);
    }
    b.set(13, 58, CHROME[1]); b.set(14, 58, CHROME[0]); // the drain
    // the shower head and pipe
    for (let y = 4; y < 14; y += 1) b.set(13, y, CHROME[3]);
    grid((x, y, c) => b.set(x, y, c), 9, 13, ['ccccccccc', '.CCCCCCC.', '..d.d.d..'], { c: CHROME[3], C: CHROME[2], d: '#9ad8ff' });
    grid((x, y, c) => b.set(x, y, c), 18, 26, ['cc', 'cC'], { c: CHROME[3], C: '#e03131' });
    // the curtain rail and a curtain bunched to the left
    for (let x = -1; x < 28; x += 1) { b.set(x, 0, CHROME[4]); b.set(x, 1, CHROME[2]); }
    const C = rampOf('#78aab4');
    for (let y = 2; y < 70; y += 1) for (let x = 0; x < 9; x += 1) {
      const fold = (x + Math.floor(y / 12)) % 3;
      b.set(x, y, y > 66 ? C[2] : fold === 0 ? C[2] : fold === 1 ? C[4] : C[3]);
      if ((y * 3 + x * 5) % 17 === 0 && fold) b.set(x, y, '#fffaf0'); // bubbles on the curtain
    }
    // a rubber duck on the tray
    grid((x, y, c) => b.set(x, y, c), 18, 62, ['.yy.', 'yeyo', 'yyy.', 'yyyy'], { y: '#ffd23f', e: '#3b2235', o: '#f08c3a' });
  });
}

function basketArt() {
  return sprite(16, 18, (b) => {
    for (let y = 4; y < 18; y += 1) for (let x = 0; x < 16; x += 1) {
      const taper = y > 14 ? 1 : 0;
      if (x < taper || x >= 16 - taper) continue;
      b.set(x, y, y === 4 ? '#e8cc90' : (x + y) % 3 === 0 ? '#a8784a' : (x % 2 ? '#d4a86a' : '#c0905a'));
    }
    // clothes peeking out
    grid((x, y, c) => b.set(x, y, c), 2, 0, ['..rr....bb..', '.rRrr..bBbb.', 'rrrrrwwbbbbb', 'rrrwwwwwbbbb'], { r: '#e0546a', R: '#ff9a9a', b: '#6ea0f0', B: '#c0dcff', w: '#fffaf0' });
  });
}

// ---------- the fish tank ----------

const WATER = ['#c8eef8', '#94d4ec', '#68b8e0', '#4a9ccc', '#3a82b8'];
const PEBBLE = ['#e8c890', '#d4a86a', '#f0a8a0', '#a0c8f0', '#c8a8e8', '#a8784a', '#fff4dc'];

/**
 * The fish tank on a low wooden cabinet, with the fish book open on a little stand beside it.
 * The fish itself, its bubbles and its name plaque are added on top by house.js (the fish
 * swims), so the tank is drawn with clear water, gravel, plants and a little castle.
 * TANK gives where those go, from the art's top-left corner.
 */
export const TANK = { w: 62, h: 39, water: [3, 4, 41, 13], bubbler: { x: 13, y: 18 }, plaque: { x: 23, y: 31 }, book: [46, 12, 16, 13] };

function tankArt() {
  return sprite(TANK.w, TANK.h, (b) => {
    // the water, lighter near the top, then the gravel
    for (let y = 3; y < 22; y += 1) for (let x = 2; x < 45; x += 1) {
      const band = Math.min(4, (y - 3) / 4);
      const lo = Math.floor(band); const k = band - lo;
      b.set(x, y, k > bayer(x, y) && lo < 4 ? WATER[lo + 1] : WATER[lo]);
    }
    for (let x = 2; x < 45; x += 1) b.set(x, 3, WATER[0]); // the surface
    for (let y = 18; y < 22; y += 1) for (let x = 2; x < 45; x += 1) {
      if (y === 18 && h2(x, 7) < 0.45) continue; // a bumpy top
      b.set(x, y, PEBBLE[Math.floor(h2(x * 3 + y, y * 7) * PEBBLE.length)]);
    }
    // swaying weed on the left, broad leaves on the right
    for (const [x0, top, ph] of [[4, 7, 0], [6, 10, 2], [8, 8, 1]]) {
      for (let y = top; y < 19; y += 1) { const x = x0 + (Math.floor((y + ph) / 3) % 2); b.set(x, y, y % 3 === 0 ? LEAF[4] : LEAF[2]); }
    }
    grid((x, y, c) => b.set(x, y, c), 37, 7, ['..l...', '.lL.l.', '.lLlL.', 'l.lLL.', 'lLl.Ll', '.lLlL.', '..lLl.', '..ss..', '..ss..', '..ss..', '.ssss.'], { l: LEAF[3], L: LEAF[5], s: LEAF[1] });
    // a little castle, and the stone that bubbles
    grid((x, y, c) => b.set(x, y, c), 26, 11, ['g.g.g.', 'gGgGgg', 'gGgggg', 'ggkkgg', 'gGkkgg', 'ggkkgg', 'gggggg'], { g: '#9894aa', G: '#c0bcc8', k: '#4a4560' });
    grid((x, y, c) => b.set(x, y, c), 11, 17, ['.ss.', 'sSss'], { s: '#6e6a86', S: '#9894aa' });
    // the glass: a dark frame and lid with a light under it, and a couple of shines on the front
    for (let x = 1; x < 46; x += 1) { b.set(x, 0, SAGE[3]); b.set(x, 1, SAGE[1]); b.set(x, 2, SAGE[0]); b.set(x, 22, SAGE[1]); b.set(x, 23, SAGE[0]); }
    for (let y = 0; y < 24; y += 1) { b.set(1, y, y < 3 || y > 21 ? b.get(1, y) : SAGE[2]); b.set(45, y, y < 3 || y > 21 ? b.get(45, y) : SAGE[0]); }
    for (let x = 14; x < 32; x += 1) b.set(x, 1, '#fff4c8'); // the lid's light
    for (let i = 0; i < 6; i += 1) { b.set(5 + i, 11 - i, 'rgba(255,255,255,0.45)', 'soft'); b.set(7 + i, 11 - i, 'rgba(255,255,255,0.25)', 'soft'); }
    for (let i = 0; i < 3; i += 1) b.set(40 + i, 6 - i, 'rgba(255,255,255,0.4)', 'soft');
    // the cabinet: a top, two doors under the tank and a narrow one, little feet
    for (let y = 24; y < 39; y += 1) for (let x = 0; x < 62; x += 1) {
      if (y === 38 && x > 2 && x < 59) continue; // feet only at the ends
      let c = y === 24 ? WD[5] : y === 25 ? WD[4] : y >= 37 ? WD[1] : WD[3];
      if (y > 26 && y < 36) {
        for (const [a, z] of [[3, 22], [24, 43], [47, 58]]) {
          if (x === a || x === z || y === 27 || y === 35) { if (x >= a && x <= z) c = WD[2]; } else if (x > a && x < z) c = x === a + 1 || y === 28 ? WD[4] : WD[3];
        }
      }
      if (x === 0 || x === 61) c = WD[2];
      b.set(x, y, c);
    }
    for (const [x, y] of [[20, 31], [26, 31], [50, 31]]) { b.set(x, y, GOLD[3]); b.set(x, y + 1, GOLD[1]); }
    // the fish book, open on a little stand: a fish drawn on one page, notes on the other
    const B = TANK.book;
    for (let y = 2; y < 10; y += 1) for (let x = 1; x < 15; x += 1) b.set(B[0] + x, B[1] + y, '#2f6b4a');
    for (let y = 1; y < 9; y += 1) for (let x = 2; x < 14; x += 1) {
      if (y === 1 && (x === 2 || x === 7 || x === 8 || x === 13)) continue;
      b.set(B[0] + x, B[1] + y, x === 7 || x === 8 ? '#e0d0a8' : x < 7 ? '#fdf4dc' : '#fffaf0');
    }
    grid((x, y, c) => b.set(x, y, c), B[0] + 2, B[1] + 3, ['.oo..', 'oOoo.o', 'ooooo', '.oo..o'], { o: '#f08c3a', O: '#3b2235' });
    for (const y of [3, 5, 7]) for (let x = 9; x < 13; x += 1) if (!(y === 7 && x > 11)) b.set(B[0] + x, B[1] + y, '#b0a090');
    for (let x = 4; x < 12; x += 1) b.set(B[0] + x, B[1] + 10, WD[2]);
    for (const x of [5, 10]) b.set(B[0] + x, B[1] + 11, WD[1]);
    for (let x = 3; x < 13; x += 1) b.set(B[0] + x, B[1] + 12, WD[3]);
  });
}

// ---------- the mess ----------
// Things left on the floor when the floor chore isn't done: [level it shows from, x, y, kind].
// Level 1 is a few things out of place, 2 a proper mess, 3 a disaster.
const MESS = [
  [1, 56, 104, 'shirt'], [1, 152, 66, 'sock'], [1, 70, 146, 'book'], [1, 74, 80, 'blocks'], [1, 84, 140, 'car'],
  [2, 178, 80, 'pants'], [2, 124, 62, 'paper'], [2, 222, 72, 'teddy'], [2, 76, 128, 'ball'], [2, 224, 128, 'crayons'], [2, 50, 68, 'sock2'], [2, 176, 128, 'paper2'],
  [3, 146, 78, 'pile'], [3, 46, 118, 'backpack'], [3, 62, 56, 'pillow'], [3, 98, 132, 'puzzle'], [3, 84, 154, 'cup'], [3, 68, 162, 'shoes'],
  [2, 164, 100, 'heap'], [2, 92, 58, 'blocks2'], [2, 32, 104, 'paper3'],
  [3, 172, 114, 'ball'], [3, 128, 52, 'sock'], [3, 60, 122, 'book'], [3, 166, 124, 'car'], [3, 40, 160, 'paper'], [3, 152, 116, 'crayons'], [3, 216, 106, 'sock2'], [3, 14, 102, 'toybox'], [3, 30, 136, 'heap2'],
  [3, 186, 58, 'book2'], [3, 106, 66, 'paper3'], [3, 188, 70, 'dino'], [3, 64, 92, 'blocks2'], [3, 116, 156, 'sock3'], [3, 222, 92, 'shirt2'],
];
const MESS_ART = {
  shirt: [['.yy.yy.', 'yyYYYyy', 'yYYYYYy', '.yYYYy.', '.yyyyy.', '.yyyyy.'], { y: '#e8823a', Y: '#ffb070' }],
  shirt2: [['.gg.gg.', 'ggGGGgg', '.gGwGg.', '.gGGGg.', '..ggg..'], { g: '#7a4ab0', G: '#a07ee0', w: '#ffd23f' }],
  sock: [['.ww.', '.wr.', '.ww.', 'wwww', 'rww.'], { w: '#fffaf0', r: '#e0546a' }],
  sock2: [['ggg...', '.gGgg.', '..gggg'], { g: '#4a9a50', G: '#9ed46a' }],
  sock3: [['....bb', '.bbbBb', 'bbBb..'], { b: '#3e6ab0', B: '#6ea0f0' }],
  book: [['bbbb.wwwww', 'bBBbwwkkkw', 'bBBbwwwwww', 'bbbbwwkkww', '....wwwww.'], { b: '#3e6ab0', B: '#6ea0f0', w: '#fffaf0', k: '#b0948a' }],
  book2: [['rrrrrrr', 'rRRRRRr', 'rRyyyRr', 'rrrrrrr', '.ggggg.', 'gGGGGGg', 'ggggggg'], { r: '#a8304a', R: '#e0546a', y: '#ffd23f', g: '#33704a', G: '#6cb85a' }],
  blocks: [['rrr..yyy', 'rRr..yYy', 'rrr..yyy', '...bbb..', '...bBb..', '...bbb..'], { r: '#d8443a', R: '#ff8a7a', y: '#e8b83a', Y: '#ffe27a', b: '#3e6ab0', B: '#6ea0f0' }],
  blocks2: [['ggg.....', 'gGg.ppp.', 'ggg.pPp.', '....ppp.'], { g: '#4a9a50', G: '#9ed46a', p: '#e0709a', P: '#ffb0d0' }],
  paper: [['wwwwww', 'wkkkkw', 'wwwwww', 'wkkkww', 'wwwwwk'], { w: '#fffdf4', k: '#b0aec0' }],
  paper2: [['.wwww', 'wwrrw', 'wwwww', 'wbbww'], { w: '#fffdf4', r: '#e0546a', b: '#4dabf7' }],
  paper3: [['wwww.', 'wkkww', 'wwwww', '.wkww'], { w: '#f4f2f8', k: '#b0aec0' }],
  car: [['.rrrr..', 'rRwwRr.', 'rrrrrrr', '.k...k.'], { r: '#d8443a', R: '#ff8a7a', w: '#c0dcff', k: '#343a40' }],
  crayons: [['r..y...', 'r..y..b', 'R..Y..b', '......B', 'gg.....'], { r: '#e0546a', y: '#ffd23f', b: '#4dabf7', R: '#a8304a', Y: '#d08a1a', B: '#3a5ec0', g: '#4a9a50' }],
  teddy: [['b...b', 'bbbbb', 'bekeb', '.bbb.', 'bbBbb', 'b.b.b'], { b: '#c08a5a', B: '#e8b674', e: '#3b2235', k: '#7a4436' }],
  ball: [['.ppp.', 'pPPpp', 'pPppp', 'ppppp', '.ppp.'], { p: '#e0709a', P: '#ffd0e0' }],
  pants: [['bbbbbb', 'bBbbBb', 'bbb.bb', 'bb..bb', 'bb..bb', 'Bb..bB'], { b: '#3e6ab0', B: '#6ea0f0' }],
  pile: [['...rrbb...', '..yyrrbbb.', '.gggyyrrbb', 'gggGyyrrbw', 'ggwwwwyyww', '.wwwwwwww.'], { r: '#e0546a', b: '#6ea0f0', y: '#f0a848', g: '#4a9a50', G: '#9ed46a', w: '#fffaf0' }],
  backpack: [['..rrrr..', '.rRRRRr.', '.rrrrrr.', '.rkkkkr.', '.rrrrrr.', '..rrrr..', 'wwyy.bb.'], { r: '#3e8e7e', R: '#6ac0b0', k: '#ffd23f', w: '#fffaf0', y: '#e8823a', b: '#4dabf7' }],
  puzzle: [['pp..gg', 'pPp.gG', '.pp..g', '...oo.', '...oO.'], { p: '#7a4ab0', P: '#a07ee0', g: '#4a9a50', G: '#9ed46a', o: '#e8823a', O: '#ffb070' }],
  cup: [['.www.', 'wbbbw', 'wwwww', '.www.'], { w: '#fffaf0', b: '#6ea0f0' }],
  shoes: [['.rrr...rrr', 'rrrrr.rrrr', 'wwwww.wwww'], { r: '#e8823a', w: '#fffaf0' }],
  pillow: [['.wwwww.', 'wWWWWWw', 'wWWWWWw', '.wwwww.'], { w: '#e8d6cc', W: '#fffaf0' }],
  heap: [['....yy.bb.....', '..yyYyybBbrr..', '.gyyyyybbbrRr.', 'gGgggwwwbbrrrr', 'gggwwwwwwppbbr', '.wwwwwppppppb.', '..ppppppppp...'], { y: '#f0a848', Y: '#ffd878', b: '#6ea0f0', B: '#c0dcff', r: '#e0546a', R: '#ff9a9a', g: '#4a9a50', G: '#9ed46a', w: '#fffaf0', p: '#7a4ab0' }],
  heap2: [['.....rr.yy......', '...rrRrryYyy....', '..bbrrrryyyygg..', '.bBbbwwwwyyggGg.', 'bbbbwwwwwwwgggg.', 'bbbppppwwwwoooo.', '.ppppPppppoooOo.', '..pppppp.oooooo.'], { r: '#d8443a', R: '#ff8a7a', y: '#e8b83a', Y: '#ffe27a', b: '#3e6ab0', B: '#6ea0f0', g: '#4a9a50', G: '#9ed46a', w: '#fffaf0', p: '#e0709a', P: '#ffd0e0', o: '#e8823a', O: '#ffb070' }],
  toybox: [['tttttttttt........', 'tTTTTTTTTt..rr....', 'tddddddddt.rRr.bb.', 'tddddddddtyyrr.bBb', 'tddddddddtyYy..bb.', 'tddddddddt.yygg...', 'tttttttttt...gGg..', '..............gg..'], { t: '#a8663e', T: '#e8b674', d: '#4a2a36', r: '#d8443a', R: '#ff8a7a', b: '#3e6ab0', B: '#6ea0f0', y: '#e8b83a', Y: '#ffe27a', g: '#4a9a50', G: '#9ed46a' }],
  dino: [['....gg', '...gGg', 'g.ggg.', 'ggggg.', '.g.g..'], { g: '#4a9a50', G: '#9ed46a' }],
};

function mess(px, level) {
  for (const [lv, x, y, kind] of MESS) {
    if (lv > level) continue;
    const [rows, pal] = MESS_ART[kind];
    const s = sprite(rows[0].length, rows.length, (b) => grid((xx, yy, c) => b.set(xx, yy, c), 0, 0, rows, pal), { pad: 1 });
    shadow(px, x + rows[0].length / 2, y + rows.length, rows[0].length / 2 + 1, 1.2, 0.2);
    s.blit(px, x, y);
  }
  // a very messy room also has dust bunnies in the corners
  if (level >= 3) for (const [x, y] of [[14, 102], [208, 66], [226, 164], [127, 166], [70, 50]]) grid(px, x, y, ['.gg.', 'gGgg', '.gg.'], { g: 'rgba(150,140,150,0.75)', G: 'rgba(210,200,210,0.85)' });
}

// ---------- the whole room ----------

const pieceArt = (item, state = {}) => {
  if (!item) return null;
  switch (item.spot) {
    case 'bed': return bedArt(item, state.made !== false);
    case 'table': return tableArt(item);
    case 'couch': return couchArt(item);
    case 'chair': return armchairArt(item);
    case 'corner': return cornerArt(item);
    case 'lamp': return lampArt(item);
    case 'rug': return rugArt(item, state.lift);
    case 'art': return pictureArt(item.look);
    default: return null;
  }
};

/** Where a placed piece's art goes (top-left), worked out from its spot and size. */
function placeOf(spot, b) {
  const a = R.at[spot];
  if (spot === 'table') return { x: 120 - Math.round(b.w / 2), y: a.y + (b.h < 32 ? 4 : 0) };
  if (spot === 'lamp') return { x: a.x, y: R.floorTop + 14 - b.h };
  if (spot === 'chair') return { x: a.x + Math.round((28 - b.w) / 2), y: a.y + (28 - b.h) };
  if (spot === 'corner') return { x: a.x, y: R.floorBottom - 4 - b.h };
  if (spot === 'rug') return { x: 120 - Math.round(b.w / 2), y: a.y + 2 };
  if (spot === 'bed') return { x: a.x, y: a.y };
  return a;
}

/**
 * Paints the room into canvas (ROOM.W x ROOM.H). o: {
 *   layout: furniture.js homeLayout(kid), made: the bed is made, teeth: the toothbrush is put
 *   away, mess: 0-3, shelf: 0-3, gear: bestGear(owned), color: the kid's color (the door),
 * }. Returns { pieces: [{ id, x, y, w, h, foot, canvas }] } for the pieces that stand out on
 * the floor (drawn by house.js as their own canvases, in front of or behind the buddy), and
 * blocks: [[x, y, w, h]...] where the buddy can't walk. The fish tank (ROOM.at.tank, TANK) is
 * always one of the pieces.
 */
export function paintRoom(canvas, o) {
  const { W, H } = R;
  canvas.width = W; canvas.height = H;
  const { px, put } = pixelBuffer(W, H);
  const lay = o.layout || {};
  const blocks = [];
  const pieces = [];
  backWall(px);
  floors(px);
  sunlight(px);

  // flat things on the floor: the rug (kicked crooked in a messy room), the mats
  if (lay.rug) {
    const b = pieceArt(lay.rug, { lift: o.mess >= 2 });
    const at = placeOf('rug', b);
    const off = o.mess >= 2 ? (o.mess >= 3 ? 6 : 3) : 0;
    b.blit(px, at.x + off, at.y + Math.round(off / 2));
  }
  const mat = R.mat;
  for (let y = 0; y < mat.h; y += 1) for (let x = 0; x < mat.w; x += 1) {
    const edge = x === 0 || y === 0 || x === mat.w - 1 || y === mat.h - 1;
    px(mat.x + x, mat.y + y, edge ? '#7a4436' : (y === 3 || y === 6) ? '#f0c060' : (x + y) % 2 ? '#c8783a' : '#a85a32');
  }
  const bm = R.at.bathmat;
  for (let y = 0; y < 9; y += 1) for (let x = 0; x < 22; x += 1) if (inEll(x, y, 11, 4.5, 11, 4.5)) px(bm.x + x, bm.y + y, (x + y) % 3 === 0 ? '#c0dcff' : '#8ab8e8');

  mess(px, o.mess || 0);

  // things against the back wall
  const at = R.at;
  windowArt().blit(px, at.window.x, at.window.y);
  chartArt().blit(px, at.chart.x, at.chart.y);
  const shelf = shelfArt(o.shelf || 0);
  shadow(px, at.shelf.x + 17, at.shelf.y + 46, 17, 2, 0.2);
  shelf.blit(px, at.shelf.x, at.shelf.y);
  blocks.push([at.shelf.x, R.floorTop - 2, 34, at.shelf.y + 48 - R.floorTop]);

  const bed = pieceArt(lay.bed, { made: o.made });
  if (bed) {
    const p = placeOf('bed', bed);
    shadow(px, p.x + bed.w / 2 + 2, p.y + bed.h, bed.w / 2 + 1, 2, 0.22);
    bed.blit(px, p.x, p.y);
    blocks.push([p.x - 1, R.floorTop - 2, bed.w + 2, p.y + bed.h - R.floorTop + 2]);
  }
  if (lay.art) { const a = pieceArt(lay.art); a.blit(px, at.art.x, at.art.y); }
  if (lay.couch) {
    const c = pieceArt(lay.couch);
    shadow(px, at.couch.x + 24, at.couch.y + 34, 24, 2, 0.22);
    c.blit(px, at.couch.x, at.couch.y);
    blocks.push([at.couch.x, R.floorTop - 2, 48, at.couch.y + 34 - R.floorTop + 2]);
  }
  if (lay.lamp) {
    const l = pieceArt(lay.lamp);
    const p = placeOf('lamp', l);
    shadow(px, p.x + l.w / 2, p.y + l.h, 5, 1.5, 0.22);
    l.blit(px, p.x, p.y);
    blocks.push([p.x + 2, p.y + l.h - 6, l.w - 4, 7]);
  }

  // the bathroom
  mirrorArt().blit(px, at.sink.x + 2, at.sink.y + 1);
  sinkArt(Boolean(o.teeth)).blit(px, at.sink.x, at.sink.y);
  blocks.push([at.sink.x, R.floorTop - 2, 20, at.sink.y + 46 - R.floorTop + 1]);
  towelArt().blit(px, at.towel.x, at.towel.y);
  showerArt().blit(px, at.shower.x, at.shower.y);
  blocks.push([at.shower.x - 1, R.floorTop - 2, 28, at.shower.y + 76 - R.floorTop + 1]);

  partition(px);
  frontWalls(px, o.color || '#e03131');
  put(canvas.getContext('2d'));

  // pieces standing out on the floor: their own canvases, so the buddy can go behind them
  const stand = (id, b, x, y, foot) => {
    const c = canvas.ownerDocument.createElement('canvas');
    const pad = b.pad;
    c.width = b.W; c.height = b.H;
    const buf = pixelBuffer(b.W, b.H);
    b.blit(buf.px, pad, pad);
    buf.put(c.getContext('2d'));
    pieces.push({ id, x: x - pad, y: y - pad, w: b.W, h: b.H, foot: y + b.h, canvas: c });
    blocks.push(foot);
  };
  if (lay.table) { const b = pieceArt(lay.table); const p = placeOf('table', b); stand('table', b, p.x, p.y, [p.x + 2, p.y + b.h - 12, b.w - 4, 12]); }
  if (lay.chair) { const b = pieceArt(lay.chair); const p = placeOf('chair', b); stand('chair', b, p.x, p.y, [p.x + 1, p.y + b.h - 10, b.w - 2, 10]); }
  if (lay.corner) { const b = pieceArt(lay.corner); const p = placeOf('corner', b); stand('corner', b, p.x, p.y, lay.corner.art === 'plant' ? [p.x + 3, p.y + b.h - 8, b.w - 6, 8] : [p.x, p.y + b.h - 14, b.w, 14]); }
  const g = gearArt(o.gear);
  if (g) stand('gear', g, at.gear.x, at.gear.y, [at.gear.x, at.gear.y + 24, 38, 12]);
  stand('basket', basketArt(), at.basket.x, at.basket.y, [at.basket.x, at.basket.y + 8, 16, 10]);
  // the fish tank is always there (free): the buddy looks in from behind it
  stand('tank', tankArt(), at.tank.x, at.tank.y, [at.tank.x, at.tank.y + 4, TANK.w, TANK.h - 4]);
  return { pieces, blocks };
}

/** A piece of furniture on its own, for the shop: a canvas sized to the piece (with a little room). */
export function furnitureThumb(doc, id) {
  const item = furnitureById(id);
  const b = pieceArt(item, { made: true });
  if (!b) return null;
  const c = doc.createElement('canvas');
  c.width = b.W; c.height = b.H;
  const buf = pixelBuffer(b.W, b.H);
  b.blit(buf.px, b.pad, b.pad);
  buf.put(c.getContext('2d'));
  return c;
}

export const SHELF_W = 34;
