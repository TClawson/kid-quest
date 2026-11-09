// The timing meter the visitor games share (hockey shots, football throws, fishing casts):
// a needle sweeps back and forth over red, yellow and green, and where it stops picks the color.
// Each game keeps its own numbers (sweep time, how wide green is) and passes them in.

export const ZONE_COLORS = { red: '#fa5252', yellow: '#fcc419', green: '#40c057' };

/** Where the needle is (0 to 1) after `held` seconds, taking `sweep` seconds to cross the meter once. */
export function needle(held, sweep) {
  const ph = (held / sweep) % 2;
  return ph < 1 ? ph : 2 - ph;
}

/** The color under the needle on a meter with green in the middle: within `green` of the middle is green, within `yellow` is yellow. */
export function zoneAt(m, green, yellow) {
  const d = Math.abs(m - 0.5);
  if (d <= green) return 'green';
  if (d <= yellow) return 'yellow';
  return 'red';
}

/** A random color for the visitor: odds.green of green, odds.yellow of yellow, the rest red. */
export function pickZone(r, odds) {
  const x = r();
  if (x < odds.green) return 'green';
  if (x < odds.green + odds.yellow) return 'yellow';
  return 'red';
}

/** Draws the meter bar (colored by zoneOf) with its outline and the needle at m. S: pixels per game pixel. */
export function drawMeter(ctx, zoneOf, m, mx, my, mw, mh, S) {
  const steps = 100;
  for (let i = 0; i < steps; i += 1) { ctx.fillStyle = ZONE_COLORS[zoneOf((i + 0.5) / steps)]; ctx.fillRect(mx + (i * mw) / steps, my, mw / steps + 0.5, mh); }
  ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.strokeRect(mx, my, mw, mh);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(mx + m * mw - S * 0.6, my - S, S * 1.2, mh + 2 * S);
}

/** Adds a floating message to game.pops, dropping the oldest past `max`. */
export function addPop(game, text, x, y, color = '#ffffff', big = false, max = 8) {
  game.pops.push({ text, x, y, at: game.t, color, big });
  if (game.pops.length > max) game.pops.shift();
}
