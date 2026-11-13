// Where everything stands in each map's village (village.js walks it, villageprops.js paints
// it). Every Places background has its own village: its own ground, its own water between
// the morning and the after-school quests, its own houses and things, laid out its own way.
// Numbers are village pixels (one canvas pixel each; 3 screen pixels on a tablet).
//
// Each map lists:
//   home: the kid's house (its roof is the kid's color); houses: the rest (one is the music
//   hall, music: true, where piano quests are given); water: bands [{ pts, w, kind, colors }]
//   the buddy can't walk across; crossings: bridges { at: [x, y], dir: 'v' or 'h', kind };
//   paths, plazas; props: [kind, x, y, extra]; shop: the stall where the shopkeeper stands;
//   green: the visitors' two play spots (left, right) and idle spots; landmark: where a
//   finished treasure map's landmark stands, and where the buddy stands to look at it (one
//   drawn for the village itself also gives its size w, h, its art and its foot box);
//   chest; coach: where the coach stands (bonus exercise, beside the play spots); start: where the buddy starts; slots: where quest givers stand, in order, for the
//   morning and after school; labels: the "Morning quests" signs.

import { PROPS, waterDepth } from './villageprops.js';
import { OAK } from './oakart.js';
import { WRECK } from './wreckart.js';
import { GALLEON } from './galleonart.js';
import { CAVE } from './caveart.js';
import { GATE } from './gateart.js';
import { STONE } from './stoneart.js';
import { KAPOK } from './kapokart.js';
import { GOLDPOT } from './goldpotart.js';
import { STARWHALE } from './starwhaleart.js';
import { peakBlocks } from './fjordart.js';

const W = 448;

const TREE = { kind: 'tree' };
const RIVER_COLORS = { bank: '#3c9a3c', edge: '#8b5a2b', deep: '#1f6fc0', water: '#2b8adf', shine: '#9fd0ff' };
const MUSIC = /piano|music|practice|violin|guitar|sing|instrument/i;
const LAUNDRY = /laundry|clothes|fold|wash/i;

const p = (kind, x, y, extra = {}) => ({ kind, x, y, ...extra });

export const VILLAGE_MAPS = {
  // ---------- Forest Village: cottages round a well, a river and a wooden bridge ----------
  'bg-meadow': {
    H: 556,
    seed: 1234,
    ground: { kind: 'grass', c: ['#5cbd52', '#4aa842', '#7bd66b'], edge: ['#2f7d32', '#357f36'] },
    scatter: { kind: 'flowers', every: 260 },
    border: { kinds: [TREE] },
    pathStyle: { edge: '#a4743f', fill: '#d9a86c' },
    home: { x: 174, y: 30, w: 100, h: 78, style: 'cottage', shutter: '#4c6ef5' },
    houses: [
      { x: 34, y: 50, w: 80, h: 66, roof: '#4c6ef5', shutter: '#e03131' },
      { x: 334, y: 50, w: 80, h: 66, roof: '#2f9e44', shutter: '#f08c00' },
      { x: 30, y: 376, w: 96, h: 74, roof: '#7048e8', shutter: '#fcc419', sign: 'note', music: true },
    ],
    water: [{ pts: [[-10, 329], [458, 329]], w: 26, kind: 'river', colors: RIVER_COLORS, reeds: '#2b8a3e' }],
    crossings: [{ at: [224, 329], dir: 'v', kind: 'wood' }],
    paths: [
      [[224, 111], [224, 524]], [[224, 132], [74, 132], [74, 119]], [[224, 132], [374, 132], [374, 119]],
      [[224, 468], [78, 468], [78, 453]], [[224, 392], [290, 392]],
    ],
    plazas: [[224, 166, 30], [224, 504, 30]],
    props: [
      p('well', 211, 140), p('garden', 34, 150), p('stall', 348, 154), p('laundry', 330, 350, { w: 84 }),
      p('flowers', 160, 98), p('flowers', 276, 98), p('flowers', 150, 376), p('flowers', 100, 516),
      p('bush', 152, 70, { berries: true }), p('bush', 278, 70), p('bush', 150, 444, { berries: true }), p('bush', 184, 518), p('bush', 118, 528, { berries: true }),
      p('tree', 118, 66), p('tree', 298, 66), p('tree', 380, 190), p('tree', 140, 384), p('tree', 40, 476),
      p('mailbox', 198, 100), p('birdhouse', 152, 38), p('lantern', 232, 198), p('lantern', 180, 424), p('scarecrow', 34, 128),
      p('bench', 350, 294), p('barrow', 262, 148), p('mushrooms', 404, 222), p('snail', 110, 300),
    ],
    shop: { x: 370, y: 202 },
    green: {
      left: { x: 54, y: 234, w: 116, h: 44 }, right: { x: 272, y: 234, w: 126, h: 44 },
      idle: [{ x: 202, y: 250 }, { x: 246, y: 296 }, { x: 202, y: 296 }, { x: 246, y: 250 }],
    },
    // the Great Oak, drawn for the village (oakart.js): the biggest thing here, in the south-east corner
    landmark: { x: 282, y: 378, w: OAK.w, h: OAK.h, art: 'oak', foot: [4, 8, 148, 152], stand: { x: 270, y: 506 } },
    coach: { x: 32, y: 262 }, // the coach, who gives the bonus exercise, beside the play spots
    chest: { x: 224, y: 512 },
    start: { x: 224, y: 122 },
    slots: {
      morning: [[150, 120], [74, 140], [116, 176], [172, 206], [276, 206], [318, 168], [374, 140], [298, 120]],
      afternoon: [[78, 488, MUSIC], [296, 368, LAUNDRY], [170, 382], [262, 422], [170, 496], [252, 474], [64, 366], [130, 530]],
    },
    labels: { morning: [158, 216, '⬆ 🌅 Morning quests'], afternoon: [120, 351, '⬇ ☀️ After-school quests'] },
  },

  // ---------- Sunset Beach: huts on the sand, a lagoon down the middle, the sea at the bottom ----------
  'bg-sunset': {
    H: 560,
    seed: 2201,
    ground: { kind: 'sand', c: ['#f3c98b', '#e5b574', '#fde3b6'] },
    scatter: { kind: 'shells', every: 300 },
    border: { kinds: [{ kind: 'palm' }], sides: ['top', 'left', 'right'] },
    pathStyle: { edge: '#7a4a26', fill: '#c98a4b', kind: 'planks' },
    plazaStyle: { a: '#e0a96d', b: '#c98a4b', gap: '#7a4a26', rim: '#5c3a1e' },
    home: { x: 36, y: 34, w: 104, h: 82, style: 'hut', wall: '#ffd8a8' },
    houses: [
      { x: 316, y: 40, w: 92, h: 74, style: 'hut', roof: '#c08a3e', wall: '#ffe8cc' },
      { x: 324, y: 290, w: 96, h: 80, style: 'hut', roof: '#d4a24c', wall: '#ffd8a8', sign: 'note', music: true },
    ],
    water: [
      { pts: [[232, -20], [214, 110], [246, 230], [222, 360], [238, 470], [236, 560]], w: 30, kind: 'river', colors: { bank: '#e5b574', edge: '#d9a35f', deep: '#1098ad', water: '#3bc9db', shine: '#e3fafc' } },
      { pts: [[-20, 572], [468, 572]], w: 84, kind: 'sea', colors: { bank: '#fde3b6', edge: '#ffffff', deep: '#1098ad', water: '#22b8cf', shine: '#e3fafc' } },
    ],
    crossings: [{ at: [236, 214], dir: 'h', kind: 'wood', pal: { plank: '#c98a4b', dark: '#7a4a26', rail: '#e0a96d' } }],
    paths: [
      [[88, 118], [88, 214], [204, 214]], [[268, 214], [362, 214], [362, 116]], [[362, 214], [372, 214], [372, 372]],
      [[372, 260], [300, 260], [300, 470]], [[300, 470], [360, 470]],
    ],
    plazas: [[372, 476, 26]],
    props: [
      p('stall', 140, 40, { pal: { a: '#22b8cf', b: '#fff9db', wood: '#e0a96d', goods: [['#ff8787', '#ffc9c9'], ['#ffd43b', '#fff3bf'], ['#69db7c', '#d3f9d8']] } }),
      p('laundry', 264, 400, { w: 70 }),
      p('palm', 150, 120), p('palm', 20, 260), p('palm', 270, 300), p('palm', 400, 380),
      p('umbrella', 142, 380, { c: '#ff6b6b' }), p('umbrella', 300, 500, { c: '#4dabf7' }), p('sandcastle', 186, 480),
      p('surfboard', 20, 140, { c: '#ff922b' }), p('surfboard', 412, 150, { c: '#4dabf7' }), p('surfboard', 424, 160, { c: '#f783ac' }),
      p('rock', 180, 300, { c: '#ced4da' }), p('rock', 420, 250, { c: '#ced4da', w: 18, h: 13 }),
      // the beach's little things
      p('palm', 234, 44), p('palm', 276, 50), p('hammock', 252, 64, { w: 42, dy: 6 }),
      p('tiki', 68, 110), p('tiki', 102, 110), p('coconuts', 168, 160),
      p('driftwood', 58, 398), p('tidepool', 396, 506), p('rowboat', 336, 536),
      p('gull', 280, 518), p('gull', 404, 238),
    ],
    shop: { x: 162, y: 88 },
    green: {
      left: { x: 54, y: 300, w: 116, h: 44 }, right: { x: 256, y: 136, w: 94, h: 44 },
      idle: [{ x: 186, y: 372 }, { x: 290, y: 240 }, { x: 130, y: 376 }, { x: 398, y: 250 }],
    },
    // the ghost ship wreck, drawn for the village (wreckart.js): run aground in the south-west corner
    landmark: { x: 16, y: 418, w: WRECK.w, h: WRECK.h, art: 'wreck', foot: [8, 30, 156, 72], stand: { x: 194, y: 458 } },
    coach: { x: 372, y: 164 },
    chest: { x: 372, y: 484 },
    start: { x: 88, y: 130 },
    slots: {
      morning: [[150, 164], [50, 176], [160, 254], [60, 250], [190, 400], [110, 210], [40, 380], [196, 330]],
      afternoon: [[300, 386, MUSIC], [330, 440, LAUNDRY], [340, 252], [420, 214], [270, 460], [420, 452], [258, 500], [400, 420]],
    },
    labels: { morning: [104, 282, '⬅ 🌅 Morning quests'], afternoon: [346, 196, '➡ ☀️ After-school quests'] },
    pond: { lip: '#d9a35f', water: '#3bc9db', deep: '#1098ad', light: '#66d9e8', shine: '#e3fafc', pads: false },
    clearing: { fill: ['#e5b574', '#d9a35f', '#fde3b6'], grass: '#fde3b6' },
  },

  // ---------- Under the Sea: domes on the seabed, a dark trench and a stone arch ----------
  'bg-ocean': {
    H: 600,
    seed: 3307,
    ground: { kind: 'seabed', c: ['#2f86c9', '#2878b6', '#4fa3e3'], edge: ['#24689e', '#226296'] },
    scatter: { kind: 'sea', every: 240 },
    border: { kinds: [{ kind: 'kelp' }, { kind: 'coral', c: '#ff8787' }, { kind: 'kelp' }, { kind: 'coral', c: '#f783ac' }] },
    pathStyle: { edge: '#c9a35d', fill: '#f0d9a0' },
    plazaStyle: { a: '#fff4d1', b: '#ffe8cc', gap: '#e5b574', rim: '#c9a35d' },
    home: { x: 174, y: 34, w: 100, h: 82, style: 'dome', wall: '#fff0f6', glass: '#74c0fc' },
    houses: [
      { x: 40, y: 80, w: 84, h: 70, style: 'dome', roof: '#ffa94d', wall: '#fff0f6', glass: '#74c0fc' },
      { x: 330, y: 70, w: 84, h: 70, style: 'dome', roof: '#da77f2', wall: '#fff0f6', glass: '#74c0fc' },
      { x: 312, y: 440, w: 100, h: 82, style: 'dome', roof: '#ffd43b', wall: '#fff0f6', glass: '#74c0fc', sign: 'note', music: true },
    ],
    water: [{ pts: [[-20, 300], [120, 322], [250, 372], [360, 384], [470, 352]], w: 36, kind: 'trench', colors: { bank: '#24689e', edge: '#1c5d99', deep: '#0f2d57', water: '#163e73', shine: '#4dabf7' } }],
    crossings: [{ at: [252, 372], dir: 'v', kind: 'stone', pal: { plank: '#bcaaa4', dark: '#8d6e63', rail: '#d7ccc8' } }],
    paths: [
      [[224, 119], [224, 180], [252, 230], [252, 540]], [[224, 160], [82, 160], [82, 152]], [[224, 160], [372, 160], [372, 142]],
      [[252, 470], [362, 470], [362, 524]], [[252, 498], [206, 498]],
    ],
    plazas: [[224, 186, 26], [252, 548, 26]],
    props: [
      p('stall', 46, 196, { pal: { a: '#f783ac', b: '#fff0f6', wood: '#bcaaa4', goods: [['#ffd43b', '#fff3bf'], ['#fff0f6', '#ffffff'], ['#ff8787', '#ffc9c9']] } }),
      p('laundry', 108, 410, { w: 76 }),
      p('clam', 300, 196), p('anchor', 404, 210), p('coral', 140, 110, { c: '#ffa94d' }), p('coral', 290, 110, { c: '#f783ac' }),
      p('kelp', 260, 236), p('rock', 30, 250, { c: '#748ffc' }),
      p('kelp', 200, 404), p('clam', 50, 380),
      // the sea's little things
      p('mermaid', 144, 60), p('sunkboat', 372, 236), p('helmet', 270, 500), p('anemone', 24, 404),
      p('boot', 288, 548), p('urchins', 130, 368), p('seahorse', 218, 398), p('seavent', 412, 272),
    ],
    shop: { x: 68, y: 244 },
    green: {
      left: { x: 104, y: 240, w: 116, h: 44 }, right: { x: 278, y: 262, w: 118, h: 44 },
      idle: [{ x: 240, y: 300 }, { x: 180, y: 302 }, { x: 330, y: 230 }, { x: 410, y: 316 }],
    },
    // the Kraken's ship, drawn for the village (galleonart.js): broken in two in the south-west corner
    landmark: { x: 20, y: 456, w: GALLEON.w, h: GALLEON.h, art: 'galleon', foot: [6, 44, 172, 76], stand: { x: 208, y: 498 } },
    coach: { x: 242, y: 262 },
    chest: { x: 252, y: 556 },
    start: { x: 224, y: 130 },
    slots: {
      morning: [[150, 150], [300, 150], [60, 176], [400, 170], [180, 210], [350, 230], [110, 210], [260, 220]],
      afternoon: [[300, 520, MUSIC], [146, 450, LAUNDRY], [226, 440], [290, 420], [60, 450], [414, 552], [190, 380], [330, 560]],
    },
    labels: { morning: [110, 330, '⬆ 🌅 Morning quests'], afternoon: [370, 410, '⬇ ☀️ After-school quests'] },
    pond: { lip: '#c9a35d', water: '#163e73', deep: '#0f2d57', light: '#1c5d99', shine: '#4dabf7', pads: false },
    clearing: { fill: ['#f0d9a0', '#c9a35d', '#fff4d1'], grass: '#4fa3e3' },
  },

  // ---------- Moon Base: domes and dishes, a starry canyon and a metal gangway ----------
  'bg-space': {
    H: 560,
    seed: 4409,
    ground: { kind: 'moon', c: ['#7d82a8', '#6a6f96', '#9a9fc4'], edge: ['#5c5f8a', '#62658f'] },
    scatter: { kind: 'pebbles', every: 200, colors: ['#5c6088', '#a5aacf'] },
    // no boulders along the top: there the far rim meets the black sky, with the Earth in it (spaceart.js)
    border: { sides: ['bottom', 'left', 'right'], kinds: [{ kind: 'boulder', c: '#6a6f96' }, { kind: 'crystal', c: '#99e9f2', C: '#3bc9db' }, { kind: 'boulder', c: '#5c5f8a' }] },
    pathStyle: { edge: '#495057', fill: '#adb5bd', kind: 'planks' },
    plazaStyle: { a: '#ced4da', b: '#adb5bd', gap: '#495057', rim: '#ffd43b' },
    home: { x: 40, y: 40, w: 100, h: 80, style: 'dome', wall: '#ced4da', glass: '#ff6b6b' },
    houses: [
      { x: 300, y: 36, w: 92, h: 76, style: 'dome', roof: '#63e6be', wall: '#ced4da', glass: '#ffd43b' },
      { x: 50, y: 360, w: 100, h: 80, style: 'dome', roof: '#74c0fc', wall: '#ced4da', glass: '#ffd43b', sign: 'note', music: true },
    ],
    water: [{ pts: [[-20, 236], [110, 252], [200, 300], [300, 296], [470, 250]], w: 30, kind: 'stars', colors: { bank: '#6a6f96', edge: '#45476b', deep: '#0b1026', water: '#1b1f4b', shine: '#ffffff' } }],
    crossings: [{ at: [300, 296], dir: 'v', kind: 'metal', pal: { plank: '#868e96', dark: '#495057', rail: '#ffd43b' } }],
    paths: [
      [[90, 122], [90, 170], [300, 170], [300, 430], [380, 430]], [[300, 170], [346, 170], [346, 114]],
      [[300, 410], [100, 410], [100, 442]],
    ],
    plazas: [[380, 430, 22], [180, 170, 22]],
    props: [
      p('stall', 196, 36, { pal: { a: '#ffd43b', b: '#495057', wood: '#868e96', goods: [['#74c0fc', '#d0ebff'], ['#ff6b6b', '#ffc9c9'], ['#69db7c', '#d3f9d8']] } }),
      p('laundry', 180, 450, { w: 84 }),
      p('dish', 400, 140), p('dish', 160, 320), p('lamp', 150, 100, { c: '#74c0fc' }), p('lamp', 270, 160, { c: '#74c0fc' }),
      p('flag', 240, 90, { c: '#ff6b6b' }),
      p('crater', 110, 200), p('crater', 370, 320, { w: 44, h: 20 }), p('crater', 176, 508, { w: 30, h: 16 }), p('crater', 30, 290, { w: 28, h: 14 }),
      p('crystal', 420, 200), p('crystal', 20, 470, { c: '#ffd8a8', C: '#ff922b' }), p('rock', 250, 360, { c: '#6a6f96' }),
      // moon-base whimsy (spaceart.js)
      p('greenhouse', 150, 44), p('telescope', 262, 52), p('rover', 40, 496), p('solar', 92, 500), p('satellite', 372, 318),
      p('robot', 318, 392), p('cheese', 208, 338), p('prints', 190, 100),
    ],
    shop: { x: 218, y: 84 },
    life: { pad: { x: 394, y: 104 } }, // the rocket's landing pad
    green: {
      left: { x: 50, y: 182, w: 110, h: 40 }, right: { x: 312, y: 190, w: 86, h: 40 },
      idle: [{ x: 196, y: 210 }, { x: 250, y: 210 }, { x: 200, y: 250 }, { x: 280, y: 236 }],
    },
    // the moon worm's cave in its crater (caveart.js); its foot is the rocky hill and the crater round it
    landmark: { x: 266, y: 450, w: CAVE.w, h: CAVE.h, art: 'cave', foot: [4, 34, 156, 72], stand: { x: 254, y: 514 } },
    coach: { x: 290, y: 206 },
    chest: { x: 380, y: 436 },
    start: { x: 90, y: 134 },
    slots: {
      morning: [[150, 136], [40, 150], [240, 136], [380, 134], [330, 150], [424, 196], [250, 110], [180, 236]],
      afternoon: [[120, 466, MUSIC], [220, 494, LAUNDRY], [200, 380], [360, 376], [250, 330], [60, 330], [420, 410], [160, 530]],
    },
    labels: { morning: [210, 260, '⬆ 🌅 Morning quests'], afternoon: [400, 300, '⬇ ☀️ After school'] },
    pond: { lip: '#45476b', water: '#37b24d', deep: '#2b8a3e', light: '#69db7c', shine: '#b2f2bb', pads: false },
    clearing: { fill: ['#9a9fc4', '#6a6f96', '#b4b8d8'], grass: '#7d82a8' },
  },

  // ---------- Royal Castle: the keep inside a moat, the town outside the drawbridge ----------
  'bg-castle': {
    H: 660,
    seed: 5501,
    ground: { kind: 'grass', c: ['#5cbd52', '#4aa842', '#7bd66b'] },
    walls: 'castle',
    scatter: { kind: 'flowers', every: 300 },
    pathStyle: { edge: '#868e96', fill: '#ced4da', kind: 'cobble' },
    plazaStyle: { a: '#dee2e6', b: '#e9ecef', gap: '#adb5bd', rim: '#868e96' },
    home: { x: 164, y: 34, w: 120, h: 96, style: 'keep' },
    houses: [
      { x: 30, y: 290, w: 84, h: 70, roof: '#e64980', shutter: '#7048e8' },
      { x: 334, y: 290, w: 84, h: 70, roof: '#1c7ed6', shutter: '#fcc419' },
      { x: 30, y: 516, w: 96, h: 76, roof: '#7048e8', shutter: '#fcc419', sign: 'note', music: true },
    ],
    water: [{ pts: [[100, -10], [100, 236], [348, 236], [348, -10]], w: 24, kind: 'river', colors: { bank: '#868e96', edge: '#495057', deep: '#364fc7', water: '#3b5bdb', shine: '#bac8ff' } }],
    crossings: [{ at: [224, 236], dir: 'v', kind: 'wood', pal: { plank: '#8b5a2b', dark: '#5c3a1e', rail: '#495057' } }],
    paths: [
      [[224, 132], [224, 600]], [[224, 170], [150, 170]], [[224, 170], [300, 170]],
      [[224, 376], [72, 376], [72, 362]], [[224, 376], [376, 376], [376, 362]], [[224, 610], [78, 610], [78, 594]],
    ],
    plazas: [[224, 300, 28], [224, 600, 24]],
    props: [
      p('fountain', 204, 278), p('stall', 120, 250, { pal: { a: '#7048e8', b: '#fff3bf', wood: '#c98a4b' } }),
      p('laundry', 120, 476, { w: 80 }), p('banner', 140, 60, { c: '#7048e8' }), p('banner', 296, 60, { c: '#e64980' }),
      p('haybale', 260, 470), p('haybale', 40, 230), p('bush', 140, 200, { berries: true }), p('bush', 290, 200),
      p('tree', 396, 210), p('tree', 26, 120), p('tree', 390, 110), p('flowers', 260, 140), p('flowers', 170, 140),
      p('garden', 30, 40, { w: 56, h: 30 }), p('bush', 26, 460, { berries: true }), p('flowers', 300, 260),
      // castle whimsy (castleart.js)
      p('dummy', 118, 34), p('target', 310, 34), p('rack', 36, 170), p('cart', 372, 160), p('anvil', 262, 298), p('hound', 176, 556),
    ],
    shop: { x: 142, y: 300 },
    life: { knightPost: { x: 370, y: 256, side: 1 } }, // where the knight keeps watch
    green: {
      left: { x: 54, y: 400, w: 110, h: 44 }, right: { x: 284, y: 400, w: 110, h: 44 },
      idle: [{ x: 196, y: 410 }, { x: 252, y: 430 }, { x: 196, y: 446 }, { x: 252, y: 396 }],
    },
    // the Dragon King's gatehouse (gateart.js); its foot is the towers and the gate, not the roofs and the dragon on top
    landmark: { x: 272, y: 482, w: GATE.w, h: GATE.h, art: 'gate', foot: [4, 56, 148, 96], stand: { x: 260, y: 620 } },
    coach: { x: 32, y: 422 },
    chest: { x: 224, y: 606 },
    start: { x: 224, y: 146 },
    slots: {
      morning: [[150, 156], [300, 156], [140, 210], [310, 210], [180, 196], [270, 196], [130, 110], [320, 110]],
      afternoon: [[146, 590, MUSIC], [160, 520, LAUNDRY], [300, 330], [80, 470], [332, 470], [246, 540], [80, 400], [400, 400]],
    },
    labels: { morning: [224, 262, '⬆ 🌅 Morning quests in the castle'], afternoon: [224, 350, '⬇ ☀️ After-school quests in town'] },
    pond: {},
  },

  // ---------- Volcano Island: a smoking volcano, a lava flow and a stone bridge ----------
  'bg-volcano': {
    H: 560,
    seed: 6607,
    ground: { kind: 'ash', c: ['#5b4b45', '#4b3d38', '#75645c'], edge: ['#3d3330', '#433834'] },
    scatter: { kind: 'embers', every: 260 },
    border: { kinds: [{ kind: 'tree', pal: { G: '#2b8a3e', g: '#51cf66', d: '#1b5e20', T: '#5c3a1e' } }, { kind: 'boulder', c: '#3d3330' }] },
    pathStyle: { edge: '#2b211d', fill: '#8a7466', kind: 'cobble' },
    plazaStyle: { a: '#868e96', b: '#adb5bd', gap: '#495057', rim: '#343a40' },
    home: { x: 40, y: 36, w: 100, h: 80, style: 'hut', roof: '#2f9e44', wall: '#d9a86c', glass: '#ff922b' },
    houses: [
      { x: 170, y: 40, w: 84, h: 70, style: 'hut', roof: '#5c940d', wall: '#d9a86c', glass: '#ff922b' },
      { x: 320, y: 400, w: 96, h: 80, style: 'hut', roof: '#2f9e44', wall: '#d9a86c', glass: '#ff922b', sign: 'note', music: true },
    ],
    water: [{ pts: [[340, 108], [310, 190], [240, 250], [130, 276], [-20, 290]], w: 26, kind: 'lava', colors: { bank: '#2b211d', edge: '#3d3330', deep: '#e03131', water: '#ff6b1a', shine: '#ffe066' } }],
    crossings: [{ at: [150, 272], dir: 'v', kind: 'stone', pal: { plank: '#868e96', dark: '#495057', rail: '#adb5bd' } }],
    paths: [
      [[90, 118], [90, 160], [150, 200], [150, 420], [240, 470]], [[90, 160], [212, 160], [212, 112]],
      [[150, 360], [368, 360], [368, 482]], [[240, 470], [300, 470]],
    ],
    plazas: [[240, 478, 26]],
    props: [
      p('volcano', 300, 16), p('stall', 30, 170, { pal: { a: '#ff922b', b: '#fff3bf', wood: '#8b5a2b' } }),
      p('laundry', 180, 390, { w: 84 }),
      p('torch', 70, 120), p('torch', 120, 120), p('torch', 330, 350), p('torch', 400, 350),
      p('vent', 400, 290),
      p('palm', 280, 120), p('boulder', 250, 190, { c: '#3d3330' }), p('palm', 200, 500),
      // island whimsy
      p('spa', 262, 500), p('campfire', 334, 506), p('totem', 264, 52), p('dodo', 232, 140), p('crystals', 330, 236), p('geyser', 396, 186), p('dragonfruit', 144, 70),
    ],
    shop: { x: 52, y: 218 },
    life: { goal: { x: 360, y: 54 }, tikiHomes: [[364, 128], [410, 170], [372, 222], [350, 280], [160, 318], [290, 430], [380, 522]] }, // the crater is 26 px above goal
    green: {
      left: { x: 50, y: 312, w: 100, h: 44 }, right: { x: 220, y: 300, w: 120, h: 44 },
      idle: [{ x: 360, y: 250 }, { x: 410, y: 250 }, { x: 180, y: 300 }, { x: 370, y: 300 }],
    },
    landmark: { x: 16, y: 384, w: STONE.w, h: STONE.h, art: 'stone', foot: [18, 106, 92, 42], stand: { x: 154, y: 494 } },
    coach: { x: 362, y: 342 },
    chest: { x: 240, y: 486 },
    start: { x: 90, y: 130 },
    slots: {
      morning: [[150, 130], [40, 150], [260, 130], [120, 200], [200, 210], [90, 230], [250, 236], [20, 220]],
      afternoon: [[300, 470, MUSIC], [220, 450, LAUNDRY], [200, 340], [86, 372], [300, 400], [420, 330], [186, 516], [420, 500]],
    },
    labels: { morning: [104, 256, '⬆ 🌅 Morning quests'], afternoon: [290, 262, '⬇ ☀️ After-school quests'] },
    pond: { lip: '#2b211d', water: '#ff6b1a', deep: '#e03131', light: '#ff922b', shine: '#ffe066', pads: false },
    clearing: { fill: ['#8a7466', '#75645c', '#b8a395'], grass: '#5b4b45' },
  },

  // ---------- Rainforest: huts on stilts, a winding river and a rope bridge ----------
  'bg-rainforest': {
    H: 580,
    seed: 7703,
    ground: { kind: 'grass', c: ['#237032', '#1b5e20', '#2f9e44'], edge: ['#174d1b', '#1a531e'] },
    scatter: { kind: 'flowers', every: 300, colors: ['#ff6b6b', '#ffd43b', '#f783ac', '#ff922b'] },
    border: { kinds: [{ kind: 'jungletree' }, { kind: 'jungletree', pal: { G: '#237032', g: '#40c057', d: '#174d1b' } }] },
    pathStyle: { edge: '#5c3a1e', fill: '#8b5a2b' },
    plazaStyle: { a: '#94a38f', b: '#a9b8a4', gap: '#5c7a5c', rim: '#3d5a3d' },
    home: { x: 40, y: 34, w: 100, h: 96, style: 'stilts', wall: '#d9a066', glass: '#1c9c8c' },
    houses: [
      { x: 40, y: 400, w: 90, h: 90, style: 'stilts', roof: '#2b8a3e', wall: '#d9a066', glass: '#1c9c8c' },
      { x: 320, y: 36, w: 96, h: 100, style: 'stilts', roof: '#5c940d', wall: '#d9a066', glass: '#1c9c8c', sign: 'note', music: true },
    ],
    water: [{ pts: [[214, -20], [244, 110], [204, 250], [246, 400], [222, 600]], w: 30, kind: 'river', colors: { bank: '#1b5e20', edge: '#6e4b2a', deep: '#127a6e', water: '#1c9c8c', shine: '#96f2d7' }, reeds: '#5c940d' }],
    crossings: [{ at: [222, 300], dir: 'h', kind: 'rope', pal: { plank: '#a0612f', dark: '#6e4b2a', rail: '#5c940d' } }],
    // the river pours over a mossy cliff at the top of the village (things come over it now and then)
    falls: { x0: 218, x1: 236, lip: 4, base: 50, cliff: [184, 274] },
    // the map's moving things (maplife.js): where the sloth's vines hang
    life: { vines: [176, 336] },
    paths: [
      [[90, 132], [90, 300], [190, 300]], [[256, 300], [368, 300], [368, 138]], [[368, 300], [368, 364]], [[90, 300], [150, 330], [150, 504], [85, 504], [85, 492]],
    ],
    plazas: [[368, 364, 16], [90, 300, 20]],
    props: [
      p('stall', 140, 130, { pal: { a: '#5c940d', b: '#d8f5a2', wood: '#a0612f', goods: [['#ffd43b', '#fff3bf'], ['#ff6b6b', '#ffc9c9'], ['#ff922b', '#ffd8a8']] } }),
      p('laundry', 376, 310, { w: 48 }),
      p('jungletree', 170, 470),
      p('fern', 178, 318), p('fern', 250, 262), p('fern', 410, 200),
      p('bigflower', 292, 108, { c: '#ffd43b' }),
      // the jungle's little things
      p('dartfrog', 22, 190), p('bromeliad', 112, 344), p('orchids', 404, 280), p('mushlog', 96, 524),
      p('ants', 316, 246), p('mask', 270, 98), p('morpho', 172, 262),
    ],
    shop: { x: 162, y: 178 },
    green: {
      left: { x: 50, y: 226, w: 96, h: 44 }, right: { x: 290, y: 196, w: 106, h: 40 },
      idle: [{ x: 166, y: 236 }, { x: 280, y: 330 }, { x: 170, y: 290 }, { x: 330, y: 340 }],
    },
    // the great kapok tree with its rain drum, drawn for the village (kapokart.js): the biggest thing here, in the south-east corner
    landmark: { x: 280, y: 388, w: KAPOK.w, h: KAPOK.h, art: 'kapok', foot: [40, 118, 118, 42], stand: { x: 270, y: 552 } },
    coach: { x: 268, y: 244 },
    chest: { x: 368, y: 370 },
    start: { x: 90, y: 144 },
    slots: {
      morning: [[150, 120], [40, 160], [130, 300], [40, 330], [190, 380], [70, 530], [40, 290], [180, 430]],
      afternoon: [[310, 150, MUSIC], [400, 350, LAUNDRY], [290, 270], [420, 250], [306, 350], [270, 210], [420, 160], [266, 160]],
    },
    labels: { morning: [104, 196, '⬅ 🌅 Morning quests'], afternoon: [346, 268, '➡ ☀️ After-school quests'] },
    pond: { lip: '#6e4b2a', water: '#1c9c8c', deep: '#127a6e', light: '#38d9a9', shine: '#96f2d7', pads: true },
    clearing: { fill: ['#8b5a2b', '#6e4b2a', '#b07443'], grass: '#2f9e44' },
  },

  // ---------- Rainbow Land: mushroom houses under a rainbow river's arch ----------
  'bg-rainbow': {
    H: 560,
    seed: 8807,
    ground: { kind: 'candy', c: ['#c3fae8', '#a6f0d8', '#e6fcf5'], edge: ['#96f2d7', '#a6f0d8'] },
    scatter: { kind: 'candy', every: 1400 },
    border: { kinds: [
      { kind: 'candytree', pal: { G: '#faa2c1', g: '#fcc2d7', d: '#f06595', T: '#fff0f6' } },
      { kind: 'candytree', pal: { G: '#b197fc', g: '#d0bfff', d: '#845ef7', T: '#fff0f6' } },
      { kind: 'candytree', pal: { G: '#74c0fc', g: '#a5d8ff', d: '#4dabf7', T: '#fff0f6' } },
    ] },
    pathStyle: { layers: [[7, '#ff6b6b'], [6, '#ffa94d'], [5, '#ffd43b'], [4, '#69db7c'], [3, '#4dabf7'], [1, '#b197fc']] },
    home: { x: 174, y: 40, w: 100, h: 84, style: 'mushroom', wall: '#fff9db' },
    houses: [
      { x: 40, y: 130, w: 80, h: 72, style: 'mushroom', roof: '#845ef7', wall: '#fff9db' },
      { x: 330, y: 130, w: 80, h: 72, style: 'mushroom', roof: '#4dabf7', wall: '#fff9db' },
      { x: 40, y: 420, w: 96, h: 84, style: 'mushroom', roof: '#f783ac', wall: '#fff9db', sign: 'note', music: true },
    ],
    water: [{ pts: [[-20, 400], [60, 320], [150, 276], [224, 266], [298, 276], [388, 320], [468, 400]], w: 26, kind: 'rainbow', colors: { bank: '#ffffff', edge: '#fcc2d7', deep: '#e64980', water: '#f783ac', shine: '#fff0f6' } }],
    crossings: [{ at: [224, 266], dir: 'v', kind: 'rainbow' }],
    paths: [[[224, 126], [224, 500]], [[224, 210], [80, 210], [80, 204]], [[224, 210], [370, 210], [370, 204]], [[224, 520], [88, 520], [88, 506]]],
    plazas: [[224, 340, 24], [224, 200, 22], [224, 500, 24]],
    plazaStyle: { a: '#fff0f6', b: '#ffffff', gap: '#fcc2d7', rim: '#f783ac' },
    props: [
      p('stall', 280, 300, { pal: { a: '#ff8787', b: '#ffffff', wood: '#fcc2d7', goods: [['#ff6b6b', '#ffc9c9'], ['#845ef7', '#d0bfff'], ['#4dabf7', '#d0ebff'], ['#ffd43b', '#fff3bf']] } }),
      p('laundry', 238, 392, { w: 44 }),
      p('lollipop', 150, 60, { c: '#ff6b6b' }), p('lollipop', 290, 60, { c: '#845ef7' }), p('lollipop', 170, 410, { c: '#4dabf7' }),
      p('mushroom', 30, 250, { c: '#ff6b6b' }), p('mushroom', 400, 250, { c: '#845ef7' }), p('cloud', 120, 380),
      p('candytree', 72, 352, { pal: { G: '#ffd43b', g: '#ffec99', d: '#fab005', T: '#fff0f6' } }), p('mushroom', 160, 520, { c: '#4dabf7' }),
      p('cloud', 330, 90, { c: '#fff0f6' }), p('cloud', 60, 80, { c: '#f3f0ff' }),
      // whimsy (rainbowart.js): a gumdrop garden, a sprinkle-cupcake fountain, a star-catcher net, a lollipop lamp post,
      // a marshmallow campfire, a sleeping cloud sheep and a rainbow snail
      p('gumdrops', 88, 46), p('cupcake', 336, 44), p('starnet', 398, 44), p('lamppost', 234, 140),
      p('mallowfire', 172, 372), p('cloudsheep', 150, 300), p('rbsnail', 360, 264),
    ],
    shop: { x: 302, y: 348 },
    green: {
      left: { x: 56, y: 208, w: 104, h: 40 }, right: { x: 290, y: 210, w: 104, h: 40 },
      idle: [{ x: 180, y: 250 }, { x: 268, y: 250 }, { x: 180, y: 220 }, { x: 268, y: 290 }],
    },
    life: { chimneys: [[246, 16], [98, 106], [388, 106], [109, 396]] }, // where the hearts and stars puff from (rainbowart.js chimneyOf)
    landmark: { x: 278, y: 396, w: GOLDPOT.w, h: GOLDPOT.h, art: 'goldpot', foot: [6, 100, 140, 44], stand: { x: 262, y: 528 } },
    coach: { x: 416, y: 236 },
    chest: { x: 224, y: 506 },
    start: { x: 224, y: 136 },
    slots: {
      morning: [[150, 120], [300, 120], [80, 110], [370, 110], [150, 180], [300, 180], [40, 220], [410, 220]],
      afternoon: [[150, 470, MUSIC], [260, 436, LAUNDRY], [150, 356], [400, 370], [60, 390], [260, 380], [110, 540], [190, 470]],
    },
    labels: { morning: [224, 236, '⬆ 🌅 Morning quests'], afternoon: [98, 336, '⬇ ☀️ After-school quests'] },
    pond: { lip: '#ffffff', water: '#f783ac', deep: '#e64980', light: '#faa2c1', shine: '#fff0f6', pads: false },
    clearing: { fill: ['#fff9db', '#ffec99', '#ffffff'], grass: '#c3fae8' },
  },

  // ---------- Golden Galaxy: golden domes, glowing spires and a stream of stars ----------
  'bg-galaxy': {
    H: 560,
    seed: 9901,
    ground: { kind: 'stars', c: ['#2a1a5e', '#21134d', '#3a2878'], edge: ['#1c1045', '#201249'] },
    border: { kinds: [{ kind: 'spire', c: '#ffe066', C: '#f59f00' }, { kind: 'crystal', c: '#d0bfff', C: '#9775fa' }, { kind: 'spire', c: '#d0bfff', C: '#9775fa' }] },
    pathStyle: { edge: '#e67700', fill: '#fcc419' },
    home: { x: 320, y: 36, w: 100, h: 82, style: 'dome', wall: '#e5dbff', glass: '#ffd43b' },
    houses: [
      { x: 40, y: 50, w: 84, h: 70, style: 'dome', roof: '#b197fc', wall: '#e5dbff', glass: '#ffd43b' },
      { x: 300, y: 430, w: 96, h: 80, style: 'dome', roof: '#ffa94d', wall: '#e5dbff', glass: '#ffd43b', sign: 'note', music: true },
    ],
    water: [{ pts: [[470, 150], [330, 230], [224, 262], [110, 300], [-20, 350]], w: 30, kind: 'stars', colors: { bank: '#3a2878', edge: '#5f3dc4', deep: '#4527a0', water: '#7950f2', shine: '#ffffff' } }],
    crossings: [{ at: [224, 262], dir: 'v', kind: 'light' }],
    paths: [[[370, 120], [370, 170], [224, 200], [224, 462]], [[224, 400], [348, 400], [348, 430]], [[224, 170], [82, 170], [82, 122]], [[212, 486], [188, 534]]],
    plazas: [[224, 474, 22], [224, 190, 20]],
    plazaStyle: { a: '#ffe066', b: '#fff3bf', gap: '#f59f00', rim: '#e67700' },
    props: [
      p('stall', 160, 60, { pal: { a: '#ffd43b', b: '#5f3dc4', wood: '#fab005', goods: [['#ffd43b', '#fff3bf'], ['#b197fc', '#e5dbff'], ['#63e6be', '#c3fae8']] } }),
      p('laundry', 28, 366, { w: 80 }),
      p('orb', 260, 80, { c: '#b197fc' }), p('orb', 390, 230, { c: '#63e6be' }), p('lamp', 150, 120, { c: '#ffd43b', post: '#fab005' }),
      p('lamp', 290, 360, { c: '#ffd43b', post: '#fab005' }), p('crystal', 30, 220, { c: '#ffe066', C: '#f59f00' }), p('crystal', 420, 330, { c: '#d0bfff', C: '#9775fa' }),
      p('spire', 180, 310, { c: '#ffe066', C: '#f59f00' }), p('crystal', 420, 500, { c: '#ffe066', C: '#f59f00' }),
      // whimsy: a brass telescope, a planet swing, a comet weather vane, a jar of stardust, a moon-rock garden, a sleepy star puppy, a meteor in its crater
      p('brassscope', 244, 122), p('planetswing', 220, 50), p('cometvane', 134, 50), p('starjar', 300, 66),
      p('moongarden', 332, 360), p('starpup', 132, 318), p('meteorpit', 28, 262),
    ],
    shop: { x: 182, y: 108 },
    green: {
      left: { x: 50, y: 200, w: 106, h: 44 }, right: { x: 274, y: 300, w: 120, h: 44 },
      idle: [{ x: 180, y: 216 }, { x: 250, y: 300 }, { x: 160, y: 244 }, { x: 250, y: 344 }],
    },
    landmark: { x: 14, y: 392, w: STARWHALE.w, h: STARWHALE.h, art: 'starwhale', foot: [12, 100, 152, 36], stand: { x: 176, y: 536 } },
    coach: { x: 416, y: 322 },
    chest: { x: 224, y: 480 },
    start: { x: 370, y: 132 },
    slots: {
      morning: [[300, 140], [420, 150], [120, 150], [250, 210], [60, 160], [330, 190], [190, 240], [400, 190]],
      afternoon: [[300, 520, MUSIC], [124, 386, LAUNDRY], [170, 380], [300, 390], [100, 330], [400, 400], [268, 446], [420, 470]],
    },
    labels: { morning: [370, 196, '⬆ 🌅 Morning quests'], afternoon: [350, 268, '⬇ ☀️ After-school quests'] },
    pond: { lip: '#5f3dc4', water: '#7950f2', deep: '#5f3dc4', light: '#9775fa', shine: '#ffffff', pads: false },
    clearing: { fill: ['#5f3dc4', '#4527a0', '#7950f2'], grass: '#3a2878' },
  },
  // ---------- Alaskan Fjord: fishing cabins at both ends of a bay between two walls of mountains ----------
  // The bay fills the middle: the north village sits at its head (a creek runs through it), the
  // harbor village at its foot, where a channel runs out to the sea (the whales come in that way).
  // A boardwalk on pilings under the west wall joins the two. peaks: the mountains down each side
  // (cx, base: where a peak stands, hw: half its width at the foot, h: how tall), back to front.
  'bg-fjord': {
    H: 700,
    seed: 4907,
    ground: { kind: 'grass', c: ['#55a05a', '#3f8454', '#78b862'], edge: ['#1f5a46', '#184440'] },
    pathStyle: { edge: '#6a6676', fill: '#c6c0b8' },
    home: { x: 130, y: 30, w: 100, h: 80, style: 'cabin' },
    houses: [
      { x: 338, y: 40, w: 80, h: 66, style: 'cabin', roof: '#1c9c8c', wall: '#e8b03a' },
      { x: 30, y: 522, w: 96, h: 74, style: 'cabin', roof: '#a8323e', wall: '#3a7ab8', sign: 'note', music: true },
    ],
    water: [
      { pts: [[-40, 346], [490, 346]], w: 230, kind: 'sea', bay: true },
      { pts: [[232, 340], [236, 350]], w: 256, kind: 'sea', bay: true },
      { pts: [[330, 430], [352, 500], [364, 570], [360, 650], [366, 740]], w: 116, kind: 'sea', bay: true },
      { pts: [[322, -10], [310, 60], [322, 130], [304, 200], [300, 240]], w: 10, kind: 'river' },
    ],
    crossings: [
      { box: [103, 222, 16, 250], dir: 'v', kind: 'boardwalk' },
      { at: [321, 128], dir: 'h', kind: 'wood', w: 20 },
      { box: [278, 456, 32, 188], dir: 'v', kind: 'wharf' },
      { box: [310, 520, 46, 16], dir: 'h', kind: 'dock' },
      { box: [310, 608, 42, 16], dir: 'h', kind: 'dock' },
    ],
    peaks: [
      // the west wall: two big shoulders behind, four peaks in front
      { cx: -8, base: 306, hw: 104, h: 226, seed: 1 }, { cx: -14, base: 430, hw: 112, h: 236, seed: 2 },
      { cx: 32, base: 266, hw: 62, h: 138, seed: 3 }, { cx: 56, base: 344, hw: 44, h: 128, seed: 4 },
      { cx: 24, base: 412, hw: 76, h: 176, seed: 5 }, { cx: 50, base: 488, hw: 52, h: 150, seed: 6 },
      // the east wall, with the waterfall
      { cx: 458, base: 312, hw: 100, h: 240, seed: 7 }, { cx: 468, base: 408, hw: 104, h: 250, seed: 8 },
      { cx: 420, base: 270, hw: 62, h: 140, seed: 9 }, { cx: 398, base: 346, hw: 44, h: 120, seed: 10 },
      { cx: 424, base: 432, hw: 68, h: 186, seed: 11, falls: true }, { cx: 452, base: 506, hw: 56, h: 170, seed: 12 },
      { cx: 444, base: 596, hw: 40, h: 130, seed: 13 }, { cx: 456, base: 684, hw: 50, h: 150, seed: 14 },
      { cx: 442, base: 770, hw: 42, h: 130, seed: 15 },
    ],
    // a rocky islet in the bay (the treasure map's landmark will stand on it)
    islets: [{ x: 262, y: 404, rx: 20, ry: 9 }],
    paths: [
      [[180, 112], [180, 178]], [[180, 128], [377, 128], [377, 108]], [[180, 150], [111, 150], [111, 226]],
      [[111, 468], [111, 500], [278, 500]], [[278, 640], [78, 640], [78, 602]],
    ],
    plazas: [[180, 178, 18], [200, 640, 20]],
    props: [
      p('stall', 56, 62),
      p('laundry', 140, 594, { w: 56 }),
      // the north village's things
      p('firepit', 165, 168), p('woodpile', 262, 62), p('fishrack', 60, 120), p('kayaks', 124, 198), p('beachboat', 262, 196),
      p('driftlog', 196, 204), p('fjordlamp', 198, 104), p('fjordlamp', 300, 104), p('fjordbench', 142, 182), p('snowman', 250, 128),
      p('husky', 364, 150), p('boulder', 62, 176), p('boulder', 400, 190, { r: 6 }),
      p('spruce', 100, 26), p('spruce', 238, 22), p('spruce', 284, 30), p('spruce', 26, 80, { s: 'xl' }), p('spruce', 420, 108), p('spruce', 384, 176),
      p('spruce', 340, 188, { s: 'm' }), p('spruce', 84, 164, { s: 'm' }),
      // the harbor
      p('trawler', 314, 483, { hull: '#2a4a8a', under: true, seed: 3 }), p('trawler', 314, 569, { hull: '#a8323e', dir: -1, under: true, seed: 5 }),
      p('skiff', 318, 624, { c: '#e0aa28' }), p('trawler', 224, 430, { hull: '#2c744c', under: true, seed: 8 }),
      p('crates', 281, 470), p('barrels', 296, 560), p('ropecoil', 283, 624),
      p('crabpots', 250, 508), p('netrack', 226, 588), p('buoypost', 256, 546), p('fjordlamp', 264, 474), p('fjordlamp', 262, 612),
      p('fjordbench', 226, 664), p('driftlog', 150, 468), p('snowman', 212, 600), p('woodpile', 132, 566), p('fishrack', 30, 624),
      p('spruce', 22, 474, { s: 'xl' }), p('spruce', 126, 480, { s: 'm' }), p('spruce', 250, 644), p('spruce', 130, 648, { s: 'm' }), p('spruce', 56, 476),
    ],
    shop: { x: 78, y: 108 },
    green: {
      left: { x: 204, y: 152, w: 88, h: 38 }, right: { x: 140, y: 526, w: 108, h: 44 },
      idle: [{ x: 150, y: 208 }, { x: 236, y: 142 }, { x: 128, y: 170 }, { x: 276, y: 142 }],
    },
    // a lighthouse on the islet: it only stands there once the treasure map is whole
    landmark: { x: 238, y: 318, w: 48, h: 96, art: 'lighthouse', foot: [2, 78, 44, 18], stand: { x: 300, y: 464 } },
    coach: { x: 264, y: 114 },
    chest: { x: 200, y: 646 },
    start: { x: 180, y: 122 },
    slots: {
      morning: [[104, 122], [240, 116], [146, 166], [290, 114], [404, 124], [390, 152], [218, 204], [342, 172]],
      afternoon: [[112, 614, MUSIC], [206, 618, LAUNDRY], [180, 486], [346, 530], [130, 488], [244, 626], [298, 582], [46, 606]],
    },
    labels: { morning: [224, 214, '⬆ 🌅 Morning quests'], afternoon: [190, 484, '⬇ ☀️ After-school quests'] },
    pond: { lip: '#6a6676', water: '#2a8896', deep: '#1d6a82', light: '#49a7a8', shine: '#e6faf2', pads: false },
    clearing: { fill: ['#c6c0b8', '#a8a4a6', '#e0d8c8'], grass: '#78b862' },
  },
};

// ---------- building a layout ----------

/** The prop footprints round the edge: a forest, palms, kelp... */
function borderProps(spec, H) {
  const out = [];
  const b = spec.border;
  if (!b) return out;
  const sides = b.sides || ['top', 'bottom', 'left', 'right'];
  const kinds = b.kinds;
  const k = (i) => kinds[i % kinds.length];
  const size = (kk) => PROPS[kk.kind];
  if (sides.includes('top')) { let i = 0; for (let x = -14; x < W; i += 1) { const kk = k(i); const s = size(kk); out.push({ ...kk, x, y: Math.round(22 - Math.min(s.base, s.h * 0.75) + (i % 2 ? 5 : 0)) }); x += Math.round(s.w * 0.8); } }
  if (sides.includes('bottom')) { let i = 0; for (let x = -14; x < W; i += 1) { const kk = k(i + 1); const s = size(kk); out.push({ ...kk, x, y: Math.round(H - s.h * 0.75 + (i % 2 ? 0 : 6)) }); x += Math.round(s.w * 0.8); } }
  for (const side of ['left', 'right']) {
    if (!sides.includes(side)) continue;
    let i = 0;
    for (let y = 4; y < H - 30; i += 1) {
      const kk = k(i + (side === 'right' ? 2 : 0)); const s = size(kk);
      const x = side === 'left' ? Math.round(-s.w * 0.55 + (i % 2 ? 4 : 0)) : Math.round(W - s.w * 0.45 - (i % 2 ? 4 : 0));
      out.push({ ...kk, x, y: Math.round(y + s.h - s.base - 6) });
      y += Math.max(24, Math.round(s.h * 0.72));
    }
  }
  // no trees standing in a river where it runs off the edge, or in front of a waterfall
  const wet = (q) => { const sz = PROPS[q.kind]; const x = q.x + sz.w / 2; const y = q.y + (sz.base ?? sz.h); return spec.water.some((wa) => waterDepth(wa, x, y) > -8 || waterDepth(wa, q.x + 4, y) > -8 || waterDepth(wa, q.x + sz.w - 4, y) > -8); };
  const f = spec.falls;
  const atFalls = (q) => f && q.y < f.base && q.x + PROPS[q.kind].w > f.cliff[0] + 6 && q.x < f.cliff[1] - 6;
  return out.filter((q) => !wet(q) && !atFalls(q));
}

const inRect = (x, y, [rx, ry, rw, rh], pad = 0) => x > rx - pad && x < rx + rw + pad && y > ry - pad && y < ry + rh + pad;
function segDist(x, y, [x0, y0], [x1, y1]) {
  const dx = x1 - x0; const dy = y1 - y0; const l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l));
  return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
}

/** A bridge's box: across the water at `at`, from bank to bank. */
function bridgeBox(c, water) {
  // a boardwalk or a dock gives its own box (it doesn't run bank to bank)
  if (c.box) return { ...c, x: c.box[0], y: c.box[1], w: c.box[2], h: c.box[3] };
  const [ax, ay] = c.at;
  const wet = (x, y) => water.some((wa) => waterDepth(wa, x, y) > -5);
  const w = c.w || 32;
  if (c.dir === 'h') {
    let x0 = ax; let x1 = ax;
    while (x0 > 0 && [ay - 10, ay, ay + 10].some((y) => wet(x0, y))) x0 -= 1;
    while (x1 < W && [ay - 10, ay, ay + 10].some((y) => wet(x1, y))) x1 += 1;
    return { ...c, x: x0 - 3, y: ay - w / 2, w: x1 - x0 + 6, h: w };
  }
  let y0 = ay; let y1 = ay;
  while (y0 > 0 && [ax - 10, ax, ax + 10].some((x) => wet(x, y0))) y0 -= 1;
  while (y1 < 2000 && [ax - 10, ax, ax + 10].some((x) => wet(x, y1))) y1 += 1;
  return { ...c, x: ax - w / 2, y: y0 - 3, w, h: y1 - y0 + 6 };
}

const cache = new Map();

/** The village layout for a Places background (the meadow's Forest Village when unknown). */
export function villageLayout(theme) {
  const id = VILLAGE_MAPS[theme] ? theme : 'bg-meadow';
  if (cache.has(id)) return cache.get(id);
  const spec = VILLAGE_MAPS[id];
  const H = spec.H;
  const props = [...borderProps(spec, H), ...spec.props];
  const water = spec.water;
  const crossings = spec.crossings.map((c) => bridgeBox(c, water));
  const houses = spec.houses;
  const home = spec.home;
  // the music hall: where the piano quest is given, and the door into the music house
  const hall = houses.find((h) => h.music) || null;
  const music = hall && { ...hall, door: { x: hall.x + hall.w / 2, y: hall.y + hall.h + 8 } };
  // the landmark is drawn at twice its art size, its box from the art (see app.js), unless the
  // spec gives its own size (the meadow's Great Oak, drawn for the village in oakart.js)
  const lm = spec.landmark;
  const obstacles = [
    [0, 0, W, 22], [0, H - 18, W, 18], [0, 0, 20, H], [W - 20, 0, 20, H],
    ...[home, ...houses].map((h) => [h.x, h.y - 6, h.w, h.h + 4]),
    ...props.map((q) => { const s = PROPS[q.kind]; if (!s?.foot) return null; const f = q.kind === 'garden' ? [0, 0, q.w || 62, (q.h || 34) + 14] : s.foot; return [q.x + f[0], q.y + f[1], f[2], f[3]]; }).filter(Boolean),
    ...props.filter((q) => q.kind === 'laundry').flatMap((q) => [[q.x, q.y + 18, 4, 8], [q.x + (q.w || 84) - 4, q.y + 18, 4, 8]]),
    // a waterfall's cliff can't be climbed
    ...(spec.falls ? [[spec.falls.cliff[0], 0, spec.falls.cliff[1] - spec.falls.cliff[0], spec.falls.base - 6]] : []),
    // mountains can't be climbed either (the fjord's walls)
    ...(spec.peaks ? peakBlocks(spec.peaks) : []),
    ...(spec.blocks || []),
  ];
  const inWater = (x, y, pad = 0) => water.some((wa) => waterDepth(wa, x, y) > -3 - pad);
  const onBridge = (x, y) => crossings.some((b) => (b.dir === 'h' ? x > b.x - 6 && x < b.x + b.w + 6 && y > b.y + 2 && y < b.y + b.h - 2 : x > b.x + 2 && x < b.x + b.w - 2 && y > b.y - 6 && y < b.y + b.h + 6));
  const L = {
    id,
    name: spec.name,
    W,
    H,
    seed: spec.seed,
    ground: spec.ground,
    walls: spec.walls,
    scatter: spec.scatter,
    pathStyle: spec.pathStyle,
    home,
    houses,
    music,
    water,
    crossings,
    paths: spec.paths,
    plazas: spec.plazas,
    plazaStyle: spec.plazaStyle,
    props,
    pond: spec.pond || {},
    clearing: spec.clearing,
    shop: spec.shop,
    green: spec.green,
    falls: spec.falls,
    peaks: spec.peaks,
    islets: spec.islets,
    life: spec.life || {},
    landmark: lm,
    chest: spec.chest,
    coach: spec.coach,
    start: spec.start,
    labels: spec.labels,
    slots: {
      morning: spec.slots.morning.map(([x, y, likes]) => ({ x, y, likes })),
      afternoon: spec.slots.afternoon.map(([x, y, likes]) => ({ x, y, likes })),
    },
    obstacles,
    inWater,
    onBridge,
    // anywhere a house or a standing prop is drawn (critters shouldn't wander over roofs)
    covered: (x, y) => [home, ...houses].some((h) => inRect(x, y, [h.x - 4, h.y - 16, h.w + 8, h.h + 20])) ||
      props.some((q) => { const sz = PROPS[q.kind]; return sz && !sz.flat && inRect(x, y, [q.x, q.y, q.w || sz.w, q.h || sz.h], 2); }),
    blockedHard: (x, y, pad = 0) => obstacles.some((r) => inRect(x, y, r, pad)),
    blocked: (x, y, pad = 0) => obstacles.some((r) => inRect(x, y, r, pad)) || (inWater(x, y, pad) && !onBridge(x, y)),
    onPath: (x, y, d) => spec.paths.some((q) => q.some((pt, i) => i > 0 && segDist(x, y, q[i - 1], pt) < d)) || spec.plazas.some(([px, py, r]) => Math.hypot(x - px, y - py) < r + d),
  };
  cache.set(id, L);
  return L;
}

export const VILLAGE_THEMES = Object.keys(VILLAGE_MAPS);
