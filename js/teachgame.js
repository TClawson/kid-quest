// "Teach me your piano", on the Note-o-Matic's screen (notolab.js): the kid plays the piano's
// keys to the robot one at a time, group by group, and the robot keeps a picture of each key
// (pianoteach.js keyEar hears them, teachrules.js says what to make of what it heard). The
// taught piano is kept on the tablet (studio-store.js), where the robot's ears find it.
//
// notolab.js owns the screen. Its stage 'teach' is drawn from here (the map of the piano, or a
// round), and so is the card on its Ready stage. It hands over what is needed of its own
// (painting, the robot's line, the microphone's troubles, the wake lock) in teachGame(host),
// so this file never imports it. The tablet makes no sound during a round: the microphone
// would hear it.

import { esc } from './ctx.js';
import { openMic, capture } from './mic.js';
import { keyEar, emptyPiano, addKey } from './pianoteach.js';
import {
  TEACH_GROUPS, TEACH_KEYS, TEACH_LOW, TEACH_READY, groupById, newRound, wanted, roundStep, skipKey, offWords,
  keyName, isBlack, knownIn, knownKeys, nextGroup,
} from './teachrules.js';
import { loadPiano, savePiano, deletePiano } from './studio-store.js';

/**
 * How long a round waits for a key before the robot dozes off, and how long the microphone may
 * be silent before it counts as broken (ms). A test can make them shorter.
 */
export const TEACH_GAME = { doze: 45000, still: 3000 };

const LOW = 21;   // A0, the piano's first key
const HIGH = 108; // C8, its last
const NEAR = 2;   // keys shown dimmed on each side of a round's group

const SAY = {
  map: 'Tap a group, then play me its keys one at a time.',
  start: 'Play the glowing key. One key at a time, and let it ring.',
  got: ['Got it.', '', 'Nice and clear.'], // ('' is "That's a G.")
  soft: 'A little softer next time.',
  again: 'I have that one. Now the glowing key.',
  unclear: 'I couldn\'t make that out. Play the glowing key by itself.',
  fast: 'Let it ring a little longer.',
  skipped: 'Okay. Now the glowing key.',
  doze: 'I dozed off. Tap a group to go on.',
  hidden: 'I stopped listening because the app was put away.',
  micStopped: 'The microphone stopped, so I stopped listening.',
  deep: 'The lowest keys are too deep for the tablet\'s ears.',
  notYet: `The robot starts using what it learned at ${TEACH_READY} keys.`,
  using: 'The robot is using what it learned.',
  forgot: 'Okay, I forgot them all.',
  cantForget: 'I couldn\'t forget them. Please try again.',
};

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
const an = (name) => (/^[AEF]/.test(name) ? 'an' : 'a');

/** What the robot knows, in words: "The robot knows 12 of 64 keys". */
function knowsLine(n) {
  return n >= TEACH_KEYS ? `The robot knows all ${TEACH_KEYS} keys ★` : `The robot knows ${n} of ${TEACH_KEYS} keys`;
}

/**
 * The game, for one Note-o-Matic screen. `host` is what notolab.js lends it: desk(), stage(),
 * go(stage, robot) (another stage, with nothing said), robot(text), say(text, kind), paint(),
 * updateWake(), quiet() (every sound of the game stops), micTrouble(e), contextFor(stream),
 * inTime(promise, ms), LATE, wait() (ms a save may take), SAY (the lab's words).
 */
export function teachGame(host) {
  const T = {
    desk: null,
    piano: null,      // the taught piano as kept on the tablet (null: nothing taught)
    loaded: false,
    run: null,        // a round: { round, desk, ear, ac, stream, cap, heardAt, struckAt, check, ringing, log }
    keeping: false,   // keys on their way to the tablet: the groups wait
    chain: Promise.resolve(), // saves and forgets, one after the other
    confirm: false,   // "Forget all N keys?"
    said: 0,          // which "Got it." comes next
  };

  // ---------- opening and leaving ----------

  /** A desk opened: read its piano. */
  function open(desk) {
    stop();
    T.desk = desk;
    T.piano = null;
    T.loaded = false;
    T.confirm = false;
    loadPiano(desk).catch(() => null).then((piano) => {
      if (T.desk !== desk) return;
      T.piano = piano;
      T.loaded = true;
      host.paint();
    });
  }

  /** The screen went away: a round ends (keeping what it got), and the desk is forgotten. */
  function leave() {
    stop();
    T.desk = null;
    T.piano = null;
    T.loaded = false;
    T.confirm = false;
  }

  /** End a round, if one runs, keeping what it got; `to` is the stage to go to. */
  function stop(to = '') {
    if (T.run) finish({ to: to || 'teach' });
  }

  // ---------- the screen ----------

  /** The card on the robot's Ready stage. */
  function entryHtml() {
    const n = knownKeys(T.piano);
    const face = n === 0 ? 'Teach' : n >= TEACH_KEYS ? 'Teach again' : 'Teach more';
    return `<section class="lab-teach">
        <div><h3>Teach me your piano</h3><p>${T.loaded ? esc(knowsLine(n)) : 'Looking for your keys…'}</p></div>
        <button class="btn lab-teach-go" data-lab="teach-map" ${T.loaded ? '' : 'disabled'}>🎹 ${face}</button>
      </section>`;
  }

  /** Stage 'teach': a round, or the map of the piano. */
  function html() {
    return T.run ? roundHtml(T.run) : mapHtml();
  }

  function mapHtml() {
    const piano = T.piano;
    const next = T.loaded ? nextGroup(piano) : null;
    const busy = !T.loaded || T.keeping;
    const tiles = TEACH_GROUPS.map((g) => {
      const k = knownIn(piano, g);
      const all = k === g.keys.length;
      const on = next?.id === g.id;
      return `<button class="lab-tile ${all ? 'all' : ''} ${on ? 'next' : ''}" data-lab="teach-group" data-group="${g.id}" ${busy ? 'disabled' : ''}>
          <b>${esc(g.name)}</b><small>${k} of ${g.keys.length}${all ? ' ✓' : ''}</small>${on ? '<i class="lab-tile-next">Next</i>' : ''}
        </button>`;
    }).join('');
    const n = knownKeys(piano);
    const forget = !n ? '' : T.confirm
      ? `<span class="lab-teach-ask">Forget all ${n} keys?</span>
         <button class="btn danger" data-lab="teach-forget-yes" ${T.keeping ? 'disabled' : ''}>Yes</button>
         <button class="btn ghost" data-lab="teach-forget-no">No</button>`
      : `<button class="btn ghost lab-forget" data-lab="teach-forget" ${T.keeping ? 'disabled' : ''}>Start over</button>`;
    return `<section class="lab-map">
        <h3>${T.loaded ? esc(knowsLine(n)) : 'Looking for your keys…'}</h3>
        ${pianoSvg(piano)}
        <p class="lab-map-note">${esc(SAY.deep)}</p>
        <p class="lab-map-use">${esc(n >= TEACH_READY ? SAY.using : SAY.notYet)}</p>
      </section>
      <div class="lab-tiles">${tiles}</div>
      <div class="lab-row lab-map-foot">
        <button class="btn ghost" data-lab="teach-back">← Back</button>
        <span class="lab-map-forget">${forget}</span>
      </div>`;
  }

  /** All 88 keys, small: the ones the robot knows in the kid's colour, the deepest greyed. */
  function pianoSvg(piano) {
    const W = 10; const H = 56; const BW = 6; const BH = 34;
    let whites = ''; let blacks = ''; let x = 0; let mid = 0;
    for (let m = LOW; m <= HIGH; m += 1) {
      const cls = `${m < TEACH_LOW ? 'deep' : ''} ${piano?.keys?.[m] ? 'known' : ''}`;
      if (isBlack(m)) {
        blacks += `<rect class="pk-b ${cls}" x="${x * W - BW / 2}" y="0" width="${BW}" height="${BH}" vector-effect="non-scaling-stroke"/>`;
      } else {
        if (m === 60) mid = x;
        whites += `<rect class="pk-w ${cls}" x="${x * W}" y="0" width="${W}" height="${H}" vector-effect="non-scaling-stroke"/>`;
        x += 1;
      }
    }
    const n = knownKeys(piano);
    return `<div class="lab-piano-wrap">
        <svg class="lab-piano" viewBox="0 0 ${x * W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`Your piano. ${knowsLine(n)}.`)}">${whites}${blacks}</svg>
        <span class="lab-map-c" style="left:${(((mid + 0.5) / x) * 100).toFixed(2)}%">▲ middle C</span>
      </div>`;
  }

  function roundHtml(run) {
    const g = groupById(run.round.group);
    return `<section class="lab-teach-round">
        <div class="lab-teach-head"><b>${esc(g.name)}</b><span class="lab-teach-count" aria-live="polite">${countText(run)}</span></div>
        ${keysHtml(run)}
        <div class="lab-row lab-teach-buttons">
          <button class="btn ghost" data-lab="teach-skip">Skip this key</button>
          <button class="btn danger" data-lab="teach-stop">■ Stop</button>
        </div>
      </section>`;
  }

  const countText = (run) => `${Object.keys(run.round.got).length} of ${run.round.keys.length}`;

  /** The round's keys drawn like a piano, with a key or two each side dimmed. */
  function keysHtml(run) {
    const keys = run.round.keys;
    let lo = Math.max(LOW, keys[0] - NEAR);
    let hi = Math.min(HIGH, keys[keys.length - 1] + NEAR);
    while (isBlack(lo) && lo > LOW) lo -= 1;
    while (isBlack(hi) && hi < HIGH) hi += 1;
    let whites = 0;
    for (let m = lo; m <= hi; m += 1) if (!isBlack(m)) whites += 1;
    const w = 100 / whites; const bw = 0.62 * w;
    let x = 0;
    const out = [];
    for (let m = lo; m <= hi; m += 1) {
      const black = isBlack(m);
      const left = black ? x * w - bw / 2 : x * w;
      const look = lookOf(run, m);
      out.push(`<div class="tk ${black ? 'tk-b' : 'tk-w'} ${keys.includes(m) ? '' : 'ctx'} ${look.cls}" data-key="${m}" style="left:${left.toFixed(3)}%;width:${(black ? bw : w).toFixed(3)}%"><i class="tk-fill"></i><b class="tk-label">${esc(look.label)}</b></div>`);
      if (!black) x += 1;
    }
    return `<div class="lab-keys" role="img" aria-label="${esc(keysLabel(run))}">${out.join('')}</div>`;
  }

  /** How a key looks in a round: { cls, label }. */
  function lookOf(run, m) {
    const r = run.round;
    const want = wanted(r);
    if (m === want) return { cls: `want ${run.ringing > 0 ? 'striking' : ''}`, label: keyName(m) };
    if (r.got[m]) return { cls: 'taken', label: '✓' };
    if (r.skipped.includes(m)) return { cls: 'skipped', label: '' };
    return { cls: '', label: '' };
  }

  const keysLabel = (run) => (wanted(run.round) === null ? 'All done' : `Play the glowing key: ${keyName(wanted(run.round))}`);

  /** Bring the round's keys and count up to date without drawing them again (so the glow and fill go on). */
  function update(run) {
    const el = document.querySelector('#lab .lab-keys');
    if (!el || T.run !== run) return;
    for (const k of el.querySelectorAll('[data-key]')) {
      const m = Number(k.dataset.key);
      const look = lookOf(run, m);
      const was = k.classList.contains('striking');
      const now = look.cls.includes('striking');
      k.classList.toggle('want', look.cls.startsWith('want'));
      k.classList.toggle('taken', look.cls === 'taken');
      k.classList.toggle('skipped', look.cls === 'skipped');
      if (was && !now) k.classList.remove('striking');
      if (!was && now) { void k.offsetWidth; k.classList.add('striking'); } // (the fill starts from empty)
      const label = k.querySelector('.tk-label');
      if (label.textContent !== look.label) label.textContent = look.label;
    }
    el.setAttribute('aria-label', keysLabel(run));
    const count = document.querySelector('#lab .lab-teach-count');
    if (count) count.textContent = countText(run);
  }

  /** The robot says something new during a round, without drawing the screen again. */
  function line(text) {
    host.robot(text);
    const b = document.querySelector('#lab .lab-bubble');
    if (b) b.textContent = text;
  }

  // ---------- taps ----------

  function click(what, b) {
    if (what === 'teach-map') { if (host.stage() === 'ready') { T.confirm = false; host.go('teach'); host.paint(); } return; }
    if (what === 'teach-group') { start(b.dataset.group).catch(() => { if (T.run) fail(host.SAY.micBroken); }); return; }
    if (what === 'teach-skip') { skip(); return; }
    if (what === 'teach-stop') { finish(); return; }
    if (what === 'teach-back') { back(); return; }
    if (what === 'teach-forget') { T.confirm = true; host.paint(); return; }
    if (what === 'teach-forget-no') { T.confirm = false; host.paint(); return; }
    if (what === 'teach-forget-yes') forget();
  }

  /** Back to the robot's Ready stage (a round ends, keeping what it got). */
  function back() {
    T.confirm = false;
    if (T.run) finish({ to: 'ready' });
    else { host.go('ready'); host.paint(); host.updateWake(); }
  }

  // ---------- a round ----------

  async function start(id) {
    if (T.run || T.keeping || !T.loaded || host.stage() !== 'teach') return;
    const round = newRound(id);
    if (!round) return;
    host.quiet(); // the microphone would hear anything the tablet plays
    const run = { round, desk: T.desk, ear: null, ac: null, stream: null, cap: null, heardAt: 0, struckAt: 0, check: 0, ringing: 0, log: [] };
    T.run = run;
    T.confirm = false;
    host.go('teach', `${groupById(id).start} ${SAY.start}`);
    host.paint();
    host.updateWake();
    try {
      run.stream = await openMic();
    } catch (e) {
      if (T.run === run) fail(host.micTrouble(e));
      return;
    }
    if (T.run !== run) { run.stream.getTracks().forEach((t) => t.stop()); return; }
    try {
      run.ac = host.contextFor(run.stream);
      await run.ac.resume();
      run.ear = keyEar(run.ac.sampleRate);
      run.ear.expect(wanted(round));
      const cap = await capture(run.ac, run.stream, (block) => heard(run, block));
      if (T.run !== run) { cap.stop(); closeAc(run); return; }
      run.cap = cap;
    } catch {
      if (T.run === run) fail(host.SAY.cantRecord);
      else { run.stream.getTracks().forEach((t) => t.stop()); closeAc(run); }
      return;
    }
    run.heardAt = performance.now();
    run.struckAt = run.heardAt;
    run.stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => { if (T.run === run) fail(SAY.micStopped); }));
    // the sound clock may stop (another app takes the sound): never leave a stuck round
    run.check = setInterval(() => {
      if (T.run !== run) return;
      const now = performance.now();
      if (now - run.heardAt > TEACH_GAME.still) fail(host.SAY.micBroken);
      else if (now - run.struckAt > TEACH_GAME.doze) finish({ robot: SAY.doze });
    }, 500);
  }

  /** A block from the microphone: the ears do the work; the screen changes only when they say something. */
  function heard(run, block) {
    if (T.run !== run || !run.ear) return;
    run.heardAt = performance.now();
    for (const ev of run.ear.push(block.samples)) {
      if (T.run !== run) return;
      answer(run, ev);
    }
  }

  function answer(run, ev) {
    const r = roundStep(run.round, ev);
    run.ear.expect(wanted(run.round));
    if (r.what !== 'strike') run.log.push(r.what === 'other' ? `other ${r.midi}` : r.what);
    if (run.log.length > 60) run.log.shift();
    if (r.what === 'strike') {
      run.struckAt = performance.now();
      run.ringing += 1;
      update(run);
      return;
    }
    // every other answer is the answer to one strike
    run.ringing = Math.max(0, run.ringing - 1);
    if (r.what === 'done') { finish(); return; }
    if (r.what === 'key') {
      let said = SAY.got[T.said % SAY.got.length] || `That's ${an(keyName(r.midi))} ${keyName(r.midi)}.`;
      T.said += 1;
      if (r.loud) said += ` ${SAY.soft}`;
      line(said);
    } else if (r.what === 'other') line(`That was ${keyName(r.midi)}, ${offWords(r.off)}. Play the glowing key.`);
    else if (r.what === 'again') line(SAY.again);
    else if (r.what === 'unclear') line(SAY.unclear);
    else if (r.what === 'fast') line(SAY.fast);
    update(run);
  }

  function skip() {
    const run = T.run;
    if (!run) return;
    skipKey(run.round);
    run.ear?.expect(wanted(run.round));
    run.ringing = 0;
    if (run.round.done) { finish(); return; }
    line(SAY.skipped);
    update(run);
  }

  /** The round stopped by itself (the app put away, the microphone gone, a failure): what it got is kept. */
  function fail(text) {
    finish({ note: text });
  }

  /**
   * End the round: let the microphone go, keep what it got, and go back to the map (or `to`).
   * `robot`: what the robot says instead of how many keys were kept. `note`: what went wrong.
   */
  function finish({ to = 'teach', robot = '', note = '' } = {}) {
    const run = T.run;
    if (!run) return;
    T.run = null;
    letGo(run);
    const got = Object.entries(run.round.got).map(([m, learned]) => [Number(m), learned]);
    const all = run.round.done && got.length === run.round.keys.length;
    let said = robot;
    if (got.length && !said) {
      const n = knownKeys(withKeys(T.piano, got));
      said = all ? `That's all ${got.length}. ${knowsLine(n)} now.` : `Kept ${plural(got.length, 'key')}.`;
    }
    host.go(to, said);
    if (note) host.say(note, 'bad');
    host.paint();
    host.updateWake();
    if (got.length) keep(run.desk, got);
  }

  function letGo(run) {
    clearInterval(run.check);
    if (run.cap) run.cap.stop();
    else run.stream?.getTracks().forEach((t) => t.stop());
    closeAc(run);
    run.ear = null;
  }

  function closeAc(run) {
    run.ac?.close?.().catch(() => {});
    run.ac = null;
  }

  /** A piano with these keys put in: a copy (the one kept is changed only once the tablet has it). */
  function withKeys(piano, got) {
    let out = piano ? { ...piano, keys: { ...piano.keys } } : null;
    for (const [m, learned] of got) {
      if (!out) out = emptyPiano(learned.df);
      addKey(out, m, learned);
    }
    return out;
  }

  // ---------- keeping it on the tablet ----------

  /** One job on the tablet's piano after the one before it (so an older piano never lands over a newer one). */
  function inTurn(job) {
    const p = T.chain.then(job);
    T.chain = p.catch(() => {});
    return p;
  }

  async function keep(desk, got) {
    T.keeping = true;
    const saving = inTurn(async () => {
      // (the piano as kept by now: the screen's, or the tablet's when the screen has gone)
      const base = T.desk === desk && T.loaded ? T.piano : await loadPiano(desk);
      const piano = withKeys(base, got);
      await savePiano(desk, piano);
      if (T.desk === desk) T.piano = piano;
      return piano;
    });
    let res;
    try { res = await host.inTime(saving, host.wait()); } catch { res = null; }
    T.keeping = false;
    if (T.desk !== desk) return;
    if (res && res !== host.LATE) { host.paint(); return; }
    if (res === host.LATE) {
      // the tablet is slow: when it has them after all, the map shows them
      saving.then(() => {
        if (T.desk !== desk) return;
        if (host.noteIs(host.SAY.cantKeep)) host.say('');
        host.paint();
      }, () => {});
    }
    host.robot('');
    host.say(host.SAY.cantKeep, 'bad');
    host.paint();
  }

  async function forget() {
    const desk = T.desk;
    if (T.keeping || T.run || !desk) return;
    T.confirm = false;
    T.keeping = true;
    host.paint();
    const going = inTurn(async () => {
      await deletePiano(desk);
      if (T.desk === desk) T.piano = null;
    });
    let res;
    try { res = await host.inTime(going, host.wait()); } catch { res = null; }
    T.keeping = false;
    if (T.desk !== desk) return;
    if (res && res !== host.LATE) { host.robot(SAY.forgot); host.say(''); host.paint(); return; }
    if (res === host.LATE) {
      going.then(() => {
        if (T.desk !== desk) return;
        if (host.noteIs(SAY.cantForget)) { host.say(''); host.robot(SAY.forgot); }
        host.paint();
      }, () => {});
    }
    host.say(SAY.cantForget, 'bad');
    host.paint();
  }

  // ---------- for notolab.js and tests ----------

  return {
    open,
    leave,
    stop,
    entryHtml,
    html,
    click,
    back,
    line: () => SAY.map,
    /** The microphone is open (or opening) for a round: the screen stays on. */
    listening: () => Boolean(T.run),
    /** The app was put away: a round stops, keeping what it got. */
    hidden: () => { if (T.run) fail(SAY.hidden); },
    /**
     * What the game shows (for tests): { loaded, known, keys ([midi]), keeping, confirm,
     * round: { group, wanted, got ([midi]), skipped, mic (open), log (what was heard) } | null }.
     */
    state: () => ({
      loaded: T.loaded,
      known: knownKeys(T.piano),
      keys: Object.keys(T.piano?.keys || {}).map(Number),
      keeping: T.keeping,
      confirm: T.confirm,
      round: T.run && {
        group: T.run.round.group,
        wanted: wanted(T.run.round),
        got: Object.keys(T.run.round.got).map(Number),
        skipped: T.run.round.skipped.slice(),
        mic: Boolean(T.run.cap),
        log: T.run.log.slice(),
      },
    }),
  };
}
