// A photo train bot for tests (js/phototrain.js), loaded in the page:
//   const { botStep } = await import('./test/helpers/photobot.js');
//   each frame: botStep(g); g.step(1 / 30);
// It picks an animal's sign anywhere in the scene, holds a finger on it so the camera pans
// there (and follows it), and presses SNAP when it poses, looks sharp and the camera is up.
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

export function botStep(g, { far = false } = {}) {
  if (g.phase !== 'play') return;
  const b = g.bot || (g.bot = { target: null });
  if (!b.target) {
    const o = g.subjects().find((s) => s.k && (far || !s.k.far) && s.k.state === 'sign' && !s.k.asleep);
    if (o && g.film > 0) b.target = o.k;
  }
  if (!b.target) return;
  const o = g.subjects().find((s) => s.k === b.target);
  if (!o || b.target.gone || b.target.state === 'leave') { b.target = null; g.up(); return; }
  const [vx, vy] = g.toView(o.box.x + o.box.w / 2, o.box.y + o.box.h / 2);
  const x = cl(vx, 4, g.VW - 34); const y = cl(vy, 4, g.VH - 4);
  if (!g.finger) g.tap(x, y); else g.drag(x, y);
  if (b.target.state === 'pose' && g.t - b.target.st > 0.3 && g.looking && g.eye.focus >= 1) { g.press(); b.target = null; g.up(); }
}
