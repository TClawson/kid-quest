// The buddies drawn at twice the detail, for close-ups: 32 x 32 pixels in a 48 x 48
// scene (rig32.js moves them with the same brain as rig.js). The small 16 x 16 ones
// in avatar.js stay for the village, where one buddy pixel is one village pixel.
// Each grid is a letter per pixel; most are left halves, mirrored to make the right.
import { OUT } from './avatar.js';
const mirror = (rows) => rows.map((r) => r + [...r].reverse().join(''));

// ---- heads (rows 0..22). ears are rows 0..7 and cut off as their own parts ----
const EARS = {
  pointed: [
    '......KK........',
    '.....KlOK.......',
    '.....KloOK......',
    '....KlooOK......',
    '....KloooOK.....',
    '...KlooooOK.....',
    '...KloooooOKKKKK',
    '..KlOoooOOOlllll',
  ],
  round: [
    '................',
    '................',
    '....KKKK........',
    '..KKooooKK......',
    '.KooooooooK.....',
    '.KoooddoooK.....',
    '.KoooddoooKKKKKK',
    '.KoooooooKllllll',
  ],
};
EARS.dome = [
  '................',
  '................',
  '................',
  '................',
  '........KKKKKKKK',
  '.....KKKllllllll',
  '...KKlllOOOOOOOO',
  '..KlOOOOOOOOOOOO',
];
const FACE = [
  '..KlOOOOOOOOOOOO', // 8
  '.KlOOOOOOOOOOOOO', // 9
  '.KlOOOOOOOOOOOOO', // 10
  '.KOOOOOOOOOOOOOO', // 11
  'KlOOOOOOOOOOOOOO', // 12
  'KOOOOOOOOOOOOOOO', // 13
  'KOOOOOOOOOOOOOOO', // 14
  'KOOOOOOOOOOOOOOW', // 15
  'KWWOOOOOOOOOOWWW', // 16
  'KWWWWOOOOOOWWWWW', // 17
  'KdWWWWWWWWWWWWWW', // 18
  '.KwWWWWWWWWWWWWW', // 19
  '.KwwWWWWWWWWWWWW', // 20
  '..KKwwwWWWWWWWWW', // 21
  '....KKKwwwwwwwww', // 22
  '.......KKKKKKKKK', // 23
];
const BODY = [
  '.....KlOOOWWWWWW', // 24
  '....KlOOOWWWWWWW', // 25
  '....KOOOOWWWWWWW', // 26
  '....KOOOOWWWWWWW', // 27
  '....KdOOOOwWWWWW', // 28
  '....KddOOOOwwwww', // 29
];
const FEET = [
  '....KOOOOOOKKKKK', // 30
  '....KdOOOOdK....', // 31
  '.....KKKKKK.....', // 32
];
const TAIL_FOX = [
  '.........KKKK.',
  '........KWWWWK',
  '.......KWWWWwK',
  '......KOOWWwK.',
  '.....KlOOOdK..',
  '....KlOOOOdK..',
  '...KlOOOOdK...',
  '..KlOOOOOdK...',
  '.KlOOOOOdK....',
  'KOOOOOOdK.....',
  'KOOOOOddK.....',
  'KdOOOddK......',
  '.KdddKK.......',
  '..KKK.........',
];
const TAIL_CAT = [
  '..........KK..',
  '.........KlOK.',
  '.........KOdK.',
  '.........KOdK.',
  '........KlOdK.',
  '.......KlOdK..',
  '......KlOOdK..',
  '.....KlOOdK...',
  '....KlOOdK....',
  '...KlOOdK.....',
  '..KOOOdK......',
  '.KOOddK.......',
  'KOddKK........',
  '.KKK..........',
];

const TAIL_PUP = [
  '....KK',
  '...KlK',
  '..KOdK',
  '.KOdK.',
  'KOdK..',
  'KKK...',
];
const TAIL_DINO = [
  '..........KK..',
  '.........KssK.',
  '.....KK..KssK.',
  '....KssK.KOOK.',
  '....KssKKlOOK.',
  '..KKKlOOOOOdK.',
  '.KlOOOOOOOdK..',
  'KOOOOOOOOdK...',
  'KOOOOOOddK....',
  'KdddddddK.....',
  '.KKKKKKK......',
];
const EAR_FLOP = [
  '...KKKK',
  '..KoooK',
  '.KooooK',
  'KoooooK',
  'KoooooK',
  'KoooooK',
  'KooooeK',
  'KoooeeK',
  'KooeeK.',
  '.KeeeK.',
  '..KKK..',
];
const CREST = [
  '..............KK',
  '.............KsS',
  '.............Kss',
  '.......KK....KsS',
  '......KsSK..KssS',
  '.....KssSK..KssS',
  '.....KssSK.KsssS',
  '.....KssSK.KsssS',
];
const SHELL_BODY = [
  '..KKKKKKKKKyyyyy', // 24
  '.KSsssssSKyyyYyy', // 25
  'KSsSSSSsSKyyyYyy', // 26
  'KSsSSSSsSKYYYYYY', // 27
  'KSssssssSKyyyYyy', // 28
  '.KSSSSSSSKyyyyyy', // 29
];
// a round, smooth turtle head with a pale jaw
const TURTLE_HEAD = [
  '................', '................', '................', '................',
  '.........KKKKKKK', // 4
  '......KKKlllllll', // 5
  '....KKllOOOOOOOO', // 6
  '...KlOOOOOOOOOOO', // 7
  '..KlOOOOOOOOOOOO', // 8
  '..KlOOOOOOOOOOOO', // 9
  '.KlOOOOOOOOOOOOO', // 10
  '.KOOOOOOOOOOOOOO', // 11
  '.KOOOOOOOOOOOOOO', // 12
  '.KOOOOOOOOOOOOOO', // 13
  '.KOOOOOOOOOOOOOO', // 14
  '.KOOOOOOOOOOOOOO', // 15
  '.KdOOOOOOOOOOOOO', // 16
  '..KdOOWWWWWWWWWW', // 17
  '..KdWWWWWWWWWWWW', // 18
  '..KwWWWWWWWWWWWW', // 19
  '..KwWWWWWWWWWWWW', // 20
  '...KwWWWWWWWWWWW', // 21
  '....KKwwwwwwwwww', // 22
  '......KKKKKKKKKK', // 23
];

export const SPECIES32 = {
  fox: { ears: 'pointed', tail: TAIL_FOX, pal: { O: '#f08a3c', l: '#ffb066', d: '#c25e1c', W: '#fff3e0', w: '#e8cfb4', o: '#7a2e1c' } },
  cat: { ears: 'pointed', tail: TAIL_CAT, stripes: true, pal: { O: '#a6b1c6', l: '#c8d0de', d: '#7d889e', W: '#f3f5fa', w: '#d5dae6', o: '#ffb3c6', s: '#8792a8' } },
  bear: { ears: 'round', pal: { O: '#b07443', l: '#d3955f', d: '#7f4f2a', W: '#ecc9a2', w: '#cfa77c', o: '#e8a77a' } },
  puppy: { ears: 'dome', flop: EAR_FLOP, tail: TAIL_PUP, pal: { O: '#e0a85e', l: '#f5c582', d: '#b47a3a', W: '#fff4df', w: '#e8d2ae', o: '#8a5530', e: '#5e3519' } },
  turtle: { ears: 'dome', shell: true, head: TURTLE_HEAD, face: 'turtle', pal: { O: '#7ccf6a', l: '#a3e38f', d: '#4f9e44', W: '#dff5b8', w: '#b8d98a', S: '#5e3b1f', s: '#8a5a33', g: '#2f5e22', r: '#d9b25a', R: '#a8803a', y: '#f2d27a', Y: '#c99a3f' } },
  dino: { ears: 'dome', crest: CREST, tail: TAIL_DINO, dino: true, pal: { O: '#5cbf5f', l: '#88d98a', d: '#3a8c41', W: '#e6f7c8', w: '#bcd99a', s: '#f79a38', S: '#c8650f', c: '#fffbe6' } },
  panda: { ears: 'round', panda: true, pal: { O: '#ffffff', l: '#ffffff', d: '#d4d6e2', W: '#ffffff', w: '#d4d6e2', o: '#2f2a36', D: '#2f2a36', E: '#4a4356', Q: '#4f475e' } },
};

export function speciesArt(id) {
  const sp = SPECIES32[id] || SPECIES32.bear;
  let head = mirror(sp.head || [...EARS[sp.ears], ...FACE]); // rows 0..23
  let body = mirror(BODY); let feet = mirror(FEET);
  const set = (g, y, x, ch) => { const r = [...g[y]]; r[x] = ch; g[y] = r.join(''); };
  if (sp.panda) {
    // dark ears, slanted eye patches, a dark shoulder band and legs
    head = head.map((r, y) => (y < 8 ? r.replace(/[o]/g, 'D').replace(/d/g, 'E') : r));
    const patch = { 11: [8, 9, 10], 12: [7, 8, 9, 10, 11], 13: [6, 7, 8, 9, 10, 11, 12], 14: [6, 7, 8, 9, 10, 11, 12], 15: [6, 7, 8, 9, 10, 11], 16: [6, 7, 8, 9, 10], 17: [7, 8] };
    for (const [y, xs] of Object.entries(patch)) for (const x of xs) { set(head, +y, x, 'Q'); set(head, +y, 31 - x, 'Q'); }
    body = body.map((r) => r.replace(/[OldwW]/g, 'D'));
    const belly = { 2: [12, 13, 14, 15], 3: [10, 11, 12, 13, 14, 15], 4: [10, 11, 12, 13, 14, 15], 5: [11, 12, 13, 14, 15] };
    for (const [y, xs] of Object.entries(belly)) for (const x of xs) { set(body, +y, x, x === 10 || (+y === 5 && x === 11) ? 'w' : 'W'); set(body, +y, 31 - x, 'W'); }
    feet = feet.map((r) => r.replace(/[Od]/g, 'D'));
  }
  if (sp.stripes) {
    for (const [y, x] of [[8, 15], [9, 15], [10, 15], [8, 12], [9, 12]]) { set(head, y, x, 's'); set(head, y, 31 - x, 's'); }
  }
  if (sp.shell) body = mirror(SHELL_BODY);
  if (sp.dino) {
    for (const [y, x] of [[9, 11], [9, 12], [10, 8], [10, 9]]) { set(head, y, x, 'd'); set(head, y, 31 - x, 'd'); }
    body = body.map((r, i) => (i === 2 || i === 4 ? r.replace(/W/g, 'w') : r));
    feet = feet.map((r, i) => (i === 1 ? r.slice(0, 6) + 'cc' + r.slice(8, 24) + 'cc' + r.slice(26) : r));
  }
  const crest = sp.crest ? mirror(sp.crest) : null;
  const flop = sp.flop || null;
  return { head, body, feet, crest, flop, face: sp.face, dino: sp.dino, tail: sp.tail, pal: { ...sp.pal, K: OUT, P: '#ff8fa3', M: '#7a2e1c', T: '#ff6b81', H: '#ffffff' }, panda: sp.panda };
}
