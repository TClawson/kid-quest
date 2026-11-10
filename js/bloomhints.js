// What villagers say about the family's trees and flowers, so kids can work out why the
// village is growing or drooping. Pure (no DOM). Lines never name or blame a kid: the garden
// is the whole family's.
//
// h (see bloomData in villagebloom.js): {
//   yesterday, dayBefore: 'good' | 'mid' | 'bad' (the family's marks),
//   today: today's mark so far, wilt, prevWilt (0..3, now and yesterday),
//   newTrees, newBlooms, newMature: how many appeared or finished growing since yesterday,
//   grew: some tree is still growing, goodDays: good days so far,
// }

const POOL = {
  wilting: [
    'The plants are wilting because the family missed lots of chores two days in a row. One great day will perk them right up!',
    'Oh dear, the trees and flowers are drooping. They are thirsty for a good family day!',
    'Look how droopy the plants are. A day when everyone does almost all their chores will cheer them up.',
  ],
  recovering: [
    'The plants are perking up again! Thank you, family!',
    'Look, the trees and flowers are standing tall again. A good family day does that!',
  ],
  tough: [
    'Yesterday was a tough day. One more like it and the plants will start to droop.',
    'The plants are a little worried. Lots of chores were missed yesterday.',
  ],
  mid: [
    'The plants did not grow yesterday. They need everyone to do almost all their chores.',
    'Nothing grew yesterday. A day with almost all the chores done makes the village grow.',
    'The trees are waiting. They grow when the whole family does almost all of its chores.',
  ],
  mature: [
    'One of our trees is all grown up! That took 60 great family days.',
    'A tree just finished growing. It took 60 great family days to get so tall!',
  ],
  blooms: [
    'Look, new flowers are opening! The whole family did their chores yesterday.',
    'Flowers are blooming everywhere. That is what a good family day does!',
  ],
  sprouts: [
    'New little sprouts popped up! The whole family did their chores yesterday.',
    'Something is sprouting in the grass. Good family days do that!',
  ],
  grew: [
    'The whole family did their chores yesterday, and look, the trees grew!',
    'Our trees grew a little yesterday. Everyone helped!',
    'The village is growing. Every good family day makes the trees taller.',
  ],
  today: [
    'Today is going well! If the family keeps it up, the plants will grow tonight.',
    'Lots of chores are done today. The plants are cheering!',
  ],
};

/** A number from a string, to pick lines the same way for the same seed. */
function pick(seed) {
  let x = 2166136261;
  for (let i = 0; i < seed.length; i += 1) x = Math.imul(x ^ seed.charCodeAt(i), 16777619);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
  return x >>> 0;
}

/** Which lines fit the garden right now. */
export function hintPool(h) {
  if (h.wilt > 0) return POOL.wilting;
  if (h.prevWilt > 0) return POOL.recovering;
  if (h.yesterday === 'bad') return POOL.tough;
  if (h.yesterday === 'good') {
    if (h.newMature > 0) return POOL.mature;
    if (h.newBlooms > 0) return POOL.blooms;
    if (h.newTrees > 0) return POOL.sprouts;
    return h.grew ? POOL.grew : [];
  }
  if (h.goodDays > 0 || h.today === 'good') return h.today === 'good' ? POOL.today : POOL.mid;
  return [];
}

/**
 * One plant line for a villager to add, or '' (about half the time, and when there is
 * nothing to say). The same seed always gives the same answer; seed it with the day, the
 * villager and how many times they have been tapped so the lines rotate.
 */
export function bloomHint(h, seed) {
  if (!h) return '';
  const pool = hintPool(h);
  if (!pool.length) return '';
  const n = pick(seed);
  // wilting plants are always mentioned: it is what kids need to notice
  if (!h.wilt && n % 100 >= 55) return '';
  return pool[Math.floor(n / 100) % pool.length];
}
