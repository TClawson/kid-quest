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
