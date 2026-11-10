// The ghost ship wreck, Sunset Beach's landmark (it stands there once the sunset treasure map is
// finished), drawn for the village in its storybook style: one village pixel per art pixel, the
// biggest thing on the beach. An old pirate ship run aground long ago and half buried in the
// sand: a weathered hull with faded teal paint, barnacles and seaweed, cannons in their ports, a
// broken mast with a crow's nest, a tattered patched sail, a stern castle whose windows glow a
// soft ghostly teal. A crab lives in a hole in the hull, a parrot keeps watch from the crow's
// nest, the anchor lies in the sand, a treasure chest spills its gold, and a bottle with a note
// waits on the beach. A cheap overlay animates it: the flag flutters, the windows breathe, the
// lantern flickers, the treasure glints, the crab snaps, the parrot bobs, and now and then a
// small friendly ghost peeks out (tapped, it floats up and waves).

import { mix, h2, vnoise, bayer, Buf, inEll, grid, pixelBuffer, clamp } from './pixelkit.js';

export const WRECK = { w: 168, h: 116 };
const W = WRECK.w; const H = WRECK.h;

const HU = ['#2a1828', '#40243a', '#583444', '#72464a', '#8c5c52', '#a8765e', '#c49674']; // hull wood, dark .. light
const MW = ['#3a2430', '#583a3c', '#7a5440', '#9c7250', '#bc946a', '#d8b888']; // mast and spars
const TL = ['#1c3e4a', '#28605e', '#3a8070', '#58a088', '#84c0a4', '#b4dcc0']; // the faded teal paint
const GD = ['#6a3a1e', '#a0682a', '#d49a36', '#f4c850', '#fff0a8']; // gold
const SL = ['#7a5e6a', '#bc9e94', '#dcc2aa', '#eedac0', '#fcefd6']; // the old sail
const RP = ['#5a3e3a', '#8a6a52', '#b8986e', '#e0c896']; // rope
const IR = ['#2a2638', '#423e56', '#625c78', '#8a84a0', '#b4aec6']; // iron
const SD = ['#7a5a6a', '#a87e7c', '#cc9e86', '#e2b98e', '#f0d0a2', '#f8e2bc', '#fff4dc']; // sand (as the village's)
const GHOST = ['#5ac8b0', '#8ae8d0', '#c8fff0', '#f4fffb'];
const WARM = ['#7a3a3a', '#c86a3a', '#f0a848', '#ffd878', '#fff4c8'];
const SEAWEED = ['#24503e', '#3a7448', '#5a9a52', '#86bc62'];
const INK = '#2e1a2a';

// ---------- the ship's shape ----------
// The hull is drawn level ("ship" coordinates), then tipped: run aground, its bow rides up the
// beach and its stern has sunk into the sand. Masts and sails are drawn after, leaning with it.

const BOW = 12; const CASTLE = 118; const STERN = 158;
const TILT = 0.085;
const sh = (x) => Math.round((x - 84) * TILT);
/** The near gunwale (ship coordinates): high at the bow, sagging amidships, rising to the stern. */
const gun = (x) => { const t = clamp((x - BOW) / (CASTLE - BOW), 0, 1); return Math.round(46 + 14 * (1 - (1 - t) ** 2) - 4 * t * t); };
/** How deep the deck looks from above (it narrows to nothing at the bow). */
const deckD = (x) => Math.round(8 * clamp((x - BOW - 2) / 22, 0, 1));
/** The castle's top, curving up towards the stern. */
const castleTop = (x) => Math.round(32 - (x - CASTLE) * 0.2);
const CASTLE_D = 6;
const top = (x) => (x >= CASTLE ? castleTop(x) : gun(x));
/** The bow's stem curving back down to the buried keel, and the stern raking out above the sand. */
const stemX = (y) => BOW + 24 * clamp((y - 46) / 50, 0, 1) ** 1.7;
const sternX = (y) => (y < 62 ? STERN - (y - 24) * 0.06 : STERN - 2.3 - (y - 62) * 0.3);
const inHull = (x, y) => y >= top(x) && x + 0.5 >= stemX(y) && x + 0.5 <= sternX(y) && y < 100;
/** The top of the sand heaped against the hull (art coordinates): piled up by the bow, deep at the stern. */
const drift = (x) => 86 + sh(x) - 6 * Math.exp(-(((x - 30) / 16) ** 2)) - 3 * Math.exp(-(((x - 128) / 14) ** 2)) + Math.sin(x / 17) * 1.8 + Math.sin(x / 6) * 1.1 + Math.sin(x / 2.7) * 0.5;

// where things are (art coordinates, tipped)
const deckY = (x) => gun(x) + sh(x) - 4;
const MAST = { x: 72, base: deckY(72), top: 3 };
const LEAN = 0.075; // the masts lean back with the ship
const mastX = (y) => MAST.x + (MAST.base - y) * LEAN;
const FORE = { x: 36, base: deckY(36), top: 20 };
const foreX = (y) => FORE.x + (FORE.base - y) * LEAN;
const NEST = { x: Math.round(mastX(11)), y: 10 };
const YARD = [[48, 18], [100, 15]];
const yardY = (x) => YARD[0][1] + ((x - YARD[0][0]) * (YARD[1][1] - YARD[0][1])) / (YARD[1][0] - YARD[0][0]);
const PORTS = [34, 56, 100].map((x) => ({ x, y: gun(x) + 7 + sh(x) }));
const WINDOWS = [[127, 40], [137, 40], [147, 40]].map(([x, y]) => [x, y + sh(x)]);
const HOLE = { x: 78, y: 78 + sh(78) };
const CHEST = { x: 120, y: 90 };
const LANTERN = { x: 163, y: 25 + sh(160) };
const HATCH = { x: 102, y: deckY(102) - 2 };

/** A rope from a to b, sagging by `sag` pixels in the middle. */
function rope(b, a, c, sag, col = RP[0], tag = 'rope') {
  const n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) * 1.5);
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    b.set(Math.round(a[0] + (c[0] - a[0]) * t), Math.round(a[1] + (c[1] - a[1]) * t + Math.sin(t * Math.PI) * sag), col, tag);
  }
}

/** The hull, level: far bulwark and deck, the near side's planks, paint, ports, the hole, the castle. */
function hullBuf() {
  const b = new Buf(W, H, 3);
  // the far side: its bulwark and the deck
  for (let x = BOW + 2; x < STERN; x += 1) {
    const g = top(x); const castle = x >= CASTLE; const D = castle ? CASTLE_D : deckD(x);
    if (D < 2) continue;
    const farTop = g - D - 3;
    for (let y = farTop; y < g; y += 1) {
      let c;
      if (y === farTop) c = HU[5];
      else if (y < g - D) c = y === g - D - 1 ? HU[1] : HU[2];
      else {
        const row = y - (g - D);
        const seam = (x + row * 7) % 17 === 0;
        c = seam ? HU[3] : row === 0 ? HU[3] : h2(Math.floor((x + row * 7) / 17), row, 5) < 0.35 ? HU[4] : HU[5];
        if (row === D - 1) c = HU[3];
      }
      b.set(x, y, c, 'deck');
    }
    if (x % 8 === 0) for (let y = farTop; y < g - D; y += 1) b.set(x, y, HU[4], 'deck');
  }
  // the castle's front wall above the main deck, with a little door
  for (let y = castleTop(CASTLE) - 1; y < gun(CASTLE) - 2; y += 1) for (let x = CASTLE - 5; x < CASTLE; x += 1) b.set(x, y, x === CASTLE - 5 ? HU[5] : (y % 4 === 0 ? HU[2] : HU[3]), 'hull');
  grid((x, y, c) => b.set(x, y, c, 'hull'), CASTLE - 5, 40, ['.dd.', 'dDDd', 'dDDd', 'dDkd', 'dDDd', 'dDDd', 'dDDd'], { d: HU[1], D: HU[0], k: GD[3] });
  // a hatch grate and barrels on the deck, a coil of rope on the castle
  grid((x, y, c) => b.set(x, y, c, 'deck'), 98, gun(98) - 6, ['dddddddddd', 'dkdkdkdkdd', 'dkdkdkdkdd', 'dddddddddd'], { d: MW[3], k: '#1a1020' });
  grid((x, y, c) => b.set(x, y, c, 'barrel'), 84, gun(84) - 11, ['.bbbb.', 'bBBBBb', 'iiiiii', 'bBbbBb', 'bBbbBb', 'iiiiii', 'bbbbbb', '.dddd.'], { b: MW[3], B: MW[4], i: IR[2], d: MW[1] });
  grid((x, y, c) => b.set(x, y, c, 'rope'), 132, castleTop(132) - 4, ['.rRRr.', 'rRrrRr', '.rrrr.'], { r: RP[1], R: RP[3] });

  // the near side
  for (let y = 20; y < 100; y += 1) for (let x = 0; x < W; x += 1) {
    if (!inHull(x, y)) continue;
    const g = gun(x); const castle = x >= CASTLE; const d = y - g;
    let c; let tag = 'hull';
    if (y === top(x)) c = HU[6]; // the rail cap
    else if (y === top(x) + 1) c = HU[4];
    else if (d >= 3 && d <= 11) {
      // the faded teal band, peeling here and there to the wood
      tag = 'paint';
      const peel = vnoise(x, y, 5, 41) > 0.75;
      c = d === 3 || d === 11 ? TL[1] : peel ? (bayer(x, y) < 0.5 ? HU[4] : HU[3]) : d < 5 ? TL[4] : d < 7 ? TL[3] : TL[2];
      if (!peel && d === 4 && h2(x >> 3, 0, 9) < 0.5) c = TL[5];
    } else if (d === 2 || d === 12) c = HU[1]; // the wales
    else {
      // planks along the hull, weathered: some bleached by the sun, some dark, butt joints staggered
      const k = d > 12 ? d - 13 : y - top(x);
      const row = Math.floor(k / 4) + (d > 12 ? 0 : 20); const r = ((k % 4) + 4) % 4;
      const seg = Math.floor((x + row * 13) / 21); const butt = (x + row * 13) % 21 === 0;
      const tone = h2(seg, row, 3);
      if (r === 3) c = HU[2];
      else if (butt) c = HU[2];
      else if (tone < 0.18) c = r === 0 ? HU[6] : HU[5]; // a bleached plank
      else if (tone > 0.86) c = r === 0 ? HU[3] : HU[2]; // a dark one
      else c = r === 0 ? HU[5] : HU[4];
      if (r === 1 && (x + row * 13) % 21 === 2) c = HU[2]; // a nail
    }
    if (castle && y >= top(x) + 4 && y < top(x) + 6) c = y === top(x) + 4 ? GD[3] : GD[1]; // the castle's gilded band
    // shading: the bow is lit, the stern turns away, the belly darkens towards the sand
    if (x + 0.5 - stemX(y) < 2.2) c = tag === 'paint' ? TL[5] : HU[6];
    else if (sternX(y) - x - 0.5 < 2.2) c = tag === 'paint' ? TL[1] : HU[2];
    const sand = drift(x) - sh(x);
    if (y > sand - 4 && bayer(x, y) < (y - sand + 4) / 6) c = tag === 'paint' ? TL[0] : y > sand - 1.5 ? HU[1] : HU[2];
    b.set(x, y, c, tag);
  }
  // the castle's rail of little balusters
  for (let x = CASTLE - 5; x <= sternX(castleTop(STERN)) - 1; x += 1) {
    const ty = castleTop(Math.max(x, CASTLE));
    b.set(x, ty - 6, MW[5], 'mast');
    if ((x - CASTLE) % 3 === 0) for (let y = ty - 5; y < ty - CASTLE_D + 5; y += 1) b.set(x, y, MW[3], 'mast');
  }
  // the stern gallery: ghost-lit windows in gold frames, carved gold at the corner
  [[127, 40], [137, 40], [147, 40]].forEach(([wx, wy]) => grid((x, y, c) => b.set(x, y, c, 'window'), wx - 3, wy, ['.ggggg.', 'gtTtTtg', 'gTtgtTg', 'gtTgTtg', 'ggggggg', 'gtTgTtg', 'gtTgTtg', 'ggggggg'], { g: GD[2], t: GHOST[1], T: GHOST[2] }));
  grid((x, y, c) => b.set(x, y, c, 'gold'), STERN - 8, 27, ['...gGg', '..gGGg', '.gGgg.', 'gGg...', 'gg....'], { g: GD[2], G: GD[4] });
  grid((x, y, c) => b.set(x, y, c, 'gold'), STERN - 12, 52, ['.ggg.', 'gGGGg', 'gG.Gg', '.g.g.'], { g: GD[1], G: GD[3] });
  // the rudder
  for (let y = 58; y < 98; y += 1) { const sx = Math.round(sternX(y)); for (let x = sx - 1; x < sx + 4; x += 1) b.set(x, y, x === sx - 1 ? HU[1] : y % 9 === 0 ? IR[2] : x === sx ? HU[4] : HU[3], 'hull'); }
  // the figurehead: a little golden mermaid under the bowsprit
  grid((x, y, c) => b.set(x, y, c, 'gold'), BOW - 4, 44, ['..gg..', '.gGGg.', 'gGgGg.', '.gGg..', '..gg..', '.gGg..', 'gg.gg.'], { g: GD[2], G: GD[4] });
  // the hawse hole
  grid((x, y, c) => b.set(x, y, c, 'iron'), 22, 56, ['.ii.', 'iKKi', '.ii.'], { i: IR[3], K: '#1a1020' });
  // gun ports with their lids propped open and old cannons peeking out
  [34, 56, 100].forEach((x) => {
    const y = gun(x) + 7;
    grid((xx, yy, c) => b.set(xx, yy, c, 'hull'), x - 4, y - 4, ['ddddddd.', '.LLLLLL.', '..lllll.'], { d: HU[0], L: HU[5], l: HU[3] });
    grid((xx, yy, c) => b.set(xx, yy, c, 'port'), x - 3, y - 1, ['kkkkkk', 'kkiIkk', 'kiKkIk', 'kiKKik', 'kkiikk', 'kkkkkk'], { k: '#1a1020', i: IR[1], I: IR[3], K: '#0e0814' });
  });
  // the hole stove in the hull: planks broken off at different lengths, a rib inside; the crab lives here
  const hx = 78; const hy = 78;
  for (let y = hy - 8; y <= hy + 7; y += 1) {
    const g = gun(hx); const row = Math.floor((y - g - 13) / 4);
    const span = 1 - ((y + 0.5 - hy) / 8.5) ** 2;
    if (span <= 0) continue;
    const l = Math.round(hx - span * 9 - (h2(row, 1, 19) - 0.5) * 6); const r = Math.round(hx + span * 9 + (h2(row, 2, 19) - 0.5) * 6);
    for (let x = l - 1; x <= r + 1; x += 1) {
      if (!inHull(x, y)) continue;
      if (x === l - 1 || x === r + 1) { b.set(x, y, (y - g - 13) % 4 === 3 ? HU[2] : x === l - 1 ? HU[6] : HU[5], 'hull'); continue; } // the broken ends, lit
      const deep = (x - hx) / 9;
      const ribX = hx + 3 + (y - hy) * 0.2;
      const rib = Math.abs(x + 0.5 - ribX) < 1.2;
      b.set(x, y, rib ? (x + 0.5 < ribX ? HU[3] : HU[2]) : y > hy + 2 ? '#3a2232' : deep < -0.4 ? '#2a1828' : '#1a0e1c', 'hole');
    }
  }
  // sand spilled into it
  for (let x = hx - 8; x <= hx + 9; x += 1) { const s0 = hy + 3 + Math.round(Math.abs(x - hx) * 0.3); for (let y = s0; y <= hy + 7; y += 1) if (b.tag(x, y) === 'hole') b.set(x, y, y === s0 ? SD[5] : SD[3], 'hole'); }
  // a rope ladder down the side, for climbing aboard
  const lx = 44;
  for (let y = gun(lx) + 1; y < 92; y += 1) { b.set(lx, y, RP[1], 'rope'); b.set(lx + 5, y, RP[0], 'rope'); }
  for (let y = gun(lx) + 4; y < 92; y += 4) for (let x = lx; x <= lx + 5; x += 1) b.set(x, y, x === lx || x === lx + 5 ? RP[1] : RP[3], 'rope');
  // seaweed draped on the hull, barnacles crusting it near the sand, a starfish clinging on
  [[20, 58, 9], [66, gun(66) + 12, 12], [112, gun(112) + 12, 8], [150, 60, 10]].forEach(([x0, y0, n], i) => {
    for (let k = 0; k < n; k += 1) {
      const x = x0 + Math.round(Math.sin(k / 2.2 + i) * 1.2);
      b.set(x, y0 + k, SEAWEED[k < 2 ? 3 : k % 3 === 0 ? 1 : 2], 'weed');
      if (k > 2 && k % 3 === 1) b.set(x + 1, y0 + k, SEAWEED[1], 'weed');
    }
  });
  for (let x = 18; x < STERN; x += 1) {
    if (vnoise(x, 0, 9, 23) < 0.62) continue; // in clusters
    const y = Math.round(drift(x) - sh(x)) - 2 - (h2(x, 2, 9) < 0.5 ? 1 : 0) - (h2(x, 3, 9) < 0.3 ? 2 : 0);
    if (h2(x, 4, 9) < 0.6 && inHull(x, y) && b.tag(x, y) !== 'hole') { b.set(x, y, '#ece4ee', 'barnacle'); b.set(x, y + 1, '#9a8aa0', 'barnacle'); if (h2(x, 5, 9) < 0.4) b.set(x + 1, y, '#c8bcd0', 'barnacle'); }
  }
  grid((x, y, c) => b.set(x, y, c, 'star'), 118, 76, ['..o..', 'ooOoo', '.oOo.', 'o.o.o'], { o: '#f07a5a', O: '#ffc09a' });
  return b;
}

function paintWreck() {
  const out = pixelBuffer(W, H);
  const { px } = out;
  // a soft shadow on the sand under it all
  for (let y = 80; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const d = ((x + 0.5 - 90) / 84) ** 2 + ((y + 0.5 - 101) / 13) ** 2;
    if (d <= 1) px(x, y, `rgba(42,24,56,${d < 0.5 ? 0.22 : 0.11})`);
  }
  // the hull, tipped as it lies
  const b = new Buf(W, H, 3);
  const hb = hullBuf();
  hb.each((x, y) => { const c = hb.get(x, y); if (c) b.set(x, y + sh(x), c, hb.tag(x, y)); });

  // the bowsprit, jutting from the bow up into the air
  for (let i = 0; i <= 30; i += 1) {
    const t = i / 30; const x = 20 - t * 18; const y = 48 + sh(20) - t * 19; const r = 1.8 - t * 0.6;
    for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) if (Math.hypot(xx, yy) <= r) b.set(Math.round(x + xx), Math.round(y + yy), yy < 0 || xx < 0 ? MW[4] : MW[2], 'mast');
  }
  // the foremast, snapped off long ago
  for (let y = FORE.top; y <= FORE.base; y += 1) { const x0 = Math.round(foreX(y)); b.set(x0 - 1, y, MW[4], 'mast'); b.set(x0, y, MW[3], 'mast'); b.set(x0 + 1, y, MW[1], 'mast'); }
  grid((x, y, c) => b.set(x, y, c, 'mast'), Math.round(foreX(FORE.top)) - 2, FORE.top - 4, ['..s..', '.ss.s', 'sSs.s', 's.Ss.'], { s: MW[4], S: MW[5] });
  // the main mast, its top broken off above the crow's nest
  for (let y = MAST.top; y <= MAST.base; y += 1) {
    const x0 = Math.round(mastX(y));
    b.set(x0 - 1, y, MW[4], 'mast'); b.set(x0, y, MW[3], 'mast'); b.set(x0 + 1, y, MW[2], 'mast');
    if (y > 22) b.set(x0 + 2, y, MW[1], 'mast');
    if (y % 9 === 4 && y > 24) for (let k = -1; k <= 2; k += 1) b.set(x0 + k, y, RP[2], 'rope');
  }
  grid((x, y, c) => b.set(x, y, c, 'mast'), Math.round(mastX(MAST.top)) - 2, MAST.top - 3, ['.s.s.', 'sSs.s', '.sSs.'], { s: MW[4], S: MW[5] });
  // the stern lantern on its iron bracket (it glows in the overlay)
  for (let x = STERN - 2; x <= LANTERN.x; x += 1) b.set(x, LANTERN.y - 5, IR[2], 'iron');
  grid((x, y, c) => b.set(x, y, c, 'iron'), LANTERN.x - 2, LANTERN.y - 4, ['..i..', '.iii.', 'iwWwi', 'iWYWi', 'iwWwi', '.iii.', '..i..'], { i: IR[1], w: WARM[2], W: WARM[3], Y: WARM[4] });
  // the yard
  for (let x = YARD[0][0]; x <= YARD[1][0]; x += 1) {
    const y = Math.round(yardY(x)); const end = x < YARD[0][0] + 2 || x > YARD[1][0] - 2;
    b.set(x, y, end ? MW[3] : MW[4], 'mast'); b.set(x, y + 1, MW[2], 'mast');
  }
  // the sail: old canvas hanging from the yard, billowing, worn through, torn and patched
  const sailL = 51; const sailR = 97;
  for (let x = sailL; x <= sailR; x += 1) {
    const u = (x - sailL) / (sailR - sailL);
    const y0 = Math.round(yardY(x)) + 2;
    let y1 = 44 + Math.round(Math.sin(u * Math.PI) * 3) - Math.round(u * 3) + (h2(x, 1, 7) < 0.35 ? -1 : 0) + ((x * 7) % 5 === 0 ? -2 : 0);
    if (x >= 54 && x <= 56) y1 = 52 - (x - 54);
    if (u > 0.76) y1 = Math.min(y1, 44 - Math.round((u - 0.76) * 54));
    for (let y = y0; y <= y1; y += 1) {
      const v = (y - y0) / Math.max(1, 44 - y0);
      if (inEll(x, y, 62, 30, 2.6, 2.2) || inEll(x, y, 89, 33, 2.2, 1.8) || inEll(x, y, 81, 23, 1.2, 1)) continue;
      const s = u + Math.sin(v * Math.PI) * 0.12;
      let k = s < 0.22 ? 4 : s < 0.6 ? 3 : s < 0.9 ? 2 : 1;
      if (Math.abs(u - 0.47) < 0.03 && v > 0.15) k = Math.max(1, k - 1);
      if (y === y0) k = 1;
      if (v > 0.15 && v < 0.5 && (x - 53) % 11 === 0) k = Math.max(1, k - 1);
      b.set(x, y, SL[k], 'sail');
    }
  }
  for (let y = 32; y < 39; y += 1) for (let x = 67; x < 74; x += 1) b.set(x, y, (x === 67 || y === 32) ? '#e09a7a' : (x + y) % 5 === 0 ? '#9a4a44' : '#c8705a', 'sail');
  [[67, 34], [69, 32], [73, 35], [71, 38]].forEach(([x, y]) => b.set(x, y, SL[4], 'sail'));
  // the crow's nest
  grid((x, y, c) => b.set(x, y, c, 'mast'), NEST.x - 6, NEST.y, ['rrrrrrrrrrrrr', 'wWWwwWWwwwwwd', 'wwWwwwWwwwwdd', '.wwwwwwwwwdd.', '..dddddddd...'], { r: MW[5], w: MW[3], W: MW[4], d: MW[1] });
  // rigging: shrouds up to the crow's nest with ratlines low down, stays fore and aft
  const at = (x) => [x, gun(x) + sh(x)];
  const shrouds = [[at(50), [NEST.x - 4, NEST.y + 5]], [at(55), [NEST.x - 2, NEST.y + 5]], [at(97), [NEST.x + 5, NEST.y + 5]], [at(92), [NEST.x + 3, NEST.y + 5]]];
  shrouds.forEach(([a, c]) => rope(b, a, c, 0, RP[0]));
  for (let k = 1; k < 9; k += 1) {
    const t = k / 9;
    for (const [i, j] of [[0, 1], [3, 2]]) {
      const [a1, c1] = shrouds[i]; const [a2, c2] = shrouds[j];
      const p1 = [a1[0] + (c1[0] - a1[0]) * t, a1[1] + (c1[1] - a1[1]) * t]; const p2 = [a2[0] + (c2[0] - a2[0]) * t, a2[1] + (c2[1] - a2[1]) * t];
      if (b.tag(Math.round((p1[0] + p2[0]) / 2), Math.round((p1[1] + p2[1]) / 2)) !== 'sail') rope(b, p1, p2, 0, RP[1]);
    }
  }
  rope(b, [Math.round(mastX(6)), 6], [3, 29 + sh(20) - 1], 3, RP[0]);
  rope(b, [Math.round(mastX(7)) + 1, 7], [152, 21 + sh(152)], 4, RP[0]);
  rope(b, [Math.round(foreX(FORE.top)), FORE.top + 1], [27, 42], 2, RP[1]);
  for (let k = 0; k < 4; k += 1) b.set(27 - (k % 2), 42 + k, RP[1], 'rope');

  b.outline((t, side) => {
    if (t === 'rope' || t === 'weed' || t === 'barnacle' || t === 'hole' || t === 'star' || t === 'window' || t === 'port') return null;
    if (t === 'sail') return side === 'bottom' || side === 'right' ? SL[0] : mix(SL[0], SL[1], 0.5);
    if (t === 'gold') return side === 'bottom' || side === 'right' ? GD[0] : null;
    if (t === 'mast' || t === 'barrel') return side === 'bottom' || side === 'right' ? MW[0] : MW[1];
    if (t === 'iron') return IR[0];
    if (t === 'paint') return side === 'bottom' ? TL[0] : HU[0];
    return side === 'bottom' || side === 'right' ? INK : HU[0];
  });
  b.blit(px, 0, 0);
  // the windows' ghost light spills softly round them
  WINDOWS.forEach(([wx, wy]) => { for (let y = -3; y < 11; y += 1) for (let x = -6; x < 7; x += 1) { const d = (x / 6.5) ** 2 + ((y - 4) / 7) ** 2; if (d < 1 && d > 0.45 && bayer(wx + x, wy + y) < 0.5) px(wx + x, wy + y, 'rgba(160,255,230,0.18)'); } });

  // ---------- the sand heaped against the hull, and what lies on it ----------
  for (let y = 66; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const dTop = drift(x);
    if (y < dTop) continue;
    const e = ((x + 0.5 - 86) / 88) ** 2 + ((y + 0.5 - 98) / 19) ** 2;
    if (e > 1) continue;
    const fade = e > 0.6 ? (1 - e) / 0.4 : 1;
    if (bayer(x, y) > fade) continue;
    const r = y - dTop;
    const wave = Math.sin(x / 4 + y * 1.3 + Math.sin(x / 11) * 2);
    let c = r < 1 ? SD[6] : r < 2.5 ? SD[5] : SD[4];
    if (r >= 2.5 && wave > 0.84) c = SD[3]; else if (r >= 2.5 && wave < -0.9) c = SD[5];
    if (r >= 2.5 && r < 5.5 && bayer(x, y) < 0.5 - (r - 2.5) * 0.14) c = SD[3]; // the hull's shadow on the sand
    px(x, y, c);
  }
  // the anchor, its ring up and one fluke out of the sand, its chain from the hawse hole
  for (let k = 0; k <= 16; k += 1) { const t = k / 16; px(Math.round(23 - t * 10 - Math.sin(t * Math.PI) * 2), Math.round(57 + sh(22) + t * (68 - 57 - sh(22)) + Math.sin(t * Math.PI) * 2), k % 2 ? IR[3] : IR[1]); }
  const ANCHOR = [
    '.......rrrr.......',
    '......r....r......',
    '.......rrrr.......',
    '..SSSSSSSSSSSSSs..',
    '..sssssssssssss...',
    '........Ii........',
    '........Ii........',
    '........Ii........',
    '........Ii........',
    '........Ii........',
    'F.......Ii.......F',
    'FF......Ii......Ff',
    '.Ff.....Ii.....Ff.',
    '..Ff....Ii....Ff..',
    '...FFf..Ii..fFf...',
    '.....FFFIiFFff....',
    '.......FFff.......',
  ];
  const ab = new Buf(24, 20, 3);
  // it leans back against the bow
  grid((x, y, c) => ab.set(x + Math.round((16 - y) * 0.22), y, c, 'iron'), 0, 0, ANCHOR, { r: IR[3], s: IR[1], S: IR[3], I: IR[3], i: IR[1], F: IR[3], f: IR[1] });
  [[6, 3], [13, 4], [12, 8], [6, 12], [11, 14]].forEach(([x, y]) => ab.set(x + Math.round((16 - y) * 0.22), y, '#c8683a', 'iron'));
  ab.outline((t, side) => (side === 'bottom' || side === 'right' ? IR[0] : IR[1]));
  ab.blit(px, 1, 68);
  for (let x = 2; x < 26; x += 1) { const y = 84 + Math.round(Math.abs(x - 12) * 0.16); px(x, y, SD[6]); px(x, y + 1, SD[5]); if (x > 5 && x < 21) px(x, y + 2, SD[4]); } // its crown is buried

  // the treasure chest, lid thrown back, gold spilling out
  const cb = new Buf(36, 22, 3);
  grid((x, y, c) => cb.set(x, y, c, 'chest'), 3, 0, [
    '.LLLLLLLLLLLLLLLL.',
    'LlggllllllllllggLl',
    'LvvvvvvvvvvvvvvvvL',
    'LvVvvvvvvvvvvvvVvL',
    'LvvvvvvvvvvvvvvvvL',
  ], { L: '#7a3e3a', l: '#a8584a', g: GD[2], v: '#7a2a4a', V: '#a83a5a' });
  grid((x, y, c) => cb.set(x, y, c, 'gold'), 2, 5, [
    '....cCc..cCcc.cCc...',
    '..cCcCccCcRrcCcccc..',
    '.ccCcccccCrRccCcBbc.',
    'cCcccccCccccccccbBcc',
  ], { c: GD[2], C: GD[4], R: '#ff5a6a', r: '#c82a4a', B: '#6ac8ff', b: '#2a6ad8' });
  grid((x, y, c) => cb.set(x, y, c, 'chest'), 2, 9, [
    'WWWWWWWWWWWWWWWWWWWW',
    'wggwwwwwwwkwwwwwwggw',
    'wwwwwwwwwKKKwwwwwwww',
    'wwwwwwwwwwKwwwwwwwww',
    'dggddddddddddddddggd',
    'dddddddddddddddddddd',
    '.dddddddddddddddddd.',
  ], { W: '#c8784a', w: '#a8584a', d: '#7a3e3a', g: GD[3], k: GD[4], K: GD[2] });
  [[23, 13], [26, 15], [29, 14], [28, 17], [24, 18], [31, 17], [33, 15]].forEach(([x, y], i) => grid((xx, yy, c) => cb.set(xx, yy, c, 'gold'), x, y, i % 2 ? ['cC', 'cc'] : ['Cc'], { c: GD[2], C: GD[4] }));
  grid((x, y, c) => cb.set(x, y, c, 'gold'), 23, 8, ['.gGg', 'gGGg', '.gg.', '..g.', '.ggg'], { g: GD[2], G: GD[4] }); // a gold goblet
  cb.outline((t, side) => (side === 'bottom' || side === 'right' ? INK : t === 'gold' ? GD[0] : '#4a2430'));
  for (let x = 4; x < 38; x += 1) px(CHEST.x + x - 1, CHEST.y + 18, 'rgba(42,24,56,0.25)');
  cb.blit(px, CHEST.x, CHEST.y);

  // the message in a bottle, washed up in front
  for (let x = 87; x < 106; x += 1) px(x, 109, 'rgba(42,24,56,0.22)');
  grid(px, 86, 102, [
    '........kkkkkkkkk.',
    'cC...kkgGGGGGGGgk.',
    'cCkkkgGgnnNnnngggk',
    'ccgggggnnnnNnngggk',
    '..kkkggggggggggggk',
    '.....kkddddddddkk.',
  ], { c: '#c8a070', C: '#e8c890', k: '#2a5a3a', g: '#6ac88a', G: '#d8fce0', n: '#fff4d8', N: '#e8a070', d: '#3a8a5a' });
  // shells and a little starfish on the heap
  grid(px, 58, 104, ['.pP', 'ppp', '.d.'], { p: '#ffb8c8', P: '#ffffff', d: '#d07a90' });
  grid(px, 110, 109, ['.o.', 'oOo', 'o.o'], { o: '#f07a5a', O: '#ffc09a' });
  grid(px, 36, 104, ['wW', 'ww'], { w: '#fff6ea', W: '#ffffff' });

  return new ImageData(out.data, W, H);
}

let base = null;
const wreckBase = () => (base ||= paintWreck());

// ---------- the overlay: what moves ----------

const PARROT = [
  ['..rr..', '.rrwk.', 'rrrrYb', 'rrrr..', 'rGBr..', 'rGBr..', '.rr...', '.y.y..'],
  ['..rr..', '.rrwk.', 'rrrrYb', 'GrrrG.', 'GBrrBG', '.Brr.B', '.rr...', '.y.y..'],
];
const PARROT_PAL = { r: '#e8384a', w: '#ffffff', k: '#1a1020', Y: '#ffd23f', b: '#3a2a3a', G: '#3ac06a', B: '#3a8ae8', y: '#3a2a3a' };
const GHOST_ROWS = ['..wwwww..', '.wwwwwwW.', 'wwkwwwkwW', 'wwkwwwkwW', 'wpwwwwwpW', 'wwwwmmwwW', 'wwwwwwwwW', 'wwwwwwwwW'];
const SPARKLE_AT = [[129, 95], [136, 93], [143, 96], [149, 103], [126, 99], [153, 106]];

/**
 * Starts the wreck on its canvas. Returns step(now), to call every animation frame; it redraws
 * about ten times a second. host.dataset.wake (a performance.now() time) wakes it for a while:
 * the ghost floats up out of the hatch and waves, the windows shine, the parrot flaps, the crab
 * waves both claws, and the treasure sparkles.
 */
export function startWreck(canvas, host) {
  const ctx = canvas.getContext('2d');
  const img = wreckBase();
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const sprite = (rows, X, Y, pal, flip = false) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x += 1) { const c = pal[r[x]]; if (c) dot(flip ? X + r.length - 1 - x : X + x, Y + y, c); } });
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const awake = since < 4000;
    ctx.putImageData(img, 0, 0);

    // the flag at the broken masthead, fluttering
    const fx = Math.round(mastX(MAST.top)) + 1; const fy = MAST.top - 2;
    const FLAG = ['kkkkkkkkkk', 'kkkwwwkkkk', 'kkwkwkwkkk', 'kkkwwwkkkk', 'kkwkkkwkkk', 'kkkkkkkkkk'];
    for (let x = 0; x < 10; x += 1) {
      const wave = Math.round(Math.sin(t * (awake ? 9 : 5) - x * 0.8) * (x / 9) * 1.4);
      for (let y = 0; y < FLAG.length; y += 1) {
        if (x === 9 && (y + f) % 3 === 0) continue; // its tattered end
        dot(fx + x, fy + y + wave, FLAG[y][x] === 'w' ? '#f4f0f6' : y === 0 ? '#4a3a5a' : '#2a2038');
      }
    }
    dot(fx - 1, fy - 1, MW[4]); dot(fx - 1, fy, MW[3]);

    // the castle windows breathe a soft ghostly light
    const g = 0.5 + 0.5 * Math.sin(t * 1.4);
    WINDOWS.forEach(([wx, wy], i) => {
      const a = (awake ? 0.45 : 0.12) + g * 0.25 * (0.6 + 0.4 * Math.sin(t * 2 + i));
      ctx.fillStyle = `rgba(200,255,240,${a})`; ctx.fillRect(wx - 2, wy + 1, 5, 6);
    });
    // the stern lantern flickers warm
    const fl = 0.6 + 0.25 * Math.sin(t * 7.3) + 0.15 * Math.sin(t * 13.1);
    ctx.fillStyle = `rgba(255,216,120,${0.14 + fl * 0.16})`; ctx.fillRect(LANTERN.x - 3, LANTERN.y - 2, 7, 6);
    dot(LANTERN.x, LANTERN.y, fl > 0.7 ? WARM[4] : WARM[3]);

    // the parrot in the crow's nest: bobs, looks about, flaps now and then (and when tapped)
    const flap = awake ? f % 4 < 2 : (t % 6.5) < 0.6 && f % 4 < 2;
    const bob = (t % 1.6) < 0.8 ? 0 : 1;
    sprite(PARROT[flap ? 1 : 0], NEST.x - 6, NEST.y - 8 + bob - (flap ? 1 : 0), PARROT_PAL, (t % 9) > 6);

    // the crab in the hole: eyes up on stalks, a claw snapping; tapped, both claws wave
    const cx = HOLE.x - 1; const cy = HOLE.y + 1;
    const peek = awake || (t % 8) > 1.2;
    if (peek) {
      const snap = awake ? f % 3 === 0 : (t % 1.7) < 0.2;
      const up = awake ? f % 2 : 0;
      dot(cx - 1, cy - 3, '#ffffff'); dot(cx + 2, cy - 3, '#ffffff'); dot(cx - 1, cy - 2, '#e8504a'); dot(cx + 2, cy - 2, '#e8504a');
      dot(cx - 1, cy - 4, '#1a1020'); dot(cx + 2, cy - 4, '#1a1020');
      ctx.fillStyle = '#e8504a'; ctx.fillRect(cx - 2, cy - 1, 6, 3);
      ctx.fillStyle = '#ff8a6a'; ctx.fillRect(cx - 1, cy - 1, 4, 1);
      ctx.fillStyle = '#b8303a'; ctx.fillRect(cx - 2, cy + 1, 6, 1);
      // claws
      ctx.fillStyle = '#e8504a';
      ctx.fillRect(cx - 5, cy - 2 - up, 3, 2); ctx.fillRect(cx + 4, cy - 2 - (awake ? 1 - up : 0), 3, 2);
      if (!snap) { dot(cx - 5, cy - 3 - up, '#ff8a6a'); dot(cx + 6, cy - 3 - (awake ? 1 - up : 0), '#ff8a6a'); }
    }

    // ghostly wisps drift up out of the hatch and the hole
    for (let i = 0; i < (awake ? 7 : 4); i += 1) {
      const p = (t / 3.2 + i * 0.29) % 1;
      const [ox, oy] = i % 2 ? [HATCH.x + 4, HATCH.y] : [HOLE.x - 2, HOLE.y - 4];
      const x = ox + Math.sin(p * 6 + i * 2) * 3 + (i % 3) - 1; const y = oy - p * (i % 2 ? 22 : 14);
      const a = Math.sin(p * Math.PI) * (awake ? 0.75 : 0.45);
      if (a < 0.08) continue;
      ctx.fillStyle = `rgba(170,255,232,${a.toFixed(2)})`; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (a > 0.35) { ctx.fillStyle = `rgba(170,255,232,${(a * 0.4).toFixed(2)})`; ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3); }
    }

    // the treasure glints
    const n = awake ? SPARKLE_AT.length : 3;
    for (let i = 0; i < n; i += 1) {
      const p = (t * (awake ? 1.6 : 0.7) + i * 0.37) % 1;
      if (p > 0.35) continue;
      const [sx, sy] = SPARKLE_AT[(i + Math.floor(t * 0.7 + i * 0.37)) % SPARKLE_AT.length];
      const s = p < 0.17 ? 1 : 2;
      ctx.fillStyle = 'rgba(255,250,220,0.9)';
      ctx.fillRect(sx - s, sy, s * 2 + 1, 1); ctx.fillRect(sx, sy - s, 1, s * 2 + 1);
      dot(sx, sy, '#ffffff');
    }

    // the friendly ghost: peeks out of a gun port now and then; tapped, it floats up and waves
    const pal = { w: GHOST[3], W: GHOST[2], k: '#2a3a4a', p: '#ffb8c8', m: '#2a3a4a' };
    if (awake) {
      const u = Math.min(1, since / 900); const down = Math.max(0, (since - 3200) / 800);
      const gx = HATCH.x; const gy = Math.round(HATCH.y - 3 - (u - down) * 26 + Math.sin(t * 3) * 1.5);
      ctx.fillStyle = 'rgba(200,255,240,0.25)'; ctx.fillRect(gx - 2, gy - 1, 13, 11); ctx.fillRect(gx - 1, gy - 2, 11, 13);
      sprite(GHOST_ROWS, gx, gy, pal);
      for (let x = 0; x < 9; x += 1) if ((x + f) % 2 === 0) dot(gx + x, gy + 8, x === 8 ? GHOST[1] : GHOST[2]); // its wavy hem
      const wave = f % 4 < 2; // one little arm waves hello
      dot(gx + 9, gy + 4 - (wave ? 1 : 0), GHOST[3]); dot(gx + 10, gy + 3 - (wave ? 2 : 0), GHOST[3]); dot(gx - 1, gy + 5, GHOST[2]);
    } else if ((t % 12) > 10.4) {
      const P = PORTS[(Math.floor(t / 12)) % PORTS.length];
      ctx.fillStyle = 'rgba(220,255,245,0.85)'; ctx.fillRect(P.x - 2, P.y + 1, 4, 3);
      dot(P.x - 1, P.y + 2, '#2a3a4a'); dot(P.x + 1, P.y + 2, '#2a3a4a');
    }
  };
}
