// Visiting buddies: each day, 1 to 4 other family buddies stop by a kid's map.
// Who visits is random but fixed for that kid and day, so every device shows
// the same visitors and they don't change when the app reopens.

export const MAX_VISITORS = 4;

function rng(text) {
  let s = 7;
  for (const ch of String(text)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  if (s <= 0) s = 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// buddies: [{ id, name, color, buddy }] for the whole family (the host may be in it).
// Returns this day's visitors for hostId, in seat order.
export function pickVisitors(hostId, buddies, date) {
  const others = buddies.filter((b) => b.id !== hostId && b.buddy).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!others.length) return [];
  const rnd = rng(`${date}|${hostId}`);
  // shuffle (Fisher-Yates), then take 1..min(4, others) of them
  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const count = 1 + Math.floor(rnd() * Math.min(MAX_VISITORS, others.length));
  return others.slice(0, count);
}

// What a visitor says. Preset phrases only (no free text between kids).
const LINES = [
  (h) => `Hi ${h}! 👋`,
  (h) => `Go ${h}, go! 🎉`,
  () => 'Nice day for a quest! ☀️',
  () => 'Race you to the treasure! 🏃',
  () => 'Love your outfit! ✨',
  () => 'Want to play after chores? 🎮',
  () => 'Don’t forget piano! 🎹',
  () => 'High five! ✋',
  () => 'I brought snacks 🍪',
  () => 'You can do it! 💪',
];
const STREAK_LINES = [(h, n) => `${n}-day streak, ${h}! 🔥`, (h, n) => `Wow, ${n} days in a row! 🔥`];
const DONE_LINES = [() => 'Quest complete! 🏆', (h) => `Way to go, ${h}! 🌟`];

// host: { name, streak, complete }. Each visitor gets a different line.
export function visitorLines(visitors, host, date) {
  const rnd = rng(`${date}|${host.name}|lines`);
  const pool = [...LINES];
  if (host.streak >= 3) pool.push(...STREAK_LINES);
  if (host.complete) pool.unshift(...DONE_LINES);
  const out = [];
  for (let i = 0; i < visitors.length; i += 1) {
    const pick = host.complete && i === 0 ? 0 : Math.floor(rnd() * pool.length);
    const [line] = pool.splice(pick, 1);
    out.push(line(host.name, host.streak));
  }
  return out;
}

// ---------- what visitors get up to ----------
// Visitors with sports gear play on a small field or rink: two who own the
// same gear play each other, and one on their own practices. Visitors with a
// fishing rod fish in a pond. There is room for two such spots, one each side
// of the road. When the host kid holds a ball or stick, their field comes
// first: a visitor who owns that gear waits there to play (anyone else, with
// borrowed gear, when nobody does). Who does what is random but fixed for the
// day, like who visits. Each visitor: { id, gear: { kind: best version 1-3 } }.
export const GAMES = ['soccer', 'hockey', 'football'];
export const SIDES = ['left', 'right'];

/**
 * Returns { areas: [{ side, kind: 'pond' | game, members: [id], host? }], spots: { id: { side, slot } } }.
 * slot 0 is the outer spot on that side, 1 the inner one (nearer the road).
 * hostKind: the game the host kid's buddy is holding gear for, if any; that
 * area has host: true and one member. Visitors with nothing to do stand in
 * whatever spots are left.
 */
export function planVisits(hostId, visitors, date, hostKind = null) {
  const rnd = rng(`${date}|${hostId}|play`);
  const free = new Set(visitors.map((v) => v.id));
  const owners = (kind) => visitors.filter((v) => free.has(v.id) && v.gear?.[kind]).map((v) => v.id);
  const order = [...GAMES, 'rod'];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const areas = [];
  if (hostKind && visitors.length) {
    const who = owners(hostKind);
    const pool = who.length ? who : visitors.map((v) => v.id);
    const id = pool[Math.floor(rnd() * pool.length)];
    free.delete(id);
    areas.push({ kind: hostKind, members: [id], host: true });
  }
  for (const kind of order) {
    if (areas.length >= SIDES.length) break;
    if (kind === hostKind) continue;
    const who = owners(kind);
    // one is enough: a lone player practices. Now and then they do something else.
    if (!who.length || rnd() < 0.15) continue;
    const members = who.slice(0, 2);
    members.forEach((id) => free.delete(id));
    areas.push({ kind: kind === 'rod' ? 'pond' : kind, members });
  }
  const sides = rnd() < 0.5 ? SIDES : [...SIDES].reverse();
  areas.forEach((a, i) => { a.side = sides[i]; });
  const spots = {};
  for (const a of areas) a.members.forEach((id, slot) => { spots[id] = { side: a.side, slot }; });
  const open = [];
  for (const side of SIDES) for (const slot of [0, 1]) if (!Object.values(spots).some((s) => s.side === side && s.slot === slot)) open.push({ side, slot });
  // a lone fisher leaves the other pond spot free; standers fill outer spots first
  open.sort((a, b) => a.slot - b.slot);
  for (const v of visitors) if (!spots[v.id]) spots[v.id] = open.shift();
  return { areas, spots };
}
