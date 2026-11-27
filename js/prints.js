// Prints of perfect photos, framed in the buddy's house (Taylor, 2026-11-27): any PERFECT photo
// in the critter album can be printed for 20 coins, once the kid has bought a picture frame
// (80 coins) for the house.
//
// No picture is ever stored. A perfect photo keeps its NEGATIVE in the album record
// (phototrain.js negative(): about 300 bytes), and a print is that negative plus the animal,
// map, season, weather and day. The print is redrawn by the photo train's own drawing code
// (develop() below), so it syncs with the family, stays sharp at any size and survives a
// reinstall (Taylor chose this over keeping the real snapshot pixels).
//
//   kid.prints = { [critterId]: { neg, map, season, weather, day } }   one print per animal
//   kid.wall = { color: 'wood', slots: [critterId | null, ...] }       what hangs in the frame
//   kid.owned has PHOTO_FRAME_ID once the frame is bought (merges safely like every purchase), and
//   kid.home.photos = PHOTO_FRAME_ID while it hangs (furniture.js, the 'photos' spot)
//
// A photo from before prints existed has no negative: develop() stages one (the animal posing
// at its usual hiding place on its map, in that day's season and weather).
import { PhotoTrain, LAYER, FRAME } from './phototrain.js';
import { critterById } from './critters.js';
import { critterPic } from './critterart.js';
import { canvas } from './play.js';
import { homeLayout } from './furniture.js';

export const PRINT_PRICE = 20;
export const FRAME_PRICE = 80;
export const PHOTO_FRAME_ID = 'home-photo-frame';
export const WALL_SLOTS = 4;
export const FRAME_COLORS = {
  wood: { name: 'Wood', ramp: ['#5a3418', '#8b5a2b', '#b07a45', '#d9a066'] },
  gold: { name: 'Gold', ramp: ['#8a5a00', '#e0a800', '#ffd43b', '#fff3bf'] },
  white: { name: 'White', ramp: ['#8a94a6', '#d0d6e0', '#f1f3f5', '#ffffff'] },
  black: { name: 'Black', ramp: ['#0d0b14', '#2b2838', '#45405a', '#6a6480'] },
};

/** Is the gallery frame up in the kid's house (bought and in its spot)? */
export const hasFrame = (kid) => homeLayout(kid).photos?.id === PHOTO_FRAME_ID;
export const printOf = (kid, critterId) => kid?.prints?.[critterId] || null;
export const printIds = (kid) => Object.keys(kid?.prints || {}).filter((id) => critterById(id));

/** What hangs in the frame: { color, slots: [critterId|null x WALL_SLOTS] } (prints that are gone drop out). */
export function wallOf(kid) {
  const w = kid?.wall || {};
  const have = new Set(printIds(kid));
  const slots = Array.from({ length: WALL_SLOTS }, (_, i) => (w.slots?.[i] && have.has(w.slots[i]) ? w.slots[i] : null));
  return { color: FRAME_COLORS[w.color] ? w.color : 'wood', slots };
}

/** Can this animal be printed? Only a perfect photo in the album. */
export const canPrint = (kid, critterId) => kid?.critterAlbum?.[critterId]?.q === 'perfect';

/**
 * Prints the kid's perfect photo of an animal (kid.spent goes up by PRINT_PRICE; the caller
 * checks the coins and that the frame is owned) and hangs it in the first empty place of the
 * frame (or in place `slot`). A reprint replaces the old print of that animal. Returns true if printed.
 */
export function printPhoto(kid, critterId, slot = null) {
  const rec = kid?.critterAlbum?.[critterId];
  if (!rec || rec.q !== 'perfect') return false;
  kid.prints = { ...(kid.prints || {}), [critterId]: { ...(rec.neg ? { neg: rec.neg } : {}), map: rec.map, season: rec.season, weather: rec.weather, day: rec.date } };
  kid.spent = (kid.spent || 0) + PRINT_PRICE;
  const wall = wallOf(kid);
  if (!wall.slots.includes(critterId)) {
    const at = slot ?? wall.slots.indexOf(null);
    if (at >= 0 && at < WALL_SLOTS) wall.slots[at] = critterId;
  }
  kid.wall = wall;
  return true;
}

/** Hangs a print in a place of the frame (null takes it down); it leaves any other place it was in. */
export function hangPrint(kid, slot, critterId) {
  const wall = wallOf(kid);
  if (slot < 0 || slot >= WALL_SLOTS) return false;
  if (critterId) wall.slots = wall.slots.map((x) => (x === critterId ? null : x));
  wall.slots[slot] = critterId && printOf(kid, critterId) ? critterId : null;
  kid.wall = wall;
  return true;
}

export function setFrameColor(kid, color) {
  if (!FRAME_COLORS[color]) return false;
  kid.wall = { ...wallOf(kid), color };
  return true;
}

// ---------- developing a print ----------
const STAND_IN = { buddy: { species: 'fox', outfit: {} }, name: '', gear: { camera: 3 } };
const developed = new Map();

/** A still photo train on the print's map, day and weather (nothing moves, no train). */
function stillRide(print, neg) {
  const g = new PhotoTrain({ W: neg.W, H: neg.H, flat: !(neg.v >= 3), kid: STAND_IN, visitor: STAND_IN, map: print.map, day: print.day || '2026-06-01', season: print.season, weather: print.weather, seed: 7, night: Boolean(neg.n) });
  g.still = true; g.phase = 'play'; g.tunnel = null; g.brake = null; g.pops = []; g.bridge = null;
  return g;
}

/** An animal standing still as it was in the photo: n is one animal of a negative. */
function critterFor(c, n, main = false) {
  const look = n.big ? { ...c.look, len: Math.round(c.look.len * 1.5) } : c.look;
  const frame = n.pic || 'pose';
  const posed = main ? n.pose !== 0 : Boolean(n.pose);
  return {
    c, how: n.how, layer: n.l, x: n.x, y: n.y, face: n.f ?? -1, lift: n.lift || 0, big: Boolean(n.big), far: Boolean(n.far),
    flyX: n.fx ?? null, state: posed ? 'pose' : 'still', special: posed ? n.sp || null : null, st: -99, t0: -99, id: 1, pics: () => critterPic(look, posed && n.sp !== 'wings' ? 'pose' : frame),
  };
}

/**
 * A negative for an old perfect photo that has none: the animal posing in the middle of the
 * screen, at its usual hiding place, the way the ride would show it.
 */
export function stageNegative(print, W = 213, H = 133) {
  const c = critterById(print.critter);
  const g = stillRide(print, { W, H });
  g.t = 20; g.dist = 300; g.left = 60;
  g.props = []; g.nextProp = { mid: g.dist * LAYER.mid - 40, fore: 1e9 }; g.fill(0);
  const ways = c.how.filter((h) => h !== 'track' && h !== 'far' && h !== 'fly' && h !== 'run');
  const how = ways[0] || (c.how.includes('far') ? 'far' : c.how.includes('fly') ? 'fly' : c.how[0]);
  const before = new Set(g.props);
  const k = g.spawn(c, how);
  // move it (and the cover it brought) to the middle of the screen
  const mid = k.layer === 'mid' ? g.dist * LAYER.mid + W * 0.55 : k.layer === 'far' ? g.dist * LAYER.far + W * 0.55 : W * 0.55;
  const shift = mid - k.x;
  k.x += shift;
  for (const p of g.props) if (!before.has(p)) p.x += shift;
  if (how === 'fly') k.y = Math.round(H * 0.25);
  k.state = 'pose'; k.st = -99; k.flyX = null;
  const box = g.subjects().find((o) => o.k === k)?.box || { x: W / 2 - 10, y: H / 2 - 10, w: 20, h: 20 };
  const fr = { x: box.x + box.w / 2 - FRAME.w / 2, y: Math.max(0, box.y + box.h / 2 - FRAME.h / 2 - 2), w: FRAME.w, h: FRAME.h };
  return g.negative(k, fr);
}

/**
 * Redraws a print (a canvas, the frame's size in fine pixels: 96 x 72 for the usual frame).
 * print: { critter, neg?, map, season, weather, day }. Cached by print.
 */
export function develop(print) {
  const key = JSON.stringify(print);
  if (developed.has(key)) return developed.get(key);
  const c = critterById(print.critter);
  if (!c) return null;
  const n = print.neg || stageNegative(print);
  const g = stillRide(print, n);
  const Z = g.Z;
  g.t = n.t; g.dist = n.d; g.left = n.left ?? 60;
  if (n.pour) { g.poured = true; g.weather = 'rain'; }
  const k = critterFor(c, n.k, true);
  const others = (n.o || []).map((q) => (critterById(q.id) ? critterFor(critterById(q.id), q) : null)).filter(Boolean);
  g.props = (n.p || []).map((p) => ({ layer: p.l === 'f' ? 'fore' : 'mid', kind: p.k, x: p.x, y: p.y, seed: p.s, ...(p.pe ? { perch: true } : {}), ...(p.h ? { hides: k } : {}) }));
  k.cover = g.props.find((p) => p.hides) || (n.k.cov ? { layer: 'mid', kind: n.k.cov.k, x: n.k.cov.x, y: n.k.cov.y, seed: n.k.cov.s, hides: k } : null);
  g.critters = [k, ...others];
  if (c.land) g.landBusy = true;
  const full = canvas(g.W * Z, g.H * Z);
  const ctx = full.getContext('2d');
  g.drawScene(ctx);
  // the frame on the scene, blown up by the photo's zoom (the print is the frame's size on the screen)
  const [fx, fy, fw, fh] = n.fr; const z = n.z || 1;
  const out = canvas(Math.round(fw * Z * z), Math.round(fh * Z * z));
  const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
  o.drawImage(full, Math.round(fx * Z), Math.round(fy * Z), Math.round(fw * Z), Math.round(fh * Z), 0, 0, out.width, out.height);
  developed.set(key, out);
  return out;
}

/** The kid's print of an animal, developed (or null). */
export function developFor(kid, critterId) {
  const p = printOf(kid, critterId);
  return p ? develop({ critter: critterId, ...p }) : null;
}
