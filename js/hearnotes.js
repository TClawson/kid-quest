// The Note-o-Matic's ears, at work away from the screen: listener.js runs in a Worker
// (listener-worker.js) so the page keeps drawing, with how far it got as it goes. A browser
// that can't run a module Worker listens on the page itself instead, a moment later, so a
// "Listening…" screen can be drawn first. Used by the studio's panel (studio.js) and the
// Note-o-Matic's own screen (notolab.js).

/**
 * Listen to a recording (one channel at `rate`; the caller's samples are copied, never
 * changed). `clicks`: [{ at, hz }], metronome clicks it may hold (listener.js). progress(f)
 * is called now and then with 0..1; done(notes, failed) once at the end, with listener.js
 * notes, or (null, true) when it went wrong. Returns { stop(), worker (true while a Worker
 * listens) }: after stop() nothing more is called.
 */
export function hearNotes(samples, rate, clicks, { progress = () => {}, done }) {
  let w = null;
  let over = false;
  const finish = (notes, failed) => {
    if (over) return;
    over = true;
    end();
    done(failed ? null : notes, failed);
  };
  const end = () => {
    const was = w;
    w = null;
    try { was?.terminate(); } catch { /* gone */ }
  };
  // on the page itself, after a moment (the screen draws first)
  const here = () => {
    end();
    setTimeout(async () => {
      if (over) return;
      try {
        const { listen } = await import('./listener.js');
        if (over) return;
        const notes = listen(samples, rate, { clicks });
        finish(notes, !Array.isArray(notes));
      } catch { finish(null, true); }
    }, 60);
  };
  const job = { stop() { over = true; end(); }, get worker() { return Boolean(w); } };
  try { w = new Worker(new URL('./listener-worker.js', import.meta.url), { type: 'module' }); } catch { here(); return job; }
  const me = w;
  let answered = false;
  me.onmessage = (e) => {
    if (over || w !== me) return;
    answered = true;
    const d = e.data || {};
    if (d.progress != null && !('notes' in d) && !('error' in d)) { progress(d.progress); return; }
    finish(d.notes, Boolean(d.error) || !Array.isArray(d.notes));
  };
  me.onerror = (e) => {
    if (over || w !== me) return;
    e?.preventDefault?.();
    if (!answered) here(); // (an old browser that can't run a module Worker)
    else finish(null, true);
  };
  const copy = samples.slice(); // the caller keeps its own sound
  try { me.postMessage({ samples: copy, rate, clicks }, [copy.buffer]); } catch { here(); }
  return job;
}
