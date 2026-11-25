// The kid's garden as it stands in the village: the Forest Village's vegetable garden (gardenB in
// meadowart.js, a raised bed with a rail fence in front), beside the kid's house on every map
// (plot in villagemaps.js). Tapping it walks the buddy up to its fence and into the garden scene
// (garden.js). On the maps where the garden scene has a dome over it (SHIELDS in gardenart.js)
// the village garden gets one too: domeB, drawn over it on the village's land.

import { PB, propB, groundShadow } from './meadowart.js';
import { inEll } from './pixelkit.js';

/** The garden's bed, in village pixels (its rail fence stands 17 more below it). */
export const PLOT = { w: 56, h: 33, fence: 17 };

/** Where the buddy stands to go in: in front of the middle of the fence. */
export function plotGate(p) {
  return { x: Math.round(p.x + p.w / 2), y: p.y + p.h + p.fence + 5 };
}

// glass and frame for each kind of dome: a bubble of air under the sea, a steel-ribbed dome on the
// moon and in the galaxy, amber heat glass on copper on the volcano
const DOMES = {
  bubble: { frame: null, glass: 'rgba(200,240,255,0.16)', rim: ['#e8fbff', '#a8dcf0', '#6ab0d0'], shine: 'rgba(255,255,255,0.8)' },
  steel: { frame: ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde'], glass: 'rgba(190,240,255,0.2)', rim: ['#e2ddde', '#c0bcc8', '#9894aa'], shine: 'rgba(255,255,255,0.75)' },
  heat: { frame: ['#5a2a24', '#8a4a2a', '#b86a3a', '#d8904a', '#f0b870'], glass: 'rgba(255,190,120,0.18)', rim: ['#ffe0b0', '#f0b870', '#c07a3a'], shine: 'rgba(255,250,230,0.8)' },
};

/** Which dome a map's village garden gets (from the garden scene's SHIELDS kind). */
export const domeKind = (mapId, shield) => (!shield ? null : shield === 'heat' ? 'heat' : mapId === 'bg-ocean' ? 'bubble' : 'steel');

/**
 * A glass dome over the village garden p ({ x, y, w, h, fence }), in style B: a base ring round
 * the garden, ribs (steel and heat), a soft rim and a shine on the glass. px: the land's painter.
 */
export function domeB(px, p, kind = 'steel') {
  const D = DOMES[kind] || DOMES.steel;
  const W = p.w + 16; const H = p.h + p.fence + 18; // the whole dome's box
  const X = p.x - 8; const Y = p.y - 16;
  const cx = W / 2; const base = H - 3; const rx = W / 2 - 0.5; const ry = H - 4;
  groundShadow(px, X + cx, Y + base + 1, rx + 1, 2.6, 0.2);
  propB(px, X, Y, W, H, (b) => {
    // the ring it stands on (a bubble just touches the sand)
    if (D.frame) {
      for (let x = 0; x < W; x += 1) {
        b.set(x, base, D.frame[4], 'frame'); b.set(x, base + 1, x % 6 === 2 ? D.frame[1] : D.frame[2], 'frame'); b.set(x, base + 2, D.frame[1], 'frame');
      }
    }
    for (let y = 0; y < base; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (!inEll(x, y, cx, base, rx, ry)) continue;
        const edge = !inEll(x, y, cx, base, rx - 1.3, ry - 1.3);
        const inner = !inEll(x, y, cx, base, rx - 2.4, ry - 2.4);
        // the ribs: up the middle and two more, and one band round the dome
        const t = (x + 0.5 - cx) / rx;
        const rib = D.frame && (Math.abs(t) < 0.03 || Math.abs(Math.abs(t) - 0.55 * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - base) / ry) ** 2))) < 0.03 || Math.abs(y + 0.5 - base * 0.42) < 0.5);
        if (edge) b.set(x, y, y < base * 0.35 ? D.rim[0] : y < base * 0.7 ? D.rim[1] : D.rim[2], 'rim');
        else if (rib) b.set(x, y, y < base * 0.4 ? D.frame[3] : D.frame[2], 'frame');
        else if (inner && x < cx) b.set(x, y, 'rgba(255,255,255,0.28)', 'air');
        else if (inEll(x, y, cx - rx * 0.5, base * 0.3, rx * 0.14, ry * 0.1) || inEll(x, y, cx - rx * 0.72, base * 0.58, 1.4, ry * 0.12)) b.set(x, y, D.shine, 'shine');
        else b.set(x, y, D.glass, 'air');
      }
    }
    // a few bubbles rising off the sea dome
    if (kind === 'bubble') [[W - 6, 6, 1.6], [W - 2, -2, 1.1], [W - 8, -6, 0.8]].forEach(([bx, by, r]) => {
      for (let y = Math.floor(by - r - 1); y <= by + r + 1; y += 1) for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x += 1) {
        if (inEll(x, y, bx, by, r + 0.6, r + 0.6)) b.set(x, y, inEll(x, y, bx, by, r - 0.4, r - 0.4) ? 'rgba(220,245,255,0.35)' : D.rim[1], 'rim');
      }
    });
  }, { pad: 10, outline: (t) => (t === 'frame' ? PB.ink : t === 'rim' ? (kind === 'bubble' ? null : D.frame?.[0] || null) : null) });
}
