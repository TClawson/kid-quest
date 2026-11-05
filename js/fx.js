// Sounds (synthesized with Web Audio, no files needed) and confetti.

let ctx = null;
let enabled = true;

export function setSound(on) {
  enabled = on;
}

function audio() {
  if (!enabled) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac, freq, start, dur, type = 'triangle', vol = 0.25) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function play(notes, step, dur, type, vol) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  notes.forEach((f, i) => {
    if (Array.isArray(f)) f.forEach((g) => tone(ac, g, t0 + i * step, dur, type, vol / f.length));
    else if (f) tone(ac, f, t0 + i * step, dur, type, vol);
  });
}

const N = { C4: 261.6, E4: 329.6, G4: 392, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, B5: 987.8, C6: 1046.5, E6: 1318.5, G6: 1568 };

export const sounds = {
  tap: () => play([N.E5], 0, 0.08, 'sine', 0.12),
  task: () => play([N.C6, N.E6, N.G6], 0.07, 0.25, 'triangle', 0.22),
  pending: () => play([N.G5, N.E5], 0.1, 0.2, 'sine', 0.15),
  day: () => play([N.C5, N.E5, N.G5, N.C6, null, [N.C5, N.E5, N.G5, N.C6]], 0.12, 0.45, 'square', 0.12),
  week: () => play(
    [N.G4, N.C5, N.E5, N.G5, null, N.E5, [N.G5, N.C6], null, [N.C5, N.E5, N.G5, N.C6], null, null, [N.C4, N.G4, N.C5, N.E5, N.G5, N.C6]],
    0.13, 0.6, 'sawtooth', 0.09,
  ),
  reminder: () => play([N.G5, N.C6, N.G5, N.C6], 0.18, 0.3, 'sine', 0.25),
  error: () => play([N.E4, N.C4], 0.12, 0.2, 'square', 0.08),
  // playing with a visitor: a kick climbs a little with the count, a tag, the end of a game
  kick: (n = 0) => play([[N.C5, N.E5, N.G5, N.C6][n % 4]], 0, 0.07, 'square', 0.06),
  tag: () => play([N.G5, N.C6], 0.06, 0.12, 'square', 0.08),
  shot: () => play([N.C6, N.G5], 0.03, 0.08, 'square', 0.07),
  steal: () => play([N.E5, N.A5], 0.05, 0.1, 'square', 0.07),
  board: () => play([N.C4], 0, 0.05, 'triangle', 0.08),
  catch: () => play([N.E5, N.G5, N.C6], 0.06, 0.12, 'square', 0.08),
  drop: () => play([N.E4, N.C4], 0.08, 0.12, 'triangle', 0.1),
  goal: () => play([N.C5, N.E5, N.G5, N.C6, N.G5, N.C6], 0.08, 0.16, 'square', 0.1),
  over: (best) => (best ? play([N.C5, N.E5, N.G5, N.C6], 0.09, 0.2, 'square', 0.1) : play([N.G5, N.E5, N.C5], 0.1, 0.18, 'triangle', 0.12)),
  // a quick rising whoosh for a buddy's sports move; fishing gets a plip
  move: (kind) => (kind === 'rod'
    ? play([N.G5, null, N.C6, N.E6], 0.09, 0.15, 'sine', 0.16)
    : play([N.C5, N.E5, N.G5, N.C6, N.E6], 0.05, 0.14, 'square', 0.08)),
};

export function confetti(amount = 120, duration = 2600) {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  document.body.appendChild(canvas);
  const c = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = (canvas.width = window.innerWidth * dpr);
  const h = (canvas.height = window.innerHeight * dpr);
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
  const parts = Array.from({ length: amount }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.3,
    y: h * 0.45,
    vx: (Math.random() - 0.5) * 22 * dpr,
    vy: (-Math.random() * 22 - 8) * dpr,
    s: (6 + Math.random() * 8) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  function frame(now) {
    const t = now - start;
    c.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.6 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.r);
      c.globalAlpha = Math.max(0, 1 - t / duration);
      c.fillStyle = p.color;
      c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      c.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
