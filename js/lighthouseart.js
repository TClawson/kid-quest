// The old lighthouse, the Alaskan Fjord's landmark, drawn for the village at one art pixel per
// village pixel (LIGHTHOUSE.w x LIGHTHOUSE.h): a white tower with two red bands on a skerry in
// the bay, an iron gallery and a glass lantern under a red dome, the keeper's hut beside it, a
// fat sea lion asleep on the rocks and a gull on the railing. In winter snow lies on the dome,
// the hut and the rock.
//
// Asleep, the lamp is dark, the sea lion snores, the gull looks about and the swell laps at the
// rock. Tapped, the lamp comes on and its beam sweeps round the bay, the hut's window lights and
// its chimney smokes, the sea lion sits up and barks, and the gull takes off. While the map's
// show plays (the northern lights) it all keeps going.
//
// The still parts are painted once into ImageData; startLighthouse() redraws the moving parts
// about ten times a second. village.js uses it for the landmark whose art is 'lighthouse'.

import { h2, vnoise, bayer, pixelBuffer } from './pixelkit.js';

export const LIGHTHOUSE = { w: 112, h: 144 };
const W = LIGHTHOUSE.w; const H = LIGHTHOUSE.h;
const CX = 56;
const INK = '#241e32';
const WH = ['#7c829c', '#a4a9c0', '#c8ccdc', '#e6e9f2', '#ffffff']; // whitewash, shade to light
const RD = ['#6e1826', '#9c2a38', '#c63e48', '#e4605e', '#f48a7c'];
const IR = ['#1c1e2c', '#30344a', '#4c5268', '#727890'];
const GL = ['#2e3c52', '#4a6078', '#7896ac', '#a8c4d4']; // the lantern's glass, dark
const LAMP = ['#f2a830', '#ffd24a', '#ffec8c', '#fffbe0'];
const RK = ['#28263a', '#3e3b4c', '#585462', '#746e7a', '#928c90', '#b2aca8', '#d0cac2'];
const MOSS = ['#2a5438', '#3c7444', '#58964e', '#82b862'];
const SNOW = ['#b8cce6', '#dce8f6', '#ffffff'];

// the tower, from the gallery down to the rock
const TOWER = { top: 46, foot: 123 };
const towerHw = (y) => 8.5 + ((y - TOWER.top) / (TOWER.foot - TOWER.top)) * 4.5;
const band = (y) => (y >= 60 && y < 74) || (y >= 92 && y < 106);
const LANTERN = { top: 26, bottom: 42, hw: 6, cy: 34 };
const DOME = { top: 16, base: 26, hw: 8.5 };
// the skerry: its top edge and where the sea meets it
const rockU = (x) => (x + 0.5 - CX) / 46;
const rockTop = (x) => Math.round(115 + 17 * rockU(x) ** 4 + (vnoise(x, 0, 7, 11) - 0.5) * 5);
const waterline = (x) => 139 + Math.round(Math.sin(x / 7) * 0.9);
const HUT = { x0: 22, x1: 41, top: 107, ridge: 97 };
const SEAL = { x: 70, y: 107 }; // where the sea lion's sprite goes (its top left)
const GULL = { x: 64, y: 30 };

// the sea lion, facing left: h head, b body, B the light on its back, f flippers, n nose, e eye, w whiskers
const SEAL_ASLEEP = [
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '................bbbb......',
  '.............bbbBBBBbb....',
  '..hhhh....bbbbBBBBBBBBb...',
  '.hhhhhhbbbbbbbBBBBBBBBbb..',
  'nhh-hhhbbbbbbbbbBBBBBbbbb.',
  'whhhhhbbbbbbbbbbbbbbbbbbff',
  '.fffffbbbbbbbbbbbbbbbbffff',
  'ffff....fffff........fff..',
];
const SEAL_AWAKE = [
  '....hh....................',
  '...hhhh...................',
  '.nhhehh...................',
  '.whhhhh...................',
  '...hhhhb..................',
  '...hhbbbb.......bbbb......',
  '...bbbbbbb...bbbBBBBbb....',
  '...bbbbbbbbbbbBBBBBBBBb...',
  '...bbbbbbbbbbbBBBBBBBBbb..',
  '..fbbbbbbbbbbbbbBBBBBbbbb.',
  '.ffbbbbbbbbbbbbbbbbbbbbbff',
  '.ff.ffbbbbbbbbbbbbbbbbffff',
  '....ffff.fffff.......fff..',
];
// barking: its mouth open
const SEAL_BARK = SEAL_AWAKE.map((r, i) => (i === 2 ? 'n.hhehh...................' : i === 3 ? '.nhhhhh...................' : r));
const SEAL_PAL = { h: '#b98450', b: '#7c5230', B: '#c4905a', f: '#46291c', n: '#22161a', e: '#1b1430', w: '#f0e2cc', '-': '#46291c' };
const GULL_SIT = [['.ww...', 'wwwwy.', 'gggw..', '.gg...'], ['..ww..', '.ywwww', '..wggg', '...gg.']];
const GULL_FLY = [['g....g', '.gwwg.', '..wwy.', '......'], ['......', '..wwy.', '.gwwg.', 'g....g']];
const GULL_PAL = { w: '#ffffff', g: '#9aa4b8', y: '#ffb02e' };
const ZED = ['zzz', '.z.', 'zzz'];

function paintBack(snowy) {
  const out = pixelBuffer(W, H);
  const { px } = out;
  // ----- the skerry -----
  for (let x = 10; x <= 101; x += 1) {
    const top = rockTop(x); const wl = waterline(x);
    for (let y = top; y <= wl; y += 1) {
      const d = y - top;
      let k = 3 + (vnoise(x * 1.2, y * 0.5, 6, 3) > 0.56 ? 1 : 0) - (rockU(x) > 0.25 ? 1 : 0) + (rockU(x) < -0.4 ? 1 : 0);
      if (d < 2) k = 5 + (rockU(x) < 0.2 ? 1 : 0); // the lit top edge
      else if (d < 4 && bayer(x, y) < 0.5) k += 1;
      if (h2(x, Math.floor(y / 3), 5) > 0.92 || h2(Math.floor(x / 4), y, 6) > 0.95) k -= 2; // cracks and ledges
      if (y > wl - 4) k = y > wl - 2 ? 0 : 1; // wet and dark at the water
      let c = RK[Math.max(0, Math.min(6, k))];
      if (snowy) { if (d < 3 || (d < 5 && bayer(x, y) < 0.5)) c = d === 0 ? SNOW[2] : rockU(x) > 0.3 ? SNOW[0] : SNOW[1]; }
      else if (d < 3 && Math.abs(rockU(x)) < 0.82 && vnoise(x, 3, 5, 21) > 0.42) c = MOSS[d === 0 ? 3 : d === 1 ? 2 : 1];
      px(x, y, c);
    }
    if (x === 10 || x === 101) for (let y = rockTop(x); y <= waterline(x); y += 1) px(x, y, INK);
  }
  // ----- the keeper's hut -----
  for (let y = HUT.ridge; y <= 121; y += 1) {
    for (let x = HUT.x0 - 2; x <= HUT.x1 + 2; x += 1) {
      const mid = (HUT.x0 + HUT.x1) / 2;
      if (y < HUT.top) {
        // the roof: a red gable
        const hw = ((y - HUT.ridge + 1) / (HUT.top - HUT.ridge)) * (mid - HUT.x0 + 2.5);
        if (Math.abs(x + 0.5 - mid) > hw) continue;
        const edge = Math.abs(x + 0.5 - mid) > hw - 1;
        let c = edge ? RD[0] : x < mid ? RD[3] : RD[1];
        if (!edge && (y + x) % 3 === 0) c = x < mid ? RD[2] : RD[0];
        if (snowy && (y - HUT.ridge < 3 || (Math.abs(x + 0.5 - mid) > hw - 2.2 && y < HUT.top - 1))) c = x < mid ? SNOW[2] : SNOW[1];
        px(x, y, c);
      } else if (x >= HUT.x0 && x <= HUT.x1 && y < rockTop(x) + 2) {
        const edge = x === HUT.x0 || x === HUT.x1;
        px(x, y, edge ? INK : y === HUT.top ? WH[1] : (y - HUT.top) % 4 === 3 ? WH[2] : x < mid + 3 ? WH[4] : WH[3]);
      }
    }
  }
  for (let y = 93; y < 100; y += 1) for (let x = 36; x <= 38; x += 1) px(x, y, y === 93 ? (snowy ? SNOW[2] : RK[2]) : x === 38 ? RK[1] : RK[3]); // its chimney
  for (let y = 111; y <= 115; y += 1) for (let x = 27; x <= 31; x += 1) px(x, y, y === 111 || y === 115 || x === 27 || x === 31 ? IR[1] : GL[x === 29 || y === 113 ? 1 : 2]); // its window (lit when awake)

  // ----- the tower -----
  for (let y = TOWER.top; y <= TOWER.foot; y += 1) {
    const hw = towerHw(y);
    for (let x = Math.floor(CX - hw); x <= Math.ceil(CX + hw); x += 1) {
      const u = (x + 0.5 - CX) / hw;
      if (Math.abs(u) > 1) continue;
      if (y > rockTop(x) + 3 && y > 118) continue; // it stands in the rock
      let k = u < -0.78 ? 2 : u < -0.3 ? 4 : u < 0.3 ? 3 : u < 0.7 ? 2 : 1;
      if ((u > -0.34 && u < -0.26) || (u > 0.26 && u < 0.34) || (u > 0.66 && u < 0.74)) k -= bayer(x, y) < 0.5 ? 1 : 0;
      if (h2(x, y, 7) > 0.975) k -= 1; // weather
      if (y - TOWER.top < 3) k -= 1; // the gallery's shadow
      const c = band(y) ? RD[Math.max(0, Math.min(4, k - 1 + (u < -0.3 && u > -0.78 ? 1 : 0)))] : WH[Math.max(0, k)];
      px(x, y, Math.abs(u) > 1 - 1.1 / hw ? (u > 0 ? INK : band(y) ? RD[0] : WH[0]) : c);
    }
  }
  // two little windows and the door
  for (const wy of [50, 80]) for (let y = wy; y < wy + 6; y += 1) for (let x = CX - 2; x <= CX + 1; x += 1) px(x, y, y === wy || x === CX - 2 ? IR[0] : y === wy + 5 ? WH[4] : GL[x === CX + 1 ? 2 : 1]);
  for (let y = 108; y <= 121; y += 1) for (let x = CX - 4; x <= CX + 3; x += 1) {
    if (y < 110 && (x === CX - 4 || x === CX + 3)) continue; // an arched top
    const frame = y === 108 || x === CX - 4 || x === CX + 3 || (y === 109 && (x === CX - 3 || x === CX + 2));
    px(x, y, frame ? IR[0] : x < CX ? RD[2] : RD[1]);
  }
  px(CX + 1, 115, LAMP[1]);
  for (let x = CX - 5; x <= CX + 4; x += 1) px(x, 122, RK[5]); // the doorstep
  // ----- the gallery: an iron deck on brackets, with a railing -----
  for (let x = CX - 13; x <= CX + 13; x += 1) {
    px(x, 43, snowy ? SNOW[x < CX ? 2 : 1] : IR[3]); px(x, 44, IR[1]); px(x, 45, IR[0]);
    px(x, 36, IR[2]);
    if ((x - CX + 13) % 3 === 0) for (let y = 37; y < 43; y += 1) px(x, y, IR[1]);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i += 1) for (let j = 0; j <= 3 - i; j += 1) px(CX + s * (9 + j), 46 + i, IR[s < 0 ? 1 : 0]);
  // ----- the lantern: glass panes between iron bars -----
  for (let y = LANTERN.top; y < LANTERN.bottom + 1; y += 1) for (let x = CX - LANTERN.hw; x <= CX + LANTERN.hw; x += 1) {
    const bar = (x - CX + LANTERN.hw) % 4 === 0 || y === LANTERN.top || y === LANTERN.bottom;
    px(x, y, bar ? IR[x > CX + 2 ? 0 : 1] : GL[x < CX - 2 ? 2 : x < CX + 2 ? 1 : 0]);
  }
  px(CX - 4, 29, GL[3]); px(CX - 4, 30, GL[3]); px(CX - 3, 29, GL[3]); // a glint on the dark glass
  // ----- the dome and its finial -----
  for (let y = DOME.top; y <= DOME.base; y += 1) {
    const hw = y === DOME.base ? DOME.hw + 1.5 : DOME.hw * Math.sqrt(1 - ((DOME.base - y) / (DOME.base - DOME.top + 1)) ** 2);
    for (let x = Math.floor(CX - hw); x <= Math.ceil(CX + hw); x += 1) {
      const u = (x + 0.5 - CX) / hw;
      if (Math.abs(u) > 1) continue;
      let c = y === DOME.base ? RD[0] : Math.abs(u) > 1 - 1.2 / hw ? (u > 0 ? INK : RD[0]) : u < -0.45 ? RD[3] : u < 0.1 ? RD[2] : u < 0.6 ? RD[1] : RD[0];
      if (snowy && y < DOME.top + 5 && u < 0.55 && y !== DOME.base) c = u < -0.2 ? SNOW[2] : SNOW[1];
      else if (u > -0.5 && u < -0.3 && y > DOME.top + 1 && y < DOME.base - 2) c = RD[4];
      px(x, y, c);
    }
  }
  for (let y = 8; y < DOME.top; y += 1) px(CX, y, IR[1]);
  for (const [dx, dy] of [[-1, 12], [0, 11], [1, 12], [0, 13], [0, 12]]) px(CX + dx, dy, dx < 0 || dy === 11 ? IR[3] : IR[2]);
  return new ImageData(out.data, W, H);
}

const backs = {};
const back = (snowy) => (backs[snowy] ||= paintBack(snowy));

/**
 * Starts the lighthouse on its canvas. Returns step(now), to call every animation frame; it
 * redraws about ten times a second. host.dataset.wake (a performance.now() time) wakes it for a
 * while; while the map's show plays (the village has .show-on) the lamp stays lit. se: the
 * village's season ({ season }), for the snow.
 */
export function startLighthouse(canvas, host, se = null) {
  const ctx = canvas.getContext('2d');
  const snowy = se?.season === 'winter';
  const A = back(snowy);
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rows = (r, X, Y, pal, flip = false) => r.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) dot(flip ? X + row.length - 1 - x : X + x, Y + y, c); } });
  const inked = (r, X, Y, pal, flip = false, ink = INK) => {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) rows(r, X + dx, Y + dy, Object.fromEntries(Object.keys(pal).map((k) => [k, ink])), flip);
    rows(r, X, Y, pal, flip);
  };
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const show = !!host?.closest?.('.village')?.classList.contains('show-on');
    const awake = show || (since > -100 && since < 5200);
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(A, 0, 0);

    // the swell laps at the rock
    for (let x = 9; x <= 102; x += 1) {
      const k = h2(x, Math.floor((f + x) / 4), 9);
      const y = waterline(x) + 1 + (Math.sin(t * 1.6 + x / 9) > 0.3 ? 1 : 0);
      if (k > 0.42) dot(x, y, k > 0.75 ? '#ffffff' : '#cfeaf2');
      if (k > 0.9) dot(x, y + 1, '#cfeaf2');
    }

    // the lamp: its glass glows and the beam goes round
    if (awake) {
      const turn = t * 2.3;
      const side = Math.cos(turn); // -1 .. 1: where the beam points, left to right
      const flash = Math.abs(side) < 0.22; // straight at us (or away)
      const toUs = Math.sin(turn) > 0;
      for (let y = LANTERN.top + 1; y < LANTERN.bottom; y += 1) for (let x = CX - LANTERN.hw + 1; x < CX + LANTERN.hw; x += 1) {
        if ((x - CX + LANTERN.hw) % 4 === 0) continue;
        const d = Math.hypot(x - (CX + side * 4), (y - LANTERN.cy) * 0.8);
        dot(x, y, LAMP[flash && toUs ? 3 : d < 2 ? 3 : d < 4 ? 2 : d < 6 ? 1 : 0]);
      }
      // the beam: a wedge of light out to one side, long when it points sideways (the show draws
      // its own, right across the bay)
      const len = show ? 0 : Math.abs(side) * 54;
      const dir = side > 0 ? 1 : -1;
      for (let i = 7; i < len; i += 1) {
        const hw = 1.5 + i * 0.16;
        const a = (toUs ? 0.5 : 0.26) * (1 - i / 62);
        ctx.fillStyle = `rgba(255, 240, 170, ${a.toFixed(3)})`;
        ctx.fillRect(CX + dir * i - (dir < 0 ? 1 : 0), Math.round(LANTERN.cy - hw), 1, Math.round(hw * 2));
      }
      if (flash && toUs && !show) {
        // a star of light when it swings past
        ctx.fillStyle = 'rgba(255, 250, 210, 0.85)';
        ctx.fillRect(CX - 10, LANTERN.cy, 20, 1); ctx.fillRect(CX, LANTERN.cy - 9, 1, 18);
        ctx.fillStyle = 'rgba(255, 250, 210, 0.5)';
        for (let i = 1; i < 6; i += 1) { ctx.fillRect(CX - i, LANTERN.cy - i, 1, 1); ctx.fillRect(CX + i, LANTERN.cy - i, 1, 1); ctx.fillRect(CX - i, LANTERN.cy + i, 1, 1); ctx.fillRect(CX + i, LANTERN.cy + i, 1, 1); }
      }
      // the hut wakes too: a lit window, smoke from the chimney
      for (let y = 112; y <= 114; y += 1) for (let x = 28; x <= 30; x += 1) dot(x, y, x === 29 || y === 113 ? LAMP[1] : LAMP[2]);
      for (const wy of [51, 81]) for (let y = wy; y < wy + 4; y += 1) for (let x = CX - 1; x <= CX + 1; x += 1) dot(x, y, LAMP[x === CX ? 2 : 1]);
      for (let i = 0; i < 4; i += 1) {
        const k = ((f + i * 5) % 20) / 20;
        const sx = 37 + Math.sin(k * 5 + i) * 2 + k * 3; const sy = 91 - k * 16;
        ctx.fillStyle = `rgba(232, 236, 244, ${(0.8 * (1 - k)).toFixed(2)})`;
        ctx.fillRect(Math.round(sx), Math.round(sy), k > 0.4 ? 3 : 2, 2);
      }
    } else if (f % 40 < 2) { dot(CX - 3, 30, '#ffffff'); dot(CX - 2, 31, GL[3]); } // a glint on the dark glass

    // the sea lion (its head to the right, away from the tower): asleep, or up on its flippers and barking
    if (awake) {
      const bark = Math.floor(t * 3) % 3 !== 2;
      inked(bark ? SEAL_BARK : SEAL_AWAKE, SEAL.x, SEAL.y - (bark && f % 3 === 0 ? 1 : 0), SEAL_PAL, true);
    } else {
      inked(SEAL_ASLEEP, SEAL.x, SEAL.y + (Math.sin(t * 1.3) > 0.5 ? 1 : 0), SEAL_PAL, true);
      const k = (t * 0.45) % 1;
      if (k < 0.8) rows(ZED, SEAL.x + 26 + Math.round(k * 5), SEAL.y + 2 - Math.round(k * 9), { z: k < 0.6 ? '#ffffff' : '#c8d8ea' });
    }

    // the gull on the railing: it looks about, and flies a loop when the lamp comes on
    if (awake) {
      const a = t * 2.6;
      inked(GULL_FLY[f % 4 < 2 ? 0 : 1], GULL.x + 8 + Math.cos(a) * 16, GULL.y - 14 + Math.sin(a) * 7, GULL_PAL);
    } else inked(GULL_SIT[Math.floor(t / 2.4) % 2], GULL.x, GULL.y, GULL_PAL);
  };
}
