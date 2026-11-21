// Pictures of the treasure hill finds (finds.js), in pixels: each shape is an 8x8 mask in three
// tones (a: the find's main color, b: its dark color, c: its light color), and the picture gets
// a 1-pixel dark outline, so it is 10x10. findCells gives the colors; findPic draws a canvas.

const INK = '#1b1430';

// '.' empty, a main, b dark, c light
const SHAPES = {
  cone: ['...ab...', '..abab..', '.ababab.', '.bababab', '.ababab.', '..abab..', '...ab...', '...b....'],
  acorn: ['...b....', '.bbbbbb.', 'bbcbbbbb', '.aaaaaa.', '.acaaaa.', '.aaaaaa.', '..aaaa..', '...aa...'],
  crystal: ['...c....', '..cab...', '..cab...', '.ccaab..', '.caaab..', '.caaab..', '.caaab..', '..bbb...'],
  geode: ['..bbbb..', '.baaaab.', 'baccccab', 'bacbbcab', 'bacbbcab', 'baccccab', '.baaaab.', '..bbbb..'],
  antler: ['a.....a.', 'a..a..a.', 'aa.a.aa.', '.aaaaa..', '...aa...', '...ab...', '...ab...', '...bb...'],
  clover: ['..a..a..', '.aaa.aa.', '.aacaaa.', '..aaa...', '.aaaaa..', 'aaa.aaa.', '.a...b..', '.....b..'],
  horseshoe: ['.aa..aa.', 'acb..bca', 'ab....ba', 'ab....ba', 'ab....ba', '.ab..ba.', '.aabbaa.', '..aaaa..'],
  shard: ['........', '..ca....', '.caaa...', '.caaaab.', 'caaaaab.', '.aaaabb.', '..abb...', '........'],
  flint: ['...aa...', '..acaa..', '.acaaab.', 'acaaaabb', '.aaaab..', '..aabb..', '...b....', '........'],
  key: ['.aaa....', 'a.ca....', 'a..a....', '.aab....', '..ab....', '..abbb..', '..ab.b..', '..abb...'],
  coin: ['..bbbb..', '.baccab.', 'bacaaaab', 'bcabbaab', 'bcaabaab', 'baaaaaab', '.baaaab.', '..bbbb..'],
  ring: ['...bc...', '..bccb..', '...bb...', '.aa..aa.', 'a......a', 'a......a', '.a....a.', '..aaaa..'],
  scallop: ['...aa...', '.acaaca.', 'acacacaa', 'acacacaa', 'acacacaa', '.aaaaaa.', '...bb...', '..bbbb..'],
  snail: ['..aaaa..', '.acccaa.', 'acbbbcaa', 'acbaabca', 'acbcbbca', '.acccca.', '..aaaab.', '.....bb.'],
  pebble: ['........', '..aaaa..', '.acaaab.', 'acaaaaab', 'aaaaaabb', '.abbbbb.', '..bbbb..', '........'],
  sanddollar: ['..aaaa..', '.aaaaaa.', 'aaabbaaa', 'aabccbaa', 'aabccbaa', 'aaabbaaa', '.aaaaaa.', '..aaaa..'],
  tooth: ['aaaaaaa.', 'bccccab.', '.bccab..', '.bcaab..', '..cab...', '..cab...', '...b....', '........'],
  conch: ['....c...', '...cac..', '..caaca.', '.caaaaa.', 'caaaaaab', '.cabaab.', '..cbbb..', '...bb...'],
  urchin: ['..aaaa..', '.acacaa.', 'acacacaa', 'aacacaca', 'acacacaa', 'aacacaca', '.aaaaaa.', '..bbbb..'],
  nautilus: ['..aaaa..', '.abbbca.', 'abcaabca', 'abaccbca', 'abacbbca', 'abaaaaca', '.abbbba.', '..aaaa..'],
  pearl: ['........', '........', '..aaaa..', '.accaaa.', '.acaaab.', '.aaaabb.', '..abbb..', '........'],
  rock: ['........', '..aaa...', '.acaaaa.', 'acaabaab', 'aaaaaabb', 'abaaabbb', '.bbbbbb.', '........'],
  hair: ['c.....c.', '.c...c..', '..c.c...', '.ca.ca..', 'a..a..a.', '.a..a..a', 'a..a..a.', '........'],
  spindle: ['........', 'a.......', '.acaa...', '.acaaab.', '..aaaaab', '...aabb.', '......bb', '........'],
  pod: ['...b....', '..aaaa..', '.acaaab.', 'acaaaaab', 'aaabbaab', 'aaabbaab', '.aaaaab.', '..bbbb..'],
  cacaopod: ['..aa....', '.acaa...', '.acaab..', 'acaaab..', 'acaaabb.', '.aaaabb.', '..aabb..', '...bb...'],
  fluff: ['.a.a.a..', 'a.aaa.a.', '.aaaaa..', 'aaabaaa.', '.aaaaa..', 'a.aaa.a.', '.a.a.a..', '........'],
  nugget: ['........', '..aa.a..', '.acaaaa.', 'acaabaa.', 'aaaaaab.', '.aabbbb.', '..bb....', '........'],
  amber: ['..aaaa..', '.acaaaa.', 'acaaaaaa', 'aaabbaaa', 'aabbbbaa', 'aaabbaab', '.aaaaab.', '..bbbb..'],
  gem: ['..cccc..', '.ccaaab.', 'caaaaabb', 'caaaaaab', '.aaaaab.', '..aaab..', '...ab...', '........'],
  agate: ['..aaaa..', '.acccca.', 'acaaaaca', 'acabbaca', 'acabbaca', 'acaaaaca', '.acccca.', '..aaaa..'],
  molar: ['.aa..aa.', 'acaaacaa', 'abababab', 'acaaacaa', 'abababab', 'aaaaaaaa', '.bb..bb.', '.b....b.'],
  meteorite: ['..aaa...', '.acaaaa.', 'acbaabaa', 'aaaaaaab', 'abaaabab', 'aaabaabb', '.abbbbb.', '..bb....'],
  beads: ['........', '.aa..ca.', '.ca.aab.', '..b.bb..', '.ca....a', 'aab.aa.b', '.b..cab.', '.....b..'],
  pallasite: ['..aaaa..', '.acaaba.', 'abccaaca', 'acaabcca', 'aabccaca', 'accaabaa', '.aaacca.', '..aaaa..'],
  cube: ['........', '.ccccca.', 'cccccab.', 'aaaaabb.', 'aaaaabb.', 'aaaaabb.', 'aaaaab..', '........'],
  opal: ['..aaaa..', '.abccaa.', 'abcabcaa', 'acbcaaba', 'aacbcbca', 'abaacbaa', '.abbcaa.', '..aaaa..'],
  sundisc: ['a..a..a.', '.a.a.a..', '..aaa...', 'aaacaaa.', '..aaa...', '.a.b.a..', 'a..b..a.', '........'],
};

/** The 10x10 picture of a find (an object from finds.js with shape and colors), as rows of colors or null. */
export function findCells(find) {
  const mask = SHAPES[find?.shape] || SHAPES.pebble;
  const [a, b, c] = find?.colors || ['#adb5bd', '#495057', '#f8f9fa'];
  const tone = { a, b, c };
  const out = Array.from({ length: 10 }, () => Array(10).fill(null));
  mask.forEach((row, y) => [...row].forEach((ch, x) => { if (tone[ch]) out[y + 1][x + 1] = tone[ch]; }));
  // the outline: every empty pixel next to a filled one
  const filled = (x, y) => y >= 0 && y < 10 && x >= 0 && x < 10 && out[y][x] && out[y][x] !== INK;
  const ink = [];
  for (let y = 0; y < 10; y += 1) for (let x = 0; x < 10; x += 1) {
    if (!out[y][x] && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) ink.push([x, y]);
  }
  for (const [x, y] of ink) out[y][x] = INK;
  return out;
}

/** A find's picture as a canvas, z screen pixels per picture pixel (in a browser). */
export function findPic(find, z = 1) {
  const cells = findCells(find);
  const c = document.createElement('canvas');
  c.width = 10 * z; c.height = 10 * z;
  const x = c.getContext('2d');
  cells.forEach((row, j) => row.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect(i * z, j * z, z, z); } }));
  return c;
}

/** The shapes there are pictures for (for tests). */
export const FIND_SHAPES = Object.keys(SHAPES);
