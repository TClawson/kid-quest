// Furniture for the buddy's house: what the Home tab of the buddy shop sells, and which
// piece stands in each spot of the room. Pure data + logic, no DOM (houseart.js draws them).
//
// Furniture belongs to the house, so it is shared by all of a kid's buddies (like places
// and pianos): bought pieces go in kid.owned. kid.home says which owned piece stands in each
// spot: { bed: 'home-bed-quilt-blue', rug: 'home-rug-round-red', ... }. The basic bed and the
// basic table and chair are free and always there; the other spots are empty until filled.

// Each spot in the room holds one piece at a time.
export const HOME_SPOTS = [
  { id: 'bed', name: 'Bed', icon: '🛏️', basic: 'home-bed-basic' },
  { id: 'table', name: 'Table & chairs', icon: '🍽️', basic: 'home-table-basic' },
  { id: 'couch', name: 'Couch', icon: '🛋️' },
  { id: 'chair', name: 'Cozy chair', icon: '💺' },
  { id: 'corner', name: 'Corner', icon: '🌴' },
  { id: 'lamp', name: 'Lamp', icon: '💡' },
  { id: 'rug', name: 'Rug', icon: '🧶' },
  { id: 'art', name: 'Wall art', icon: '🖼️' },
];
export const spotById = (id) => HOME_SPOTS.find((s) => s.id === id);

// Fabric and paint colors for furniture versions. houseart.js builds a shaded ramp from each.
export const HOME_COLORS = {
  red: { name: 'Red', c: '#d8443a' },
  orange: { name: 'Orange', c: '#e8823a' },
  yellow: { name: 'Sunny', c: '#e8b83a' },
  green: { name: 'Green', c: '#4a9a50' },
  teal: { name: 'Teal', c: '#2e9a9a' },
  blue: { name: 'Blue', c: '#3e6ab0' },
  purple: { name: 'Purple', c: '#7a4ab0' },
  pink: { name: 'Pink', c: '#e0709a' },
  cream: { name: 'Cream', c: '#e8d6b0' },
  brown: { name: 'Cocoa', c: '#8a5a3a' },
};
// Patterns on fabric: each version is a color and a pattern.
export const PATTERNS = { plain: '', stripes: 'striped', checks: 'checked', dots: 'dotty', flowers: 'flowery', patch: 'patchwork', stars: 'starry' };

// The pieces. art: which drawing; look: the first version's color and pattern; versions:
// the other versions, each its own shop item at the same price, listed after the first.
const BASE = [
  { id: 'home-bed-basic', spot: 'bed', name: 'Simple bed', art: 'bed', look: { c: 'teal', p: 'plain' } },
  { id: 'home-bed-quilt', spot: 'bed', name: 'Quilted bed', art: 'quilt', price: 220, look: { c: 'blue', p: 'patch' }, versions: [['red', 'patch'], ['green', 'checks'], ['purple', 'stars'], ['pink', 'flowers']] },
  { id: 'home-bed-canopy', spot: 'bed', name: 'Canopy bed', art: 'canopy', price: 400, look: { c: 'purple', p: 'stars' }, versions: [['blue', 'dots'], ['pink', 'flowers'], ['teal', 'stripes'], ['yellow', 'plain']] },

  { id: 'home-table-basic', spot: 'table', name: 'Simple table and chair', art: 'table', look: { c: 'brown', p: 'plain' } },
  { id: 'home-table-round', spot: 'table', name: 'Round table set', art: 'roundtable', price: 180, look: { c: 'red', p: 'checks' }, versions: [['blue', 'checks'], ['green', 'checks'], ['yellow', 'flowers'], ['cream', 'dots']] },
  { id: 'home-table-picnic', spot: 'table', name: 'Painted table set', art: 'paintedtable', price: 260, look: { c: 'teal', p: 'plain' }, versions: [['pink', 'plain'], ['yellow', 'plain'], ['purple', 'plain']] },

  { id: 'home-couch', spot: 'couch', name: 'Couch', art: 'couch', price: 300, look: { c: 'blue', p: 'plain' }, versions: [['red', 'plain'], ['green', 'stripes'], ['purple', 'dots'], ['yellow', 'flowers'], ['brown', 'checks']] },

  { id: 'home-chair-cozy', spot: 'chair', name: 'Cozy chair', art: 'armchair', price: 150, look: { c: 'red', p: 'plain' }, versions: [['blue', 'checks'], ['green', 'plain'], ['pink', 'dots'], ['orange', 'stripes']] },
  { id: 'home-chair-bean', spot: 'chair', name: 'Beanbag', art: 'beanbag', price: 90, look: { c: 'orange', p: 'plain' }, versions: [['blue', 'plain'], ['pink', 'dots'], ['green', 'stars']] },

  { id: 'home-hammock', spot: 'corner', name: 'Hammock', art: 'hammock', price: 250, look: { c: 'teal', p: 'stripes' }, versions: [['red', 'stripes'], ['yellow', 'stripes'], ['purple', 'stripes'], ['green', 'plain']] },
  { id: 'home-plant', spot: 'corner', name: 'Potted plant', art: 'plant', price: 70, look: { c: 'orange', p: 'plain' }, versions: [['blue', 'plain'], ['cream', 'stripes']] },

  { id: 'home-lamp', spot: 'lamp', name: 'Floor lamp', art: 'lamp', price: 60, look: { c: 'cream', p: 'plain' }, versions: [['red', 'plain'], ['blue', 'dots'], ['green', 'plain'], ['pink', 'stripes']] },
  { id: 'home-lamp-mushroom', spot: 'lamp', name: 'Mushroom lamp', art: 'mushlamp', price: 120, look: { c: 'red', p: 'dots' }, versions: [['blue', 'dots'], ['purple', 'stars']] },

  { id: 'home-rug-round', spot: 'rug', name: 'Round rug', art: 'ruground', price: 80, look: { c: 'red', p: 'plain' }, versions: [['blue', 'plain'], ['green', 'dots'], ['purple', 'stars'], ['yellow', 'flowers']] },
  { id: 'home-rug-stripe', spot: 'rug', name: 'Woven rug', art: 'rugstripe', price: 100, look: { c: 'blue', p: 'stripes' }, versions: [['red', 'stripes'], ['teal', 'stripes'], ['pink', 'checks'], ['orange', 'checks']] },

  { id: 'home-art-sunset', spot: 'art', name: 'Sunset painting', art: 'pic', price: 50, look: { c: 'orange', p: 'sunset' } },
  { id: 'home-art-mountain', spot: 'art', name: 'Mountain painting', art: 'pic', price: 50, look: { c: 'blue', p: 'mountain' } },
  { id: 'home-art-flowers', spot: 'art', name: 'Flower painting', art: 'pic', price: 60, look: { c: 'yellow', p: 'flower' } },
  { id: 'home-art-fish', spot: 'art', name: 'Fish painting', art: 'pic', price: 60, look: { c: 'teal', p: 'fish' } },
  { id: 'home-art-boat', spot: 'art', name: 'Sailboat painting', art: 'pic', price: 60, look: { c: 'blue', p: 'boat' } },
  { id: 'home-art-stars', spot: 'art', name: 'Night sky painting', art: 'pic', price: 70, look: { c: 'purple', p: 'night' } },
  { id: 'home-art-map', spot: 'art', name: 'Treasure map', art: 'pic', price: 80, look: { c: 'cream', p: 'map' } },
  { id: 'home-art-rainbow', spot: 'art', name: 'Rainbow painting', art: 'pic', price: 70, look: { c: 'pink', p: 'rainbow' } },
];

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
/** "Green" + "checks" + "Round table set" -> "Green checked round table set" */
function versionName(c, p, name) {
  const pat = PATTERNS[p];
  return `${HOME_COLORS[c].name}${pat ? ` ${pat}` : ''} ${lower(name)}`;
}

/** Every piece of furniture as a shop item (slot 'home'), versions right after their first. */
export const FURNITURE = BASE.flatMap(({ versions, ...item }) => {
  const first = { ...item, slot: 'home', home: true };
  return [first, ...(versions || []).map(([c, p]) => ({ ...first, id: `${item.id}-${c}-${p}`, name: versionName(c, p, item.name), look: { c, p }, of: item.id }))];
});

const byId = new Map(FURNITURE.map((f) => [f.id, f]));
export const furnitureById = (id) => byId.get(id);

/**
 * What stands in each spot of the kid's house: { bed, table, couch, chair, corner, lamp,
 * rug, art }, each a furniture item or null. A piece the kid doesn't own (or that's gone
 * from the shop) is left out; the bed and table fall back to the basic ones.
 */
export function homeLayout(kid) {
  const owned = new Set(kid?.owned || []);
  const out = {};
  for (const s of HOME_SPOTS) {
    const f = furnitureById(kid?.home?.[s.id]);
    const ok = f && f.spot === s.id && (!f.price || owned.has(f.id));
    out[s.id] = ok ? f : s.basic ? furnitureById(s.basic) : null;
  }
  return out;
}

/** Whether this piece is the one standing in its spot now. */
export const isPlaced = (kid, item) => homeLayout(kid)[item.spot]?.id === item.id;

/**
 * Put a piece in its spot, or take it out if it's already there (the bed and table go back
 * to the basic ones). Returns the new kid.home.
 */
export function placeFurniture(kid, item) {
  const home = { ...(kid.home || {}) };
  if (!isPlaced(kid, item)) home[item.spot] = item.id;
  else if (item.id !== spotById(item.spot).basic) delete home[item.spot];
  return home;
}
