// Builds css/moves.css: the buddies' sports moves, frame by frame in whole pixels.
// Each move lists frames for the groups buddySvg draws (.char, .gear, .prop-*, .arms-*),
// spread evenly over the move's length (MOVE_ART in js/avatar.js has the same lengths).
// Run: node scripts/build-moves-css.mjs
import fs from 'node:fs';

const T = (x = 0, y = 0, r = 0, sx = 1, sy = 1) => {
  const parts = [];
  if (x || y) parts.push(`translate(${x}px, ${y}px)`);
  if (r) parts.push(`rotate(${r}deg)`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  return parts.join(' ') || 'none';
};
const H = null; // hidden for this frame
const rep = (f, n) => Array(n).fill(f);
const MOVES = {};

MOVES.jacks = [1600, {
  'char': [T(0,0), T(0,-2), T(0,0), T(0,-2), T(0,0), T(0,-2), T(0,0), T(0,-2), T(0,0)],
  'arms-up': ['o0','o1','o0','o1','o0','o1','o0','o1','o0'],
  'arms-down': ['o1','o0','o1','o0','o1','o0','o1','o0','o1'],
}];
MOVES.cartwheel = [1600, {
  'char': [T(0,0), T(0,1,0,1.1,0.9), T(1,-3,45), T(2,-5,90), T(3,-6,135), T(4,-6,180), T(5,-6,225), T(6,-5,270), T(7,-3,315), T(8,0), T(8,0), T(5,0), T(2,0), T(0,0)],
}];
MOVES.backflip = [1600, {
  'char': [T(0,0), T(0,1,0,1.1,0.85), T(0,-4,-45), T(0,-7,-90), T(0,-8,-135), T(0,-8,-180), T(0,-8,-225), T(0,-7,-270), T(0,-4,-315), T(0,0), T(0,1,0,1.1,0.85), T(0,0), T(0,-1), T(0,0)],
}];
MOVES.keepy = [1800, {
  'gear': [T(0,0), T(1,-4), T(1,-8), T(1,-10), T(1,-8), T(1,-4), T(0,0), T(1,-4), T(1,-8), T(1,-10), T(1,-8), T(1,-4), T(0,0), T(0,0)],
  'char': [T(0,1), T(0,0), T(0,0), T(0,0), T(0,0), T(0,0), T(0,1), T(0,0), T(0,0), T(0,0), T(0,0), T(0,0), T(0,1), T(0,0)],
}];
MOVES.flick = [1800, {
  'gear': [T(0,0), T(0,0), T(1,-6), T(3,-11), T(6,-15), T(9,-17), T(9,-16), T(9,-16), T(9,-16), T(9,-16), T(8,-9), T(5,-3), T(2,0), T(0,0)],
  'char': [T(0,0), T(0,-2), T(0,-1), T(0,0), T(0,0), T(0,0), T(0,1), T(0,0), T(0,1), T(0,0), T(0,0), T(0,0), T(0,0), T(0,0)],
}];
MOVES.bicycle = [1800, {
  'gear': [T(0,0), T(3,-6), T(6,-12), T(8,-16), T(8,-17), T(8,-17), T(22,-18), T(36,-19), T(50,-20), H, H, H, T(0,0)],
  'char': [T(0,0), T(0,1,0,1.1,0.85), T(0,-3,-45), T(0,-6,-110), T(0,-7,-180), T(0,-7,-225), T(0,-6,-270), T(0,-3,-320), T(0,0), T(0,0), T(0,-1), T(0,0), T(0,0)],
}];
MOVES.dash = [1400, {
  'char': [T(0,0), T(-2,0), T(6,0), T(16,0), T(30,0), H, T(-30,0), T(-16,0), T(-6,0), T(0,0), T(0,0)],
  'prop-dust': [H, H, T(2,0), T(8,0), H, H, H, T(-10,0), T(-4,0), H, H],
}];
MOVES.hurdle = [1600, {
  'char': [T(-8,0), T(-6,0), T(-4,0), T(-1,-4), T(3,-8), T(7,-9), T(11,-7), T(14,-3), T(15,0), T(15,1,0,1.1,0.9), T(15,0), T(8,0), T(0,0)],
  'prop-hurdle': [...rep(T(0,0), 12), H],
}];
MOVES.tornado = [1800, {
  'char': [T(0,0), T(0,-1,0,0.5,1), T(0,-2,0,-1,1), T(0,-3,0,-0.5,1), T(0,-4,0,1,1), T(0,-5,0,0.5,1), T(0,-6,0,-1,1), T(0,-6,0,-0.5,1), T(0,-5,0,1,1), T(0,-4,0,0.5,1), T(0,-2,0,-1,1), T(0,-1,0,-0.5,1), T(0,0), T(0,1,0,1.1,0.9), T(0,0)],
  'prop-wind': [H, T(0,0), T(0,-2), T(0,-4), T(0,-5), T(0,-6), T(0,-6), T(0,-5), T(0,-4), T(0,-2), H, H, H, H, H],
}];
MOVES.spike = [1600, {
  'gear': [T(0,0), T(3,-10), T(7,-17), T(8,-18), T(8,-18), T(8,4), T(8,3), T(9,-3), T(9,-5), T(9,-2), T(4,0), T(0,0)],
  'char': [T(0,0), T(0,-1), T(0,-3), T(0,-4), T(0,-3), T(0,1,0,1.1,0.85), T(0,0), T(0,-2), T(0,0), T(0,-2), T(0,0), T(0,0)],
}];
MOVES.spiral = [1800, {
  'gear': [T(0,0), T(1,-3), T(6,-8,-30), T(14,-13,-60), T(26,-16,-90), T(40,-18,-120), H, H, T(-20,-16,60), T(-12,-10,40), T(-6,-5,20), T(-2,-1), T(0,0), T(0,0)],
  'char': [T(0,0), T(-1,0), T(1,-1), T(1,0), T(0,0), T(0,0), T(0,-1), T(0,0), T(0,0), T(0,0), T(0,0), T(0,1,0,1.05,0.95), T(0,0), T(0,0)],
}];
MOVES.flipcatch = [1800, {
  'gear': [T(0,0), T(2,-8), T(4,-16), T(5,-22), T(6,-25), T(6,-25), T(6,-23), T(6,-19), T(6,-14), T(5,-8), T(3,-3), T(0,0), T(0,0), T(0,0)],
  'char': [T(0,0), T(0,0), T(0,1,0,1.1,0.85), T(0,-4,-45), T(0,-7,-90), T(0,-8,-160), T(0,-8,-220), T(0,-7,-280), T(0,-4,-330), T(0,0), T(0,1,0,1.1,0.9), T(0,0), T(0,-1), T(0,0)],
}];
MOVES.dangle = [1600, {
  'gear': [T(0,0), T(0,0,12), T(0,0,-8), T(0,0,12), T(0,0,-8), T(0,0,12), T(0,0,-8), T(0,0)],
  'prop-puck': [T(0,0), T(-5,0), T(1,0), T(-5,0), T(1,0), T(-5,0), T(1,0), T(0,0)],
  'char': [T(0,0), T(1,0), T(0,0), T(1,0), T(0,0), T(1,0), T(0,0), T(0,0)],
}];
MOVES.slapshot = [1600, {
  'gear': [T(0,0), T(0,0,-30), T(0,0,-55), T(0,0,-55), T(0,0,30), T(0,0,20), T(0,0,8), T(0,0), T(0,0), T(0,0)],
  'prop-puck': [T(0,0), T(0,0), T(0,0), T(0,0), T(-10,0), T(-24,-1), T(-40,-2), H, H, T(0,0)],
  'char': [T(0,0), T(1,0), T(2,0), T(2,0), T(-1,0), T(-1,0), T(0,0), T(0,-1), T(0,0), T(0,0)],
}];
MOVES.spinorama = [1800, {
  'char': [T(0,0), T(0,0,0,0.5,1), T(0,0,0,-1,1), T(0,0,0,-0.5,1), T(0,0), T(0,0,0,0.5,1), T(0,0,0,-1,1), T(0,0,0,-0.5,1), T(0,0), T(2,0), T(-1,0), T(0,0), T(0,-1), T(0,0)],
  'gear': [...rep(T(0,0), 8), T(0,0), T(0,0,-50), T(0,0,30), T(0,0,10), T(0,0), T(0,0)],
  'prop-puck': [T(0,0), T(1,0), T(2,0), T(1,0), T(0,0), T(1,0), T(2,0), T(1,0), T(0,0), T(0,0), T(-14,-1), T(-34,-2), H, T(0,0)],
}];
MOVES.cast = [1800, {
  'gear': [T(0,0), T(0,0,-30), T(0,0,-60), T(0,0,-60), T(0,0,20), T(0,0,10), T(0,0), T(0,0), T(0,0), T(0,0), T(0,0), T(0,0)],
  'prop-bobber': [H, H, H, H, T(-1,-14), T(4,-10), T(8,-4), T(10,2), T(10,3), T(10,2), T(10,3), H],
  'char': [T(0,0), T(-1,0), T(-1,0), T(-1,0), T(1,0), T(0,0), T(0,0), T(0,0), T(0,0), T(0,-1), T(0,0), T(0,0)],
}];
MOVES.reel = [1800, {
  'gear': [T(0,0), T(0,0,15), T(0,0,8), T(0,0,18), T(0,0,8), T(0,0,18), T(0,0,-10), T(0,0,-20), T(0,0,-20), T(0,0,-20), T(0,0,-10), T(0,0)],
  'prop-fish': [H, T(4,8), T(4,7), T(4,8), T(3,6), T(2,4), T(0,-4), T(-2,-8), T(-2,-9,10), T(-2,-8,-10), T(-2,-9,10), H],
  'char': [T(0,0), T(1,0), T(0,0), T(1,0), T(0,0), T(1,0), T(-1,0), T(0,-1), T(0,0), T(0,-1), T(0,0), T(0,0)],
}];
MOVES.whopper = [2200, {
  'gear': [T(0,0), T(0,0,25), T(0,0,15), T(0,0,28), T(0,0,15), T(0,0,28), T(0,0,-20), T(0,0,-30), T(0,0,-30), T(0,0,-30), T(0,0,-30), T(0,0,-20), T(0,0), T(0,0)],
  'prop-bigfish': [H, H, H, T(10,24), T(8,18), T(4,10), T(0,2), T(-1,-2), T(0,1), T(0,0), T(0,1), T(0,0), H, H],
  'char': [T(0,0), T(1,0), T(2,0), T(1,0), T(2,0), T(2,0), T(0,0), T(0,1,0,1.05,0.95), T(0,0), T(0,-1), T(0,0), T(0,-1), T(0,0), T(0,0)],
}];


const out = [
  '/* Generated by scripts/build-moves-css.mjs: edit that, not this. */',
  '/* ---------- sports moves (frame by frame, in whole pixels) ---------- */',
  '.buddy-svg { overflow: visible; }',
  '.buddy-svg .char, .buddy-svg .gear, .buddy-svg .prop, .buddy-svg .fx, .buddy-svg .shadow { transform-box: view-box; transform-origin: 12px 15px; }',
  '.buddy-svg .gear-rod { transform-origin: 18px 15px; }',
  '.buddy-svg .gear-hockey { transform-origin: 5px 11px; }',
  '.buddy-svg .prop-fish { transform-origin: 20px 16px; }',
  '.buddy-svg.trick .arms-up, .buddy-svg .prop-twinkle { opacity: 0; }',
  '.buddy-svg.trick .prop-twinkle { animation: px-blink 0.4s steps(1, end) infinite; opacity: 1; }',
];
const frame = (f) => (f === null ? '{ opacity: 0; }' : f.startsWith('o') ? `{ opacity: ${f[1]}; }` : `{ opacity: 1; transform: ${f}; }`);
for (const [name, [ms, groups]] of Object.entries(MOVES)) {
  for (const [g, frames] of Object.entries(groups)) {
    const kf = `tk-${name}-${g}`;
    out.push(`.buddy-svg.trick-${name} .${g} { animation: ${kf} ${ms / 1000}s steps(1, end) 1 both; }`);
    const steps = frames.map((f, i) => `${Math.round((i * 10000) / frames.length) / 100}% ${frame(f)}`);
    steps.push(`100% ${frame(frames[frames.length - 1])}`);
    out.push(`@keyframes ${kf} { ${steps.join(' ')} }`);
  }
}
fs.writeFileSync(new URL('../css/moves.css', import.meta.url), `${out.join('\n')}\n`);
