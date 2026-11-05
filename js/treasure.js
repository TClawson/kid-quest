// The treasure chest at the end of the quest map. Pure rules, no DOM, so it can be tested.
//
// Finishing every task (parent-approved) earns that day's chest. Opening it gives one
// prize: a few coins or gems, extra visitor games for the day, a trophy for the shelf,
// or (from a silver chest up) now and then a piece of a treasure map. The prize is saved
// on the day (entry.chest), so it syncs like the day's tasks, and everything else
// (trophies owned, map pieces found) is worked out again from those saved chests.
//
// Which prize a chest holds is random but fixed for the kid and day, so every device
// that opens it gets the same thing.

/** The first day that has a chest. Days before the chest existed don't get one. */
export const TREASURE_START = '2026-11-05';
/** A chest that wasn't opened (a parent approved late) waits this many days. */
export const LATE_DAYS = 2;
export const PIECES_PER_MAP = 4;
export const CHEST_GAMES = 2;

/** Chests get better with the streak (counting the day the chest is for). */
export const CHEST_TIERS = [
  { id: 'wood', name: 'Wooden chest', from: 0, coins: 5, gems: 3, piece: 0 },
  { id: 'silver', name: 'Silver chest', from: 7, coins: 10, gems: 5, piece: 0.1 },
  { id: 'gold', name: 'Gold chest', from: 21, coins: 20, gems: 8, piece: 0.2 },
];

export function chestTier(streak) {
  let tier = CHEST_TIERS[0];
  for (const t of CHEST_TIERS) if (streak >= t.from) tier = t;
  return tier;
}

export const tierById = (id) => CHEST_TIERS.find((t) => t.id === id) || CHEST_TIERS[0];

/** The trophies a chest can hold. Most come from the moving things on the maps. */
export const TROPHIES = [
  { id: 'acorn', name: 'Golden acorn', from: 'Forest Village' },
  { id: 'crab', name: 'Golden crab', from: 'Sunset Beach' },
  { id: 'tooth', name: 'Shark tooth', from: 'Under the Sea' },
  { id: 'rocket', name: 'Toy rocket', from: 'Moon Base' },
  { id: 'alien', name: 'Little alien', from: 'Moon Base' },
  { id: 'egg', name: 'Dragon egg', from: 'Royal Castle' },
  { id: 'helmet', name: "Knight's helmet", from: 'Royal Castle' },
  { id: 'tiki', name: 'Tiki mask', from: 'Volcano Island' },
  { id: 'horn', name: 'Unicorn horn', from: 'Rainbow Land' },
  { id: 'saucer', name: 'Golden saucer', from: 'Golden Galaxy' },
  { id: 'fish', name: 'Golden fish', from: 'Fishing' },
  { id: 'ball', name: 'Golden soccer ball', from: 'Keepy-uppy' },
  { id: 'puck', name: 'Golden puck', from: 'Hockey' },
  { id: 'football', name: 'Golden football', from: 'Football' },
  { id: 'piano', name: 'Tiny piano', from: 'Piano' },
];

export const trophyById = (id) => TROPHIES.find((t) => t.id === id);

/** A seeded random number generator: the same text always gives the same numbers. */
export function rng(text) {
  let s = 11;
  for (const ch of String(text)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  if (s <= 0) s = 11;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  next();
  return next;
}

/** Every chest a kid has opened, oldest first: [{ date, ...chest }]. */
export function openedChests(log, kidId) {
  return Object.keys(log || {})
    .sort()
    .map((date) => ({ date, chest: log[date]?.[kidId]?.chest }))
    .filter((c) => c.chest)
    .map(({ date, chest }) => ({ date, ...chest }));
}

/**
 * What the kid has found so far: trophies (a Set of ids), map pieces per map
 * ({ 'bg-meadow': 2 }) and the maps that are finished (a Set of background ids).
 */
export function treasureFound(log, kidId) {
  const trophies = new Set();
  const pieces = {};
  for (const c of openedChests(log, kidId)) {
    if (c.kind === 'trophy' && !c.dupe) trophies.add(c.trophy);
    if (c.kind === 'piece') pieces[c.map] = Math.min(PIECES_PER_MAP, (pieces[c.map] || 0) + 1);
  }
  const maps = new Set(Object.keys(pieces).filter((m) => pieces[m] >= PIECES_PER_MAP));
  return { trophies, pieces, maps };
}

/**
 * The maps a piece can go to, best first: the map the kid uses now, then the
 * other maps they have unlocked, as long as that map isn't finished yet.
 */
export function mapsNeedingPieces(unlocked, current, found) {
  const open = unlocked.filter((m) => !found.maps.has(m));
  return [...open.filter((m) => m === current), ...open.filter((m) => m !== current)];
}

/**
 * The prize in a chest.
 * seed: text that fixes the roll (kid id and date), tier: from chestTier,
 * found: from treasureFound, maps: from mapsNeedingPieces, games: whether extra
 * visitor games are any use (only on the day itself, and with visitors around).
 * Returns { tier, kind: 'coins'|'gems'|'games'|'trophy'|'piece', coins?, gems?, games?, trophy?, dupe?, map? }.
 */
export function chestPrize({ seed, tier, found, maps = [], games = true }) {
  const r = rng(`${seed}|chest`);
  const base = { tier: tier.id };
  const pieceRoll = r();
  if (tier.piece > 0 && maps.length && pieceRoll < tier.piece) return { ...base, kind: 'piece', map: maps[0] };
  const table = [['coins', 35], ['trophy', 30], ['gems', 15], ['games', games ? 20 : 0]];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  let kind = 'coins';
  for (const [k, w] of table) {
    if (x < w) { kind = k; break; }
    x -= w;
  }
  const pick = r();
  if (kind === 'coins') return { ...base, kind, coins: tier.coins };
  if (kind === 'gems') return { ...base, kind, gems: tier.gems };
  if (kind === 'games') return { ...base, kind, games: CHEST_GAMES };
  const trophy = TROPHIES[Math.floor(pick * TROPHIES.length)].id;
  // one they already have turns into coins
  if (found.trophies.has(trophy)) return { ...base, kind, trophy, dupe: true, coins: tier.coins };
  return { ...base, kind, trophy };
}

/** Whether a day's chest can be opened today: earned, not opened yet, and not too old. */
export function chestReady(date, today, { complete, total, excused, opened }) {
  if (opened || excused || !complete || !total) return false;
  if (date < TREASURE_START || date > today) return false;
  for (let i = 0, d = today; i <= LATE_DAYS; i += 1) {
    if (d === date) return true;
    d = prevDay(d);
  }
  return false;
}

function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Words for a prize, for the chest card. */
export function prizeText(prize, mapName = (id) => id) {
  switch (prize.kind) {
    case 'coins': return { title: `${prize.coins} coins!`, text: 'Spend them in the shop.' };
    case 'gems': return { title: `${prize.gems} gems!`, text: 'Gems buy sports gear.' };
    case 'games': return { title: `${prize.games} extra games!`, text: 'Play more with your visitors today.' };
    case 'piece': return { title: 'A treasure map piece!', text: `It's part of the ${mapName(prize.map)} map.` };
    default: {
      const t = trophyById(prize.trophy);
      if (prize.dupe) return { title: `${t?.name || 'A trophy'}`, text: `You already have this one, so it turned into ${prize.coins} coins.` };
      return { title: `${t?.name || 'A trophy'}!`, text: 'It goes on your trophy shelf.' };
    }
  }
}
