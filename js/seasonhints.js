// What villagers say about a new season (pure, no DOM). In the first days of a season, and
// while a parent is trying one out, a villager now and then adds one of these lines.

const LINES = {
  spring: [
    'Spring is here! The village smells like flowers.',
    'Look, the grass is so green! I love spring.',
    'The rain makes everything grow. Hello, spring!',
  ],
  summer: [
    'Summer is here! What a bright, warm day.',
    'It is so sunny. Time to play outside!',
    'Summer days are the longest. Hooray!',
  ],
  autumn: [
    'The leaves are turning orange!',
    'Autumn is here. I love the crunchy leaves.',
    'Look at all the red and gold. So pretty!',
  ],
  winter: [
    'Brrr, the first snow! The village looks so cozy.',
    'Winter is here. Time for warm socks!',
    'Look at the snow sparkle. I love winter.',
  ],
};

const FIRST_DAYS = 0.04; // about the first three days of a season (seasonProgress)

/** Whether a season is new enough for villagers to talk about it. */
export const isNewSeason = (progress, tried = false) => tried || progress < FIRST_DAYS;

/** A number from a string, so the same seed gives the same answer. */
function pick(seed) {
  let x = 2166136261;
  for (let i = 0; i < seed.length; i += 1) x = Math.imul(x ^ seed.charCodeAt(i), 16777619);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
  return x >>> 0;
}

/** One seasonal line about a third of the time, or ''. */
export function seasonLine(season, seed) {
  const pool = LINES[season];
  if (!pool) return '';
  const n = pick(`${season}|${seed}`);
  return n % 100 < 35 ? pool[Math.floor(n / 100) % pool.length] : '';
}
