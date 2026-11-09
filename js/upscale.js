// Doubles (or triples) a letter-grid sprite with the Scale2x / Scale3x pixel-art rules:
// each cell becomes 2x2 (3x3) cells and stair-step edges are smoothed, so a sprite keeps
// its size on the map but is drawn with pixels half (a third) as big. '.' is see-through.

const cache = new Map([[2, new WeakMap()], [3, new WeakMap()]]);

/** The grid scaled by n (2 or 3), as rows of letters. Results are cached per grid. */
export function upscale(rows, n = 2) {
  const memo = cache.get(n);
  if (!memo) return rows;
  const hit = memo.get(rows);
  if (hit) return hit;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x, y) => (y >= 0 && y < rows.length && x >= 0 && x < (rows[y]?.length || 0) ? rows[y][x] : '.');
  const out = Array.from({ length: rows.length * n }, () => new Array(w * n).fill('.'));
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const A = at(x - 1, y - 1); const B = at(x, y - 1); const C = at(x + 1, y - 1);
      const D = at(x - 1, y); const E = at(x, y); const F = at(x + 1, y);
      const G = at(x - 1, y + 1); const H = at(x, y + 1); const I = at(x + 1, y + 1);
      let cells;
      if (n === 2) {
        cells = [
          D === B && D !== H && B !== F ? D : E, B === F && B !== D && F !== H ? F : E,
          D === H && D !== B && H !== F ? D : E, H === F && H !== D && F !== B ? F : E,
        ];
      } else {
        const db = D === B && B !== F && D !== H; const bf = B === F && B !== D && F !== H;
        const dh = D === H && D !== B && H !== F; const hf = H === F && D !== H && B !== F;
        cells = [
          db ? D : E, (db && E !== C) || (bf && E !== A) ? B : E, bf ? F : E,
          (db && E !== G) || (dh && E !== A) ? D : E, E, (bf && E !== I) || (hf && E !== C) ? F : E,
          dh ? D : E, (dh && E !== I) || (hf && E !== G) ? H : E, hf ? F : E,
        ];
      }
      cells.forEach((c, k) => { out[y * n + Math.floor(k / n)][x * n + (k % n)] = c; });
    }
  }
  const res = out.map((r) => r.join(''));
  memo.set(rows, res);
  return res;
}

/**
 * Thin a scaled grid's outer outline to one small pixel: outline cells (K) on the see-through
 * side that do not touch a filled cell are peeled off, `passes` times. Lines inside the shape stay.
 */
export function thinOutline(rows, passes = 1) {
  let g = rows.map((r) => [...r]);
  for (let p = 0; p < passes; p += 1) {
    const at = (x, y) => (y >= 0 && y < g.length && x >= 0 && x < g[y].length ? g[y][x] : '.');
    const filled = (x, y) => { const c = at(x, y); return c !== '.' && c !== 'K'; };
    const near = (x, y, test) => test(x - 1, y) || test(x + 1, y) || test(x, y - 1) || test(x, y + 1);
    g = g.map((r, y) => r.map((c, x) => (c === 'K' && !near(x, y, filled) && near(x, y, (a, b) => at(a, b) === '.') ? '.' : c)));
  }
  return g.map((r) => r.join(''));
}
