// The composing desk's own screen in the music house: a kid writes a song of their own in four
// steps (key and timing, chords, tune, song), with as much help as their pianos have opened
// (composerules.js HELP). The song on the desk is kept as a draft while they work, and Keep puts
// it on a shelf of SONG_SLOTS songs (studio-store.js, on this tablet). Like the studio, the desk
// opens once today's chores are done. Parents get a test desk from Settings (behind the PIN),
// with every help level open; its songs are its own.
//
// app.js draws viewCompose() and calls mountCompose() after each redraw: it fills #compose from
// the state kept here, and stops the sound when the screen is gone.

import { ui, state, esc, kidById, render, viewKid, today, toast, progressFor, buddyHtml } from './ctx.js';
import { deskOpen, musicTier } from './musicrules.js';
import { stopMusic, musicContext } from './music.js';
import {
  HELP, helpOpen, homeNotes, MODES, METERS, METER_IDS, PATHS, chordsAt, chordDef, chordName, chordPcs, homeChord,
  JOB_NAME, fitsAfter, swapBars, keyName, noteName, pitchName, homeMidi, newSong, cleanSong, tuneLength,
  convertTune, moveTune, makeTune, startTune, leaningNotes, hearChords, hearTune, gridRows, sounding, SHAPES,
  RHYTHMS, GROOVES, VOICES, DRUMS, SECONDS, SONG_SLOTS, NAME_MOST, songEvents, backing, eighth, loopSeconds,
  BARS, freeSongSlot, hasTune, SCALE, voicing,
} from './composerules.js';
import { loadSongs, saveSong, deleteSong } from './studio-store.js';

const TEST_DESK = 'parent-test-desk';
const STEPS = ['Key', 'Chords', 'Tune', 'Song'];
const DRAFT_WAIT = 600; // ms after the last change before the draft is kept

// ---------- what the screen remembers while the app is open ----------

const D = {
  on: false,
  desk: null,      // whose songs: a kid's id or TEST_DESK
  most: 0,         // the least help this desk's pianos allow (0 lots, 2 little)
  song: null,      // the song on the desk (composerules.js), null while loading
  slot: -1,        // the shelf slot it came from, or -1
  shelf: null,     // [song|null × SONG_SLOTS]
  step: 0,
  sel: 0,          // the bar being chosen in the chords step
  shape: 'hill',
  rhythm: 'steady',
  show2: false,    // little help: "What do I hear?" opened
  show3: false,
  tints: true,     // little help: chord notes tinted in the grid
  confirm: -1,     // the shelf slot asking "Throw away?"
  draftTimer: 0,
  kept: '',        // a line after Keep
};
const A = { live: null, noise: null };

const deskId = () => (ui.composeTest ? TEST_DESK : ui.kidId);

function deskOf(id) {
  if (id === TEST_DESK) return { open: true, most: 2, back: { view: 'parent', tab: 'settings' }, backLabel: 'Back to Settings', title: 'Test desk', color: '#868e96', kid: null };
  const kid = kidById(id);
  if (!kid) return null;
  return { open: deskOpen(state, kid, today()).open, most: helpOpen(musicTier(progressFor(kid))), back: { view: 'kid' }, backLabel: 'Back to the music house', title: kid.name, color: kid.color, kid };
}

// ---------- the screen ----------

export function viewCompose() {
  const id = deskId();
  const desk = deskOf(id);
  if (!desk?.open) { ui.composeTest = false; ui.view = 'kid'; return viewKid(); }
  return `
    <div class="screen cd-screen" style="--kid:${esc(/^#[0-9a-f]{6}$/i.test(desk.color || '') ? desk.color : '#e03131')}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="compose-back" aria-label="${esc(desk.backLabel)}">←</button>
        <div class="kid-title"><b>✍️ Composing desk</b><small>${esc(desk.title)}</small></div>
      </header>
      <div id="compose" class="cd" data-desk="${esc(id)}" data-most="${desk.most}"><p class="muted">Sharpening the pencils…</p></div>
    </div>`;
}

/** After each redraw: fill the screen when it is there, or stop everything when it's gone. */
export function mountCompose(root) {
  const el = root.querySelector('#compose');
  if (!el) { if (D.on) leave(); return; }
  if (el.dataset.live) return;
  el.dataset.live = '1';
  D.on = true;
  stopMusic(); // the map song would play over the desk
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onInput);
  if (D.desk !== el.dataset.desk || !D.song) openDesk(el.dataset.desk, Number(el.dataset.most) || 0);
  else { D.most = Number(el.dataset.most) || 0; paint(); }
}

async function openDesk(id, most) {
  stop();
  Object.assign(D, { desk: id, most, song: null, shelf: null, slot: -1, step: 0, sel: 0, confirm: -1, kept: '', show2: false, show3: false });
  paint();
  const got = await loadSongs(id).catch(() => ({ draft: null, shelf: Array(SONG_SLOTS).fill(null) }));
  if (D.desk !== id) return;
  D.shelf = got.shelf;
  const draft = got.draft;
  D.slot = Number.isInteger(draft?.slot) && draft.slot >= 0 && draft.slot < SONG_SLOTS ? draft.slot : -1;
  D.song = draft || freshSong(most);
  delete D.song.slot;
  if (D.song.help > most) D.song.help = most;
  if (!draft) keepDraft();
  paint();
}

function freshSong(help) {
  const s = newSong(help);
  s.seed = 1 + Math.floor(Math.random() * 1000);
  if (help === 0) s.tune = makeTune(s, { shape: D.shape, rhythm: D.rhythm, seed: s.seed });
  return s;
}

function leave() {
  stop();
  if (D.draftTimer) { clearTimeout(D.draftTimer); D.draftTimer = 0; keepDraftNow(); }
  D.on = false;
}

/** The song on the desk changed: keep the draft a moment later. */
function keepDraft() {
  clearTimeout(D.draftTimer);
  D.draftTimer = setTimeout(keepDraftNow, DRAFT_WAIT);
}
function keepDraftNow() {
  D.draftTimer = 0;
  if (!D.desk || !D.song) return;
  saveSong(D.desk, 'draft', { ...D.song, slot: D.slot }).catch(() => {});
}

const body = () => document.querySelector('#compose');

// ---------- drawing ----------

function paint() {
  const el = body();
  if (!el) return;
  if (!D.song) { el.innerHTML = '<p class="muted">Sharpening the pencils…</p>'; return; }
  el.innerHTML = `
    <div class="cd-top">
      <nav class="cd-tabs" aria-label="Steps">${STEPS.map((s, i) => `<button class="btn small-btn${D.step === i ? ' on' : ''}" data-c="step" data-v="${i}" aria-current="${D.step === i}">${i + 1} ${s}</button>`).join('')}</nav>
      <div class="cd-help" role="group" aria-label="Help">
        <span>Help:</span>
        ${HELP.map((h) => {
          const locked = h.id > D.most;
          const piano = ['', 'your first piano', 'the upright piano', 'the rock star piano'][h.tier];
          return `<button class="btn small-btn${D.song.help === h.id ? ' on' : ''}${locked ? ' locked' : ''}" data-c="help" data-v="${h.id}" ${locked ? `aria-disabled="true" title="Opens with ${piano}"` : ''}>${locked ? '🔒 ' : ''}${h.short}</button>`;
        }).join('')}
      </div>
    </div>
    <div class="cd-sheet card">${[keyStep, chordStep, tuneStep, songStep][D.step]()}</div>`;
  if (D.step === 2) paintCells();
}

const tip = (face, html) => `<div class="cd-tip"><span class="cd-face" aria-hidden="true">${face}</span><p>${html}</p></div>`;
const helpNote = (lines) => `<p class="cd-helpnote">${esc(lines[D.song.help])}</p>`;
const nav = (back, next) => `<div class="cd-nav">${back ? `<button class="btn ghost" data-c="step" data-v="${D.step - 1}">◀ ${esc(back)}</button>` : '<span></span>'}${next ? `<button class="btn" data-c="step" data-v="${D.step + 1}">${esc(next)} ▶</button>` : '<span></span>'}</div>`;
const pick = (c, opts, cur, cls = '') => opts.map(([v, txt]) => `<button class="btn small-btn${cur === v ? ' on' : ''} ${cls}" data-c="${c}" data-v="${esc(v)}">${txt}</button>`).join('');
const hearList = (lines) => `<ul class="cd-hear">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;

// step 1: the key and the timing
function keyStep() {
  const s = D.song;
  const k = s.key;
  const third = k.mode === 'major' ? 4 : 3;
  return `
    <h2>Pick your key</h2>
    ${tip('♪', 'Every song has a <b>home note</b>. The tune feels finished when it gets back there. Pick one, then pick the mood.')}
    <div class="cd-label">Home note</div>
    <div class="cd-row">${homeNotes(k.mode, s.help).map((pc) => `<button class="btn small-btn cd-note${pc === k.tonic ? ' on' : ''}" data-c="tonic" data-v="${pc}">${esc(noteName(k, pc))}</button>`).join('')}</div>
    <div class="cd-modes">
      <button class="btn cd-mode${k.mode === 'major' ? ' on' : ''}" data-c="mode" data-v="major">☀ Major<small>Bright and sunny. Most happy songs.</small></button>
      <button class="btn cd-mode${k.mode === 'minor' ? ' on' : ''}" data-c="mode" data-v="minor">☁ Minor<small>Darker and mysterious. Spooky, brave or sad songs.</small></button>
    </div>
    <div class="cd-label">The home chord: ${esc(keyName(k))}</div>
    ${pianoHtml(k)}
    <div class="cd-row">
      <button class="btn small-btn ghost" data-c="hear" data-v="major-chord">▶ Major chord</button>
      <button class="btn small-btn ghost" data-c="hear" data-v="minor-chord">▶ Minor chord</button>
      <button class="btn small-btn" data-c="hear" data-v="both">▶ Same tune, both ways</button>
    </div>
    ${tip('?', `Major and minor share the home note and the top note. Only the <b>middle note</b> moves. In major it sits <b>4 keys</b> up from home: bright. In minor it sits <b>3 keys</b> up, one key lower: the sun goes behind a cloud. This one is ${third} keys up. Count them!`)}
    <div class="cd-label">Timing</div>
    <div class="cd-meters">${METER_IDS.map((id) => `<button class="btn cd-meter${s.meter === id ? ' on' : ''}" data-c="meter" data-v="${id}"><b>${id}</b><small>${esc(METERS[id].what)}</small></button>`).join('')}</div>
    <div class="cd-row"><button class="btn small-btn ghost" data-c="hear" data-v="meter">▶ Hear ${esc(s.meter)}</button></div>
    ${helpNote(['Lots of help: three easy home notes for each mood.', 'Some help: six home notes for each mood.', 'Little help: all twelve home notes, so 24 keys.'])}
    ${nav('', 'Next: chords')}`;
}

function pianoHtml(k) {
  const t = homeMidi(k);
  const chord = [t, t + (k.mode === 'major' ? 4 : 3), t + 7];
  const tag = ['home', 'middle', 'top'];
  const low = t < 60 ? 48 : 60;
  const W = [0, 2, 4, 5, 7, 9, 11];
  const B = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
  let html = '';
  for (let i = 0; i < 14; i += 1) {
    const m = low + Math.floor(i / 7) * 12 + W[i % 7];
    const at = chord.indexOf(m);
    html += `<span class="cd-wk${at >= 0 ? ` hit${at === 1 ? ' mid' : ''}` : ''}">${at >= 0 ? `<i>${tag[at]}</i>` : ''}${esc(noteName(k, m))}</span>`;
  }
  for (let o = 0; o < 2; o += 1) {
    for (const [pc, wi] of Object.entries(B)) {
      const m = low + o * 12 + Number(pc);
      const at = chord.indexOf(m);
      html += `<span class="cd-bk${at >= 0 ? ` hit${at === 1 ? ' mid' : ''}` : ''}" style="left:calc(${((o * 7 + wi + 1) / 14) * 100}% - ${100 / 14 / 3}%)">${at >= 0 ? `<i>${tag[at]}</i>` : ''}</span>`;
    }
  }
  return `<div class="cd-piano" aria-hidden="true">${html}</div>`;
}

// step 2: the chords
function chordStep() {
  const s = D.song;
  const k = s.key;
  const prev = D.sel > 0 ? chordDef(k.mode, s.bars[D.sel - 1]) : null;
  const glow = s.help < 2 && prev ? fitsAfter(prev) : [];
  const barBtn = (i) => {
    const c = chordDef(k.mode, s.bars[i]);
    return `<button class="btn cd-bar" data-job="${c.job}" data-c="bar" data-v="${i}" aria-pressed="${i === D.sel}"><small>bar ${i + 1}</small>${esc(chordName(k, c))}<small>${JOB_NAME[c.job]}</small></button>`;
  };
  const paths = s.help === 2 ? '' : `
    <div class="cd-label">Pick a path to start from</div>
    <div class="cd-paths">${PATHS[k.mode].map((p, i) => `<button class="btn cd-path" data-c="path" data-v="${i}"><b>${esc(p.name)}</b><span class="cd-prog">${p.bars.map((rn, j) => `${j === 4 ? '<em>·</em>' : ''}<span data-job="${chordDef(k.mode, rn).job}">${esc(chordName(k, chordDef(k.mode, rn)))}</span>`).join('')}</span><small>${esc(p.why)}</small></button>`).join('')}</div>`;
  const showHear = s.help < 2 || D.show2;
  return `
    <h2>Build your chords</h2>
    ${tip('♪', 'Chords have jobs. <b>Home</b> chords feel settled. <b>Away</b> chords take a step out. <b>Pull</b> chords lean so hard toward home that your ear waits for it.')}
    ${paths}
    <div class="cd-row cd-spread"><div class="cd-label">Your eight bars. Tap a bar, then a chord.</div><button class="btn small-btn" data-c="play" data-v="chords">▶ Play the chords</button></div>
    <div class="cd-label ink">The question</div>
    <div class="cd-bars">${[0, 1, 2, 3].map(barBtn).join('')}</div>
    <div class="cd-label ink">The answer</div>
    <div class="cd-bars">${[4, 5, 6, 7].map(barBtn).join('')}</div>
    <div class="cd-label">${prev && s.help < 2 ? `Chords for bar ${D.sel + 1}. After ${esc(chordName(k, prev))}, the glowing ones fit well.` : `Chords for bar ${D.sel + 1}`}</div>
    <div class="cd-chords">${chordsAt(k.mode, s.help).map((c) => `<button class="btn cd-chord${glow.includes(c.job) ? ' glow' : ''}" data-job="${c.job}" data-c="chord" data-v="${esc(c.rn)}"><i>${JOB_NAME[c.job]}</i>${esc(chordName(k, c))}<small>${esc(c.what)}</small></button>`).join('')}</div>
    <div class="cd-legend">${Object.entries(JOB_NAME).map(([j, n]) => `<span data-job="${j}">${n}</span>`).join('')}</div>
    ${s.help === 2 ? `<div class="cd-row"><button class="btn small-btn ghost" data-c="show2">${D.show2 ? 'Hide' : 'What do I hear?'}</button></div>` : ''}
    ${showHear ? hearList(hearChords(s)) : ''}
    ${helpNote(['Lots of help: start from a path and swap chords. Only home, away and pull chords.', 'Some help: build every bar. The chords that fit next glow.', 'Little help: every chord, borrowed ones too. No glow.'])}
    ${nav('Key', 'Next: tune')}`;
}

// step 3: the tune
function tuneStep() {
  const s = D.song;
  const st = METERS[s.meter].steps;
  const makers = s.help === 2 ? '' : `
    <div class="cd-makers">
      <fieldset><legend>Shape</legend><div class="cd-row">${pick('shape', Object.entries(SHAPES).map(([id, x]) => [id, `${x.icon} ${x.name}`]), D.shape)}</div></fieldset>
      <fieldset><legend>Rhythm</legend><div class="cd-row">${pick('rhythm', Object.entries(RHYTHMS).map(([id, x]) => [id, x.name]), D.rhythm)}</div></fieldset>
      <fieldset><legend>${s.help === 0 ? 'The desk writes it' : 'The desk starts it'}</legend><div class="cd-row"><button class="btn small-btn cd-go" data-c="make">✎ ${s.help === 0 ? 'Write me a tune' : 'Start me off'}</button></div></fieldset>
    </div>`;
  const grid = [0, 1].map((ph) => {
    const rows = gridRows(s, s.help);
    let h = `<div class="cd-roll" style="--cols:${4 * st};--st:${st}"><span class="cd-lab"></span>`;
    for (let b = ph * 4; b < ph * 4 + 4; b += 1) { const c = chordDef(s.key.mode, s.bars[b]); h += `<span class="cd-ch" data-job="${c.job}">${esc(chordName(s.key, c))} <small>bar ${b + 1}</small></span>`; }
    h += '<span class="cd-lab"></span>';
    for (let col = ph * 4 * st; col < (ph + 1) * 4 * st; col += 1) h += `<span class="cd-tk" data-col="${col}"></span>`;
    const tint = s.help < 2 || D.tints;
    for (const row of [...rows, 'z']) {
      const home = row !== 'z' && row % 12 === s.key.tonic;
      h += `<span class="cd-lab${home ? ' home' : ''}">${row === 'z' ? 'rest' : esc(pitchName(s.key, row))}</span>`;
      for (let col = ph * 4 * st; col < (ph + 1) * 4 * st; col += 1) {
        const b = Math.floor(col / st);
        const x = col % st;
        const c = chordDef(s.key.mode, s.bars[b]);
        const cls = ['cd-cell'];
        let job = '';
        if (row === 'z') cls.push('rest');
        else if (tint && chordPcs(s.key, c).includes(row % 12)) { cls.push('tone'); job = c.job; }
        if (home) cls.push('homerow');
        if (x === 0) cls.push('bar'); else if (METERS[s.meter].beats.includes(x)) cls.push('beat');
        h += `<button class="${cls.join(' ')}"${job ? ` data-job="${job}"` : ''} data-c="cell" data-col="${col}" data-row="${row}" aria-label="${row === 'z' ? 'Rest' : esc(pitchName(s.key, row))}, bar ${b + 1}, step ${x + 1}"></button>`;
      }
    }
    return `${h}</div>`;
  }).join('');
  return `
    <h2>Write your tune</h2>
    ${tip('♪', 'Tinted squares are the notes of that bar’s chord. Land on them on the big beats and the tune fits. Tap a square to start a note; it rings until the next one.')}
    ${makers}
    <div class="cd-row">
      <button class="btn small-btn" data-c="play" data-v="tune">▶ Tune and chords</button>
      <button class="btn small-btn ghost" data-c="play" data-v="tune-only">▶ Just the tune</button>
      <button class="btn small-btn ghost" data-c="clear">Clear</button>
      ${s.help === 2 ? `<label class="cd-check"><input type="checkbox" data-c="tints" ${D.tints ? 'checked' : ''}> Show chord notes</label>` : ''}
    </div>
    <div class="cd-grid">${grid}</div>
    ${s.help === 2 ? `<div class="cd-row"><button class="btn small-btn ghost" data-c="show3">${D.show3 ? 'Hide' : 'What do I hear?'}</button></div>` : ''}
    <div class="cd-hear-box"></div>
    ${helpNote(['Lots of help: pick a shape and a rhythm, and the desk writes a whole tune that fits your chords. Then change any note you like. Red squares rub against the chord.', 'Some help: the desk writes bar 1 and bar 5, the start of the question and of the answer. You write the rest. Red squares rub against the chord.', 'Little help: a blank page with every note, sharps and flats too.'])}
    ${nav('Chords', 'Next: make it a song')}`;
}

/** The tune grid's squares and the "What I hear" list, without drawing the grid again. */
function paintCells() {
  const el = body();
  if (!el || !D.song) return;
  const s = D.song;
  const now = sounding(s.tune);
  const lean = s.help < 2 ? leaningNotes(s) : new Set();
  for (const cell of el.querySelectorAll('.cd-cell')) {
    const col = Number(cell.dataset.col);
    const row = cell.dataset.row === 'z' ? 'z' : Number(cell.dataset.row);
    const on = s.tune[col] === row;
    cell.classList.toggle('on', on);
    cell.classList.toggle('hold', s.tune[col] === null && now[col] === row);
    cell.classList.toggle('lean', on && lean.has(col));
    cell.setAttribute('aria-pressed', String(on));
  }
  const box = el.querySelector('.cd-hear-box');
  if (box) box.innerHTML = s.help < 2 || D.show3 ? hearList(hearTune(s, s.help)) : '';
}

// step 4: the song
function songStep() {
  const s = D.song;
  const secs = loopSeconds(s.meter, s.bpm);
  const m = METERS[s.meter];
  const kid = deskOf(D.desk)?.kid;
  const strip = Array.from({ length: BARS * 2 }, (_, i) => { const c = chordDef(s.key.mode, s.bars[i % BARS]); return `<span data-job="${c.job}" data-i="${i}">${esc(chordName(s.key, c))}</span>`; }).join('');
  return `
    <h2>Make it a song</h2>
    ${tip('♪', 'Your eight bars play twice: 16 bars. Make the second time different so the loop keeps growing, then hit play and let it go round.')}
    <div class="cd-mix">
      <fieldset><legend>Groove</legend><div class="cd-row">${pick('groove', Object.entries(GROOVES).map(([id, g]) => [id, g.name]), s.groove)}</div><small>${esc(GROOVES[s.groove].what[s.meter])}</small></fieldset>
      <fieldset><legend>Tune sound</legend><div class="cd-row">${pick('voice', Object.entries(VOICES), s.voice)}</div></fieldset>
      <fieldset><legend>Drums</legend><div class="cd-row">${pick('drums', Object.entries(DRUMS), s.drums)}</div><small>Drums that come in halfway make the loop feel like it is building.</small></fieldset>
      <fieldset><legend>Second time round, the tune</legend><div class="cd-row">${pick('second', Object.entries(SECONDS).map(([id, x]) => [id, x.name]), s.second)}</div><small>${esc(SECONDS[s.second].what)}</small></fieldset>
    </div>
    <div class="cd-row"><label class="cd-label" for="cd-bpm">Speed</label><input type="range" id="cd-bpm" data-c="bpm" min="${m.min}" max="${m.max}" step="${m.step}" value="${s.bpm}"><span class="cd-bpm">${s.bpm} beats a minute · ${fmt(secs)} a loop</span></div>
    <div class="cd-play">
      ${kid ? `<div class="cd-buddy" style="--beat:${(60 / s.bpm).toFixed(3)}s">${buddyHtml(kid, 'happy', 'md')}</div>` : ''}
      <div class="cd-playing">
        <div class="cd-row"><button class="btn cd-go" data-c="play" data-v="song">▶ Play loop</button><span class="cd-clock">0:00</span></div>
        <div class="cd-strip">${strip}</div>
      </div>
    </div>
    <div class="cd-row cd-keep">
      <input id="cd-name" data-c="name" maxlength="${NAME_MOST}" placeholder="Name your song" value="${esc(s.name)}" aria-label="Song name">
      <button class="btn" data-c="keep">${D.slot >= 0 ? 'Keep changes' : 'Keep it'}</button>
      <button class="btn ghost" data-c="new">New song</button>
    </div>
    ${D.kept ? `<p class="cd-kept" role="status">${esc(D.kept)}</p>` : ''}
    ${shelfHtml()}
    ${nav('Tune', '')}`;
}

function shelfHtml() {
  if (!D.shelf) return '';
  return `
    <div class="cd-label">My songs</div>
    <div class="cd-shelf">${D.shelf.map((s, i) => (s ? `
      <div class="cd-song${i === D.slot ? ' here' : ''}">
        <b>${esc(s.name || `Song ${i + 1}`)}</b><small>${esc(keyName(s.key))} · ${esc(s.meter)} · ${fmt(loopSeconds(s.meter, s.bpm))}</small>
        <div class="cd-row">
          <button class="btn small-btn" data-c="shelf-play" data-v="${i}">▶</button>
          <button class="btn small-btn ghost" data-c="shelf-open" data-v="${i}">Open</button>
          <button class="btn small-btn ghost${D.confirm === i ? ' danger' : ''}" data-c="shelf-throw" data-v="${i}">${D.confirm === i ? 'Sure? Throw away' : '🗑'}</button>
        </div>
      </div>` : `<div class="cd-song empty"><small>Empty spot</small></div>`)).join('')}</div>`;
}

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// ---------- what taps do ----------

function changed(redraw = true) {
  stop();
  D.kept = '';
  keepDraft();
  if (redraw) paint();
}

function setKey(tonic, mode) {
  const s = D.song;
  const to = { tonic, mode };
  if (mode !== s.key.mode) s.bars = swapBars(s.bars, s.key.mode, mode, s.help);
  s.tune = moveTune(s.tune, s.key, to);
  s.key = to;
}

function onClick(e) {
  const b = e.target.closest('[data-c]');
  if (!b || !D.song || b.tagName === 'INPUT') return;
  const s = D.song;
  const c = b.dataset.c;
  const v = b.dataset.v;
  if (c !== 'shelf-throw') D.confirm = -1;
  switch (c) {
    case 'step': stop(); D.step = Math.max(0, Math.min(3, Number(v))); paint(); window.scrollTo?.(0, 0); return;
    case 'help': {
      const h = Number(v);
      if (h > D.most) { toast(`🔒 ${HELP[h].name} opens with ${['', 'your first piano', 'the upright piano', 'the rock star piano'][HELP[h].tier]}.`); return; }
      s.help = h;
      const keys = homeNotes(s.key.mode, h);
      if (!keys.includes(s.key.tonic)) setKey(keys[0], s.key.mode);
      s.bars = s.bars.map((rn) => (chordDef(s.key.mode, rn).lvl <= h ? rn : homeChord(s.key.mode).rn));
      changed();
      return;
    }
    case 'tonic': setKey(Number(v), s.key.mode); changed(); hearChord(s.key.mode === 'minor'); return;
    case 'mode': {
      if (v === s.key.mode || !MODES.includes(v)) { hearSame(v); return; }
      // the relative key when it is offered (C major and A minor share their notes), else the first
      const rel = v === 'minor' ? (s.key.tonic + 9) % 12 : (s.key.tonic + 3) % 12;
      const keys = homeNotes(v, s.help);
      setKey(keys.includes(rel) ? rel : keys[0], v);
      changed();
      hearSame(v);
      return;
    }
    case 'meter':
      if (!METERS[v] || v === s.meter) { hearMeter(); return; }
      s.tune = convertTune(s.tune, s.meter, v);
      s.meter = v;
      s.bpm = METERS[v].bpm;
      changed();
      hearMeter();
      return;
    case 'hear':
      if (v === 'major-chord') hearChord(false, b);
      else if (v === 'minor-chord') hearChord(true, b);
      else if (v === 'meter') hearMeter(b);
      else hearSame(null, b);
      return;
    case 'path': s.bars = PATHS[s.key.mode][Number(v)].bars.slice(); changed(); play(backing(s, { groove: 'steady' })); return;
    case 'bar': D.sel = Number(v); paint(); playChord(chordDef(s.key.mode, s.bars[D.sel])); return;
    case 'chord': {
      const def = chordDef(s.key.mode, v);
      if (def.lvl > s.help) return;
      s.bars[D.sel] = def.rn;
      if (D.sel < BARS - 1) D.sel += 1;
      changed();
      playChord(def);
      return;
    }
    case 'show2': D.show2 = !D.show2; paint(); return;
    case 'show3': D.show3 = !D.show3; paintCells(); b.textContent = D.show3 ? 'Hide' : 'What do I hear?'; return;
    case 'shape': D.shape = v; paint(); return;
    case 'rhythm': D.rhythm = v; paint(); return;
    case 'make':
      s.seed = (s.seed || 1) + 1;
      s.tune = s.help === 0 ? makeTune(s, { shape: D.shape, rhythm: D.rhythm, seed: s.seed }) : startTune(s, { shape: D.shape, rhythm: D.rhythm, seed: s.seed });
      changed();
      playTune(true);
      return;
    case 'cell': {
      const col = Number(b.dataset.col);
      const row = b.dataset.row === 'z' ? 'z' : Number(b.dataset.row);
      s.tune[col] = s.tune[col] === row ? null : row;
      changed(false);
      paintCells();
      if (Number.isInteger(row) && s.tune[col] === row) blip(row);
      return;
    }
    case 'clear': s.tune = Array(tuneLength(s.meter)).fill(null); changed(); return;
    case 'play':
      if (v === 'chords') playChords(b);
      else if (v === 'tune') playTune(true, b);
      else if (v === 'tune-only') playTune(false, b);
      else playSong(b);
      return;
    case 'groove': case 'voice': case 'drums': case 'second':
      if (({ groove: GROOVES, voice: VOICES, drums: DRUMS, second: SECONDS })[c][v]) { s[c] = v; changed(); }
      return;
    case 'keep': keep(); return;
    case 'new':
      stop();
      D.song = freshSong(Math.min(s.help, D.most));
      D.slot = -1;
      D.step = 0;
      D.kept = '';
      keepDraft();
      paint();
      return;
    case 'shelf-play': { const song = D.shelf?.[Number(v)]; if (song) playSong(b, song); return; }
    case 'shelf-open': {
      const i = Number(v);
      const song = D.shelf?.[i];
      if (!song) return;
      stop();
      D.song = cleanSong(JSON.parse(JSON.stringify(song)));
      delete D.song.slot;
      if (D.song.help > D.most) D.song.help = D.most;
      D.slot = i;
      D.kept = `${song.name || `Song ${i + 1}`} is on the desk.`;
      keepDraft();
      paint();
      return;
    }
    case 'shelf-throw': {
      const i = Number(v);
      if (D.confirm !== i) { D.confirm = i; paint(); return; }
      D.confirm = -1;
      deleteSong(D.desk, i).then(() => {
        if (!D.shelf) return;
        D.shelf[i] = null;
        if (D.slot === i) D.slot = -1;
        D.kept = 'Okay, it’s gone.';
        keepDraft();
        paint();
      }, () => toast('I couldn’t throw it away. Please try again.'));
      return;
    }
    default:
  }
}

function onInput(e) {
  const t = e.target;
  if (!D.song) return;
  if (t.dataset.c === 'bpm') {
    const m = METERS[D.song.meter];
    D.song.bpm = Math.max(m.min, Math.min(m.max, Number(t.value) || m.bpm));
    stop();
    keepDraft();
    const span = body()?.querySelector('.cd-bpm');
    if (span) span.textContent = `${D.song.bpm} beats a minute · ${fmt(loopSeconds(D.song.meter, D.song.bpm))} a loop`;
    body()?.querySelector('.cd-buddy')?.style.setProperty('--beat', `${(60 / D.song.bpm).toFixed(3)}s`);
  } else if (t.dataset.c === 'name') {
    D.song.name = t.value.slice(0, NAME_MOST);
    keepDraft();
  } else if (t.dataset.c === 'tints' && e.type === 'change') {
    D.tints = t.checked;
    paint();
  }
}

function keep() {
  const s = D.song;
  if (!hasTune(s)) { toast('Write a tune first: the Tune step.'); return; }
  if (!D.shelf) return;
  const slot = D.slot >= 0 ? D.slot : freeSongSlot(D.shelf);
  if (slot < 0) { toast('Your song shelf is full. Throw a song away to keep a new one.'); return; }
  const name = (s.name || '').trim() || `Song ${slot + 1}`;
  const song = { ...JSON.parse(JSON.stringify(s)), name, at: Date.now() };
  delete song.slot;
  saveSong(D.desk, slot, song).then(() => {
    D.shelf[slot] = cleanSong(song);
    D.slot = slot;
    s.name = name;
    D.kept = `“${name}” is on your song shelf!`;
    keepDraftNow();
    paint();
  }, () => toast('I couldn’t keep it on this tablet. Please try again.'));
}

// ---------- sound ----------

function soundOff() {
  if (state.settings?.sound === false) { toast('The sound is off. A parent can turn it on in Settings.'); return true; }
  return false;
}

const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function piano(a, out, m, t, dur, v) {
  const f = hz(m);
  const g = a.createGain();
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(6000, f * 5);
  const o1 = a.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
  const o2 = a.createOscillator(); o2.frequency.value = f * 2;
  const g2 = a.createGain(); g2.gain.value = 0.2;
  o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
  const end = t + Math.max(0.08, dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.008);
  g.gain.setTargetAtTime(v * 0.22, t + 0.008, 0.8); g.gain.setTargetAtTime(0, end, 0.12);
  o1.start(t); o2.start(t); o1.stop(end + 0.8); o2.stop(end + 0.8);
}
function chip(a, out, m, t, dur, v) {
  const o = a.createOscillator();
  const g = a.createGain();
  const lp = a.createBiquadFilter();
  o.type = 'square'; o.frequency.value = hz(m);
  lp.type = 'lowpass'; lp.frequency.value = 3200;
  o.connect(lp).connect(g).connect(out);
  const end = t + Math.max(0.06, dur * 0.92);
  const vv = v * 0.42;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vv, t + 0.005);
  g.gain.setTargetAtTime(vv * 0.7, t + 0.01, 0.1); g.gain.setTargetAtTime(0, end, 0.03);
  o.start(t); o.stop(end + 0.3);
}
function flute(a, out, m, t, dur, v) {
  const f = hz(m);
  const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f;
  const o2 = a.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
  const g = a.createGain();
  const g2 = a.createGain(); g2.gain.value = 0.25;
  const lfo = a.createOscillator(); lfo.frequency.value = 5.2;
  const lg = a.createGain();
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.3);
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  o.connect(g); o2.connect(g2).connect(g); g.connect(out);
  const end = t + Math.max(0.1, dur);
  const vv = v * 1.1;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vv, t + 0.05);
  g.gain.setTargetAtTime(vv * 0.8, t + 0.06, 0.3); g.gain.setTargetAtTime(0, end, 0.06);
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(end + 0.4); }
}
function drum(a, out, kind, t, v) {
  if (kind === 'kick') {
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.25);
    return;
  }
  if (!A.noise || A.noise.sampleRate !== a.sampleRate) {
    A.noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.3), a.sampleRate);
    const d = A.noise.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource();
  const hp = a.createBiquadFilter();
  const g = a.createGain();
  s.buffer = A.noise; hp.type = 'highpass';
  hp.frequency.value = kind === 'snare' ? 1200 : 6500;
  const len = kind === 'snare' ? 0.13 : 0.035;
  g.gain.setValueAtTime((kind === 'snare' ? 0.32 : 0.09) * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(hp).connect(g).connect(out); s.start(t); s.stop(t + len + 0.02);
}
const SYNTH = { piano, chip, flute };

function audio() {
  const a = musicContext();
  if (!a) { toast('This tablet can’t play sound here.'); return null; }
  if (a.state === 'suspended') a.resume().catch(() => {});
  return a;
}

/**
 * Play events (composerules.js); btn shows Stop while they play (a second tap stops them).
 * marks: [[seconds, fn]] run in time; loop: seconds a pass lasts, to go round until stopped.
 */
function play(events, btn = null, { marks = [], loop = 0, after = null } = {}) {
  const was = A.live;
  stop();
  if (btn && was?.btn === btn) return;
  if (soundOff() || !events.length) return;
  const a = audio();
  if (!a) return;
  const master = a.createGain();
  master.gain.value = 0.6;
  master.connect(a.destination);
  const me = { master, btn, timers: [], after, label: btn?.innerHTML };
  A.live = me;
  if (btn) { btn.innerHTML = '■ Stop'; btn.classList.add('playing'); }
  body()?.classList.add('cd-on');
  let end = 0;
  for (const e of events) end = Math.max(end, e.t + (e.d || 0));
  const pass = (t0) => {
    if (A.live !== me) return;
    for (const e of events) {
      if (e.drum) drum(a, master, e.drum, t0 + e.t, e.v);
      else (SYNTH[e.voice] || piano)(a, master, e.m, t0 + e.t, e.d, e.v);
    }
    const lag = (t0 - a.currentTime) * 1000;
    for (const [s, fn] of marks) me.timers.push(setTimeout(fn, lag + s * 1000));
    if (loop) me.timers.push(setTimeout(() => pass(t0 + loop), lag + (loop - 0.4) * 1000));
    else me.timers.push(setTimeout(stop, lag + (end + 0.9) * 1000));
  };
  pass(a.currentTime + 0.12);
}

function stop() {
  const me = A.live;
  if (!me) return;
  A.live = null;
  me.timers.forEach(clearTimeout);
  try {
    me.master.gain.setTargetAtTime(0, me.master.context.currentTime, 0.04);
    setTimeout(() => me.master.disconnect(), 400);
  } catch { /* gone already */ }
  if (me.btn?.isConnected) { me.btn.innerHTML = me.label; me.btn.classList.remove('playing'); }
  body()?.classList.remove('cd-on');
  me.after?.();
}

function blip(m) {
  if (state.settings?.sound === false) return;
  const a = audio();
  if (!a) return;
  const g = a.createGain();
  g.gain.value = 0.6;
  g.connect(a.destination);
  (SYNTH[D.song.voice] || piano)(a, g, m, a.currentTime + 0.02, 0.45, 0.22);
}

const chordNotes = (key, c, t = 0, d = 1.5) => {
  const v = voicing(key, c);
  return [{ t, d, m: v.bass, v: 0.12, voice: 'piano' }, ...v.tones.map((m, j) => ({ t: t + 0.04 * j, d, m, v: 0.08, voice: 'piano' }))];
};
const playChord = (c) => play(chordNotes(D.song.key, c));

function hearChord(minor, btn = null) {
  const t = homeMidi(D.song.key);
  play([t - 12, t, t + (minor ? 3 : 4), t + 7].map((m, j) => ({ t: j * 0.03, d: 1.4, m, v: j ? 0.09 : 0.12, voice: 'piano' })), btn);
}

/** One little tune, played in major and then in minor on the same home note (or in one mood). */
function hearSame(only, btn = null) {
  const tune = [[0, 1], [1, 1], [2, 1], [0, 1], [2, 1], [3, 1], [4, 2], [4, 0.5], [5, 0.5], [4, 0.5], [3, 0.5], [2, 1], [1, 1], [0, 3]];
  const harm = [[0, 0], [0, 4], [4, 8], [0, 11]];
  const q = 0.36;
  const out = [];
  (only ? [only] : ['major', 'minor']).forEach((mode, k) => {
    const sc = SCALE[mode];
    const base = k * 15 * q;
    const t = homeMidi(D.song.key);
    let at = 0;
    for (const [d, len] of tune) { out.push({ t: base + at * q, d: len * q * 0.95, m: t + 12 + sc[d], v: 0.2, voice: 'piano' }); at += len; }
    const deg = (i) => sc[i % 7] + (i >= 7 ? 12 : 0);
    for (const [dg, beat] of harm) {
      const root = t - 12 + sc[dg];
      const third = t - 12 + deg(dg + 2) + (mode === 'minor' && dg === 4 ? 1 : 0);
      const fifth = t - 12 + deg(dg + 4);
      [root - 12, root, third, fifth].forEach((m, j) => out.push({ t: base + beat * q, d: (beat === 8 ? 3 : 4) * q, m, v: j ? 0.06 : 0.1, voice: 'piano' }));
    }
  });
  play(out, btn);
}

/** Two bars of the home chord in the timing, with a click on each counted beat (loud on the big ones). */
function hearMeter(btn = null) {
  const s = D.song;
  const m = METERS[s.meter];
  const song = { ...s, bars: [homeChord(s.key.mode).rn, homeChord(s.key.mode).rn], groove: 'steady' };
  const e = eighth(s.meter, s.bpm);
  const ev = backing({ ...song, bars: song.bars.concat(Array(BARS - 2).fill(song.bars[0])) }, { passes: 1, groove: 'steady' }).filter((x) => x.t < 2 * m.steps * e - 0.01);
  for (let b = 0; b < 2; b += 1) for (const x of m.beats) ev.push({ t: (b * m.steps + x) * e, drum: m.strong.includes(x) ? 'kick' : 'hat', v: 1 });
  play(ev, btn);
}

function playChords(btn) {
  const s = D.song;
  const e = eighth(s.meter, s.bpm);
  const st = METERS[s.meter].steps;
  const lit = (i) => body()?.querySelectorAll('.cd-bar').forEach((x, j) => x.classList.toggle('now', j === i));
  play(backing(s, { groove: 'steady' }), btn, { marks: s.bars.map((_, i) => [i * st * e, () => lit(i)]), after: () => lit(-1) });
}

function playTune(chords, btn = null) {
  const s = D.song;
  const e = eighth(s.meter, s.bpm);
  const ticks = [...(body()?.querySelectorAll('.cd-tk') || [])];
  const lit = (col) => ticks.forEach((x) => x.classList.toggle('now', Number(x.dataset.col) === col));
  play(songEvents(s, { full: false, tuneOnly: !chords }), btn, { marks: s.tune.map((_, col) => [Math.floor(col / METERS[s.meter].steps) * METERS[s.meter].steps * e + (col % METERS[s.meter].steps) * e, () => lit(col)]), after: () => lit(-1) });
}

function playSong(btn, song = D.song) {
  const e = eighth(song.meter, song.bpm);
  const st = METERS[song.meter].steps;
  const len = loopSeconds(song.meter, song.bpm);
  const here = song === D.song;
  const lit = (i) => {
    if (!here) return;
    const el = body();
    el?.querySelectorAll('.cd-strip span').forEach((x, j) => x.classList.toggle('now', j === i));
    const clock = el?.querySelector('.cd-clock');
    if (clock) clock.textContent = fmt(Math.max(0, i) * st * e);
  };
  play(songEvents(song), btn, { loop: len, marks: Array.from({ length: BARS * 2 }, (_, i) => [i * st * e, () => lit(i)]), after: () => lit(-1) });
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stop(); });

// ---------- opening it, and for tests ----------

export const composeActions = {
  'compose-back': () => {
    const back = deskOf(deskId())?.back || { view: 'kid' };
    leave();
    Object.assign(ui, back, { composeTest: false });
    render();
  },
  // Settings › Try the composing desk: only from the parent's screen, which is behind the PIN
  'compose-test': () => { if (ui.view === 'parent') openCompose({ test: true }); },
};

export function openCompose({ test = false } = {}) {
  ui.composeTest = test;
  ui.view = 'compose';
  render();
  window.scrollTo(0, 0);
}

/** What the desk shows (for tests): the step, help, the song and the shelf's names. */
export function composeState() {
  return {
    step: D.step,
    most: D.most,
    song: D.song && JSON.parse(JSON.stringify(D.song)),
    slot: D.slot,
    shelf: D.shelf && D.shelf.map((s) => (s ? s.name : null)),
    playing: Boolean(A.live),
    kept: D.kept,
  };
}
