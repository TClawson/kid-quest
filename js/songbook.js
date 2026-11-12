// The music house's sheet music stand: a songbook of the game's own songs (the map songs and
// the secret shows' tunes), engraved as piano sheet music by abcjs (js/vendor/abcjs.js,
// loaded the first time the songbook opens). The first piano opens every map song and the
// upright piano the secret shows' tunes, easiest first (sheetmusic.js); a finished treasure
// map opens its show's tune early, with any piano. The list has three sections: map songs,
// show tunes and concert pieces (long pieces in several parts, concert.js, opened by the
// upright piano). Each song comes easy (the melody, chord names and a simple left
// hand), medium and hard (two-hand piano versions, arrange.js); a concert piece has the
// levels written for it so far, each with both hands written out. A piece can be heard (easy:
// the game's own arrangement; medium and hard and the concert pieces: the version on screen,
// on a piano-like voice, music.js) with the bar being played lit up, at its speed or slower.
// A piece the pianos have opened is then bought with coins (SONG_PRICE, sheetmusic.js), once
// for all its levels and every buddy; only a bought piece shows its music and Listen.
// Buying isn't held back by today's chores (the buddy shop is): the songbook is always open.
// Shared things come from ctx.js; app.js adds songbookActions to its actions.

import { ui, state, esc, kidById, render, progressFor, toast, viewKid, save, openModal, closeModal } from './ctx.js';
import { songbookFor, songAbc, songById, keyLabel, chordLabel, barEvents, meterOf, stars, SONG_PRICE, songBuyCheck, buySong } from './sheetmusic.js';
import { barChords } from './songs.js';
import { treasureFound } from './treasure.js';
import { musicTier, MUSIC_TIERS } from './musicrules.js';
import { itemById } from './items.js';
import { playPiece, playNotes, playTimeline } from './music.js';
import { sounds, confetti } from './fx.js';
import { LEVELS, hasLevel, arrangementAbc, arrangementNotes } from './arrange.js';
import { concertBookFor, isLongPiece, longLevels, longLevel, longAbc, longTimeline, longFacts, longSeconds, longLeadSheet } from './concert.js';

// ---------- settings (this device) ----------

const PREFS_KEY = 'kidquest.songbook';
const HANDS = [['melody', 'Melody'], ['roots', '+ Left hand notes'], ['chords', '+ Left hand chords']];
const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
function prefs() {
  let p = null;
  try { p = JSON.parse(globalThis.localStorage?.getItem(PREFS_KEY) || 'null'); } catch { p = null; }
  return {
    hands: HANDS.some(([h]) => h === p?.hands) ? p.hands : 'roots',
    names: Boolean(p?.names),
    slow: Boolean(p?.slow),
    level: LEVELS.includes(p?.level) ? p.level : 'easy',
  };
}
/**
 * The level a piece shows at: the one picked last, when the piece has it; otherwise easy (a
 * concert piece: its easiest level written so far).
 */
const levelOf = (id) => {
  if (isLongPiece(id)) return longLevel(id, prefs().level);
  return hasLevel(id, prefs().level) ? prefs().level : 'easy';
};
/** The levels a piece has, easiest first. */
const levelsOf = (id) => (isLongPiece(id) ? longLevels(id) : LEVELS.filter((l) => hasLevel(id, l)));
function setPrefs(change) {
  const next = { ...prefs(), ...change };
  try { globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode: just this visit */ }
  return next;
}

// ---------- the screens ----------

const pianoName = (tier) => itemById(MUSIC_TIERS[tier - 1].piano)?.name.toLowerCase() || 'next piano';

const mapName = (p) => itemById(p.map)?.name || 'map';
/** Where a piece comes from, in words. */
function source(p) {
  if (p.kind === 'long') return `From the ${mapName(p)} map song`;
  return p.kind === 'show' ? `The secret show on the ${mapName(p)} map` : `The ${mapName(p)} map song`;
}
const ICONS = { map: '🎵', show: '✨', long: '🎹' };
const iconOf = (p) => ICONS[p.kind] || '🎵';

/**
 * The kid's songbook: every piece (the songs, then the concert pieces), with open (the piano
 * lets them have it) and bought.
 */
function bookFor(kid) {
  const tier = musicTier(progressFor(kid));
  return [...songbookFor(tier, treasureFound(state.log, kid.id).maps, kid.owned), ...concertBookFor(tier, kid.owned)];
}
/** A piece the kid may look at and hear: open and bought. Anything else: null. */
const playable = (kid, id) => (id && bookFor(kid).find((p) => p.id === id && p.open && p.bought)) || null;

/** The songbook screen: the list of pieces, or one piece (ui.songId) once it is bought. */
export function viewSongbook() {
  const kid = kidById(ui.kidId);
  if (!kid) { ui.view = 'kid'; return viewKid(); }
  const book = bookFor(kid);
  const piece = ui.songId && book.find((p) => p.id === ui.songId && p.open && p.bought);
  if (ui.songId && !piece) ui.songId = null; // not theirs (yet): back to the list
  return piece ? pieceHtml(kid, piece) : listHtml(kid, book);
}

function listHtml(kid, book) {
  const mine = book.filter((p) => p.open && p.bought).length;
  const coins = progressFor(kid).coins;
  const card = (p) => {
    const s = stars(p.level);
    const name = p.secret ? 'Secret song' : p.name;
    const head = `<span class="song-icon" aria-hidden="true">${iconOf(p)}</span><b>${esc(name)}</b>`;
    if (!p.open) {
      const why = p.kind === 'show' ? `Opens with the ${pianoName(p.tier)}, or finish the ${mapName(p)} treasure map` : `Opens with the ${pianoName(p.tier)}`;
      return `<div class="song-card locked" aria-label="${esc(name)}, locked">${head}<small>🔒 ${esc(why)}</small></div>`;
    }
    if (!p.bought) {
      return `<button class="song-card buy" data-action="song-buy" data-id="${esc(p.id)}" aria-label="Buy ${esc(name)} for ${SONG_PRICE} coins">${head}
      <small>Buy it to see the music and listen.</small>
      <span class="song-price ${coins >= SONG_PRICE ? 'can' : ''}">🪙 ${SONG_PRICE}</span></button>`;
    }
    if (p.kind === 'long') {
      return `<button class="song-card" data-action="song-open" data-id="${esc(p.id)}">${head}
      <small>${esc(longFacts(p.id, levelOf(p.id)))}</small></button>`;
    }
    return `<button class="song-card" data-action="song-open" data-id="${esc(p.id)}">${head}
      <small>${esc(keyLabel(p.key))} · ${p.bars} bars</small>
      <span class="song-stars" aria-label="${['', 'Easy', 'Medium', 'Tricky'][s]}">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span></button>`;
  };
  const section = (title, list, locked) => `<section class="song-tier ${locked ? 'locked' : ''}"><h3>${title}</h3><div class="song-grid">${list.map(card).join('')}</div></section>`;
  const maps = book.filter((p) => p.kind === 'map');
  const shows = book.filter((p) => p.kind === 'show');
  const longs = book.filter((p) => p.kind === 'long');
  const sections = section('Map songs', maps, !maps.some((p) => p.open))
    + section('✨ Secret show songs', shows, !shows.some((p) => p.open))
    + (longs.length ? section('🎹 Concert pieces', longs, !longs.some((p) => p.open)) : '');
  return `
    <div class="screen songbook" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="songbook-back" aria-label="Back to the music house">←</button>
        <div class="kid-title"><b>🎼 Sheet music</b><small>${esc(kid.name)}'s songbook · ${mine} of ${book.length} songs yours</small></div>
        <div class="chips"><span class="chip coin" title="Coins">🪙 ${coins}</span></div>
      </header>
      <p class="muted song-intro">Songs from the game to play on your piano. Your first piano brings every map song, and the upright piano brings the secret show songs and the long concert pieces. A treasure map you finish brings its show song early! Each song costs 🪙 ${SONG_PRICE}. Buy it once, and all its music is yours with every buddy.</p>
      ${sections}
    </div>`;
}

function pieceHtml(kid, p) {
  if (p.kind === 'long') return longPieceHtml(kid, p);
  const o = prefs();
  const song = songById(p.id);
  const level = levelOf(p.id);
  const tabs = HANDS.map(([h, label]) => `<button class="${o.hands === h ? 'on' : ''}" data-action="song-hands" data-val="${h}" aria-pressed="${o.hands === h}">${label}</button>`).join('');
  const levels = LEVELS.filter((l) => hasLevel(p.id, l));
  const levelTabs = levels.map((l) => `<button class="${l === level ? 'on' : ''}" data-action="song-level" data-val="${l}" aria-pressed="${l === level}">${LEVEL_NAMES[l]}</button>`).join('');
  return `
    <div class="screen songbook piece" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="song-back" aria-label="Back to the songbook">←</button>
        <div class="kid-title"><b>${iconOf(p)} ${esc(p.name)}</b><small>${esc(keyLabel(p.key))} · speed ${song.bpm}${song.swing ? ', swing' : ''} · ${esc(source(p))}</small></div>
      </header>
      <div class="song-tools">
        ${levels.length > 1 ? `<nav class="tabs song-levels" aria-label="How hard">${levelTabs}</nav>` : ''}
        ${level === 'easy' ? `<nav class="tabs song-hands" aria-label="Which hands">${tabs}</nav>` : ''}
        <div class="song-buttons">
          <button class="btn ghost ${o.names ? 'on' : ''}" data-action="song-names" aria-pressed="${o.names}">🔤 Note names</button>
          <button class="btn ghost ${o.slow ? 'on' : ''}" data-action="song-slow" aria-pressed="${o.slow}">🐢 Slow</button>
          <button class="btn song-play" data-action="song-play">▶ Listen</button>
        </div>
      </div>
      <div class="sheet" id="sheet" data-id="${esc(p.id)}" data-hands="${o.hands}" data-level="${level}" data-names="${o.names ? 1 : 0}" aria-label="Sheet music for ${esc(p.name)}"><p class="muted sheet-wait">Getting the music ready…</p></div>
      <p class="muted small song-tip">${level === 'easy'
    ? `The letters above the music are chords: they tell your left hand what to play.${o.hands === 'melody' ? '' : ' The bottom line is your left hand.'}`
    : 'Both hands, written out: the top line is your right hand, the bottom line your left. The letters above are the chords.'}</p>
    </div>`;
}

/**
 * A concert piece: its story, its levels (only the ones written so far), and no hands to
 * pick (every level has both hands written out).
 */
function longPieceHtml(kid, p) {
  const o = prefs();
  const level = levelOf(p.id);
  const levelTabs = levelsOf(p.id).map((l) => `<button class="${l === level ? 'on' : ''}" data-action="song-level" data-val="${l}" aria-pressed="${l === level}">${LEVEL_NAMES[l]}</button>`).join('');
  return `
    <div class="screen songbook piece long" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="song-back" aria-label="Back to the songbook">←</button>
        <div class="kid-title"><b>${iconOf(p)} ${esc(p.name)}</b><small>${esc(longFacts(p.id, level))} · ${esc(source(p))}</small></div>
      </header>
      <p class="song-story">${esc(p.story)}</p>
      <div class="song-tools">
        <nav class="tabs song-levels" aria-label="How hard">${levelTabs}</nav>
        <div class="song-buttons">
          <button class="btn ghost ${o.names ? 'on' : ''}" data-action="song-names" aria-pressed="${o.names}">🔤 Note names</button>
          <button class="btn ghost ${o.slow ? 'on' : ''}" data-action="song-slow" aria-pressed="${o.slow}">🐢 Slow</button>
          <button class="btn song-play" data-action="song-play">▶ Listen</button>
        </div>
      </div>
      <div class="sheet" id="sheet" data-id="${esc(p.id)}" data-level="${level}" data-names="${o.names ? 1 : 0}" aria-label="Sheet music for ${esc(p.name)}"><p class="muted sheet-wait">Getting the music ready…</p></div>
      <p class="muted small song-tip">Both hands, written out: the top line is your right hand, the bottom line your left. Each part starts on a new line, with its name and speed.</p>
    </div>`;
}

// ---------- engraving ----------

let abcjsLoad = null;
/** abcjs, loaded on first use (it's big, and only the songbook needs it). */
function loadAbcjs(doc) {
  if (globalThis.ABCJS) return Promise.resolve(globalThis.ABCJS);
  abcjsLoad ||= new Promise((resolve, reject) => {
    const s = doc.createElement('script');
    s.src = 'js/vendor/abcjs.js';
    s.onload = () => (globalThis.ABCJS ? resolve(globalThis.ABCJS) : reject(new Error('abcjs')));
    s.onerror = () => { abcjsLoad = null; reject(new Error('abcjs')); };
    doc.head.appendChild(s);
  });
  return abcjsLoad;
}

/** Bars a line: four on a wide screen, two on a phone. */
const perLine = (el) => (el.clientWidth >= 640 ? 4 : 2);

/**
 * After each redraw of the songbook: engrave the piece (straight away once abcjs is loaded, so
 * the page keeps its height and scroll), and show whether it's playing (kept out of the
 * page's HTML, so starting and stopping doesn't make the next redraw build a new page).
 */
export function mountSongbook(root) {
  const el = root.querySelector('.songbook #sheet:not([data-live])');
  if (!el) return;
  el.dataset.live = '1';
  showPlaying();
  if (globalThis.ABCJS) { draw(el, globalThis.ABCJS); return; }
  loadAbcjs(el.ownerDocument).then((ABCJS) => draw(el, ABCJS), () => draw(el, null));
  // a load that hangs: show the plain lead sheet meanwhile (abcjs replaces it if it comes)
  setTimeout(() => { if (!el.classList.contains('drawn')) draw(el, null); }, LOAD_WAIT_MS);
}
const LOAD_WAIT_MS = 15000;

/** Draw the piece into el: engraved by abcjs, or as a plain lead sheet without it. */
function draw(el, ABCJS) {
  if (!el.isConnected) return;
  const per = perLine(el);
  el.dataset.per = String(per);
  el.classList.add('drawn');
  const long = isLongPiece(el.dataset.id);
  const level = el.dataset.level || 'easy';
  if (!ABCJS) { el.innerHTML = long ? longLeadSheetHtml(el.dataset.id, level, per) : leadSheetHtml(el.dataset.id, per); player.lit = -1; return; }
  const o = { hands: el.dataset.hands, names: el.dataset.names === '1', perLine: per };
  el.innerHTML = '';
  let abc;
  if (long) abc = longAbc(el.dataset.id, level, o);
  else abc = level === 'easy' ? songAbc(el.dataset.id, o) : arrangementAbc(el.dataset.id, level, o);
  const [tune] = ABCJS.renderAbc(el, abc, {
    add_classes: true,
    responsive: 'resize',
    staffwidth: per === 4 ? 900 : 440,
    paddingleft: 4,
    paddingright: 4,
    paddingtop: 8,
    paddingbottom: 8,
  });
  el.dataset.warnings = String(tune?.warnings?.length || 0);
  el.classList.add('engraved');
  player.lit = -1; // light the bar being played again on the new drawing
}

/**
 * Without abcjs (it didn't load): the melody's note names bar by bar, with the chord names
 * above them, the way a lead sheet shows them.
 */
export function leadSheetHtml(id, per = 4) {
  const song = songById(id);
  const bars = song.lead.map((bar, i) => {
    const notes = barEvents(bar).map((e) => (e.note ? e.note.replace(/\d/, '').replace('#', '♯').replace(/^([A-G])b$/, '$1♭') : '·')).join(' ');
    return `<div class="lead-bar abcjs-mm${i}"><b>${esc(barChords(song.chords[i]).map((c) => chordLabel(c.name)).join(' '))}</b><span>${esc(notes)}</span></div>`;
  });
  return `<div class="lead-sheet" style="--per:${per}">${bars.join('')}</div>`;
}

/** The plain lead sheet of a concert piece: each part's name, then its bars. */
export function longLeadSheetHtml(id, level, per = 4) {
  const parts = longLeadSheet(id, level).map((s) => `<h4 class="lead-part">${esc(s.name)}</h4>${s.bars.map((b) => `<div class="lead-bar abcjs-mm${b.n}"><b>${esc(b.chord)}</b><span>${esc(b.notes.join(' '))}</span></div>`).join('')}`);
  return `<div class="lead-sheet" style="--per:${per}">${parts.join('')}</div>`;
}

// re-engrave when the screen turns and a line fits a different number of bars
let resizeTimer = 0;
globalThis.addEventListener?.('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const el = document.querySelector('.songbook #sheet.drawn');
    if (el && Number(el.dataset.per) !== perLine(el)) draw(el, globalThis.ABCJS || null);
  }, 250);
});

// ---------- listening ----------

// the piece playing: { id, h (music.js handle), raf, lit (the bar lit up) }
const player = { id: null, h: null, raf: 0, lit: -1 };

/** The Listen button says Stop while its piece plays. */
function showPlaying() {
  const b = document.querySelector('.songbook [data-action="song-play"]');
  if (!b) return;
  const on = Boolean(player.h && player.id === ui.songId);
  b.textContent = on ? '■ Stop' : '▶ Listen';
  b.classList.toggle('playing', on);
}

function stopPiece() {
  cancelAnimationFrame(player.raf);
  player.h?.stop();
  Object.assign(player, { id: null, h: null, raf: 0, lit: -1 });
  document.querySelectorAll('#sheet .now').forEach((e) => e.classList.remove('now'));
  showPlaying();
}

function startPiece(id) {
  stopPiece();
  if (state.settings.sound === false) { toast('The sound is off. A parent can turn it on in Settings.'); return; }
  const tempo = prefs().slow ? 0.7 : 1;
  const level = levelOf(id);
  let h;
  if (isLongPiece(id)) {
    // each part at its own speed, held bars held: the handle says which bar is playing
    const { notes, bars } = longTimeline(id, level);
    h = playTimeline(notes, { bars, tempo });
  } else {
    const song = songById(id);
    h = level === 'easy'
      ? playPiece(id, { tempo })
      : playNotes(arrangementNotes(id, level), { bpm: song.bpm, beat: meterOf(song).steps, tempo, swing: song.swing || 0 });
  }
  if (!h) return;
  Object.assign(player, { id, h, lit: -1 });
  showPlaying();
  player.raf = requestAnimationFrame(follow);
}

/** Every frame while a piece plays: light up the bar being played, and keep it in view. */
function follow() {
  const p = player;
  if (!p.h) return;
  if (p.h.done() || ui.view !== 'songbook' || ui.songId !== p.id) { stopPiece(); return; }
  // a piece whose bars all last the same counts them from the time; one that changes speed
  // (a concert piece) says itself which bar is playing
  let bar;
  if (p.h.bar) bar = p.h.bar();
  else {
    const at = p.h.at();
    bar = at < 0 ? -1 : Math.floor(at / p.h.beat);
  }
  if (bar !== p.lit) {
    const sheet = document.getElementById('sheet');
    sheet?.querySelectorAll('.now').forEach((e) => e.classList.remove('now'));
    const els = bar >= 0 ? sheet?.querySelectorAll(`.abcjs-mm${bar}`) : null;
    if (els?.length) {
      els.forEach((e) => e.classList.add('now'));
      keepInView(els);
      p.lit = bar;
    }
  }
  p.raf = requestAnimationFrame(follow);
}

/** Scroll the bar being played into view when it isn't (below the buttons, which stay on top). */
function keepInView(els) {
  if (performance.now() - ownScroll < 3000) return; // the kid is reading ahead (or back)
  const boxes = [...els].map((e) => e.getBoundingClientRect());
  const top = Math.min(...boxes.map((b) => b.top));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  const under = document.querySelector('.songbook .song-tools')?.getBoundingClientRect().bottom || 0;
  if (top < under + 4 || bottom > window.innerHeight - 4) window.scrollBy({ top: top - under - 24, behavior: 'smooth' });
}

globalThis.document?.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stopPiece(); });
// when the kid scrolls the music themselves, it doesn't follow the playing for a moment
let ownScroll = -Infinity;
for (const type of ['wheel', 'touchmove', 'keydown']) globalThis.addEventListener?.(type, () => { ownScroll = performance.now(); }, { passive: true });

/** The first bar showing below the buttons, to keep the place when the music is drawn again. */
function barInView() {
  const under = document.querySelector('.songbook .song-tools')?.getBoundingClientRect().bottom || 0;
  let first = null;
  let best = Infinity;
  for (const e of document.querySelectorAll('#sheet .abcjs-note, #sheet .abcjs-rest, #sheet .lead-bar')) {
    const top = e.getBoundingClientRect().top;
    if (top >= under && top < best) { first = e; best = top; }
  }
  const m = first && [...first.classList].find((c) => /^abcjs-mm\d+$/.test(c));
  return m ? Number(m.slice(8)) : 0;
}

/** Scroll so bar n's line sits just below the buttons. */
function showBar(n) {
  const els = [...document.querySelectorAll(`#sheet .abcjs-mm${n}`)];
  if (!n || !els.length) return;
  const under = document.querySelector('.songbook .song-tools')?.getBoundingClientRect().bottom || 0;
  const top = Math.min(...els.map((e) => e.getBoundingClientRect().top));
  window.scrollBy(0, top - under - 24);
}

/** Redraw the piece with new settings, keeping the kid's place in the music. */
function redrawKeepingPlace(change) {
  const bar = barInView();
  setPrefs(change);
  render();
  showBar(bar);
}

/** How long a piece lasts, in seconds, at a tempo (for tests and the list). */
export function pieceSeconds(id, tempo = 1) {
  if (isLongPiece(id)) return longSeconds(id, levelOf(id)) / tempo;
  const song = songById(id);
  return (song.lead.length * meterOf(song).steps * 60) / song.bpm / 2 / tempo;
}

// ---------- taps ----------

/** Open a piece the kid has bought (anything else stays on the list). */
function openPiece(id) {
  stopPiece();
  const kid = kidById(ui.kidId);
  if (!kid || !playable(kid, id)) { ui.songId = null; render(); return; }
  listScroll = window.scrollY;
  ui.songId = id;
  render();
  window.scrollTo(0, 0);
}

/** Tapped a piece to buy: too few coins says how many more; otherwise ask first, like the shop. */
function askToBuy(id) {
  const kid = kidById(ui.kidId);
  if (!kid) return;
  const piece = bookFor(kid).find((p) => p.id === id);
  const coins = progressFor(kid).coins;
  const check = songBuyCheck(piece, coins);
  if (check === 'bought') { openPiece(id); return; }
  if (check === 'locked') return;
  if (check === 'short') {
    sounds.error();
    toast(`${SONG_PRICE - coins} more coins to go! Finish tasks to earn them.`);
    return;
  }
  openModal(`
    <div class="celebrate song-buy-ask">
      <div class="song-buy-art" aria-hidden="true">${iconOf(piece)}🎼</div>
      <h1>Buy ${esc(piece.name)}?</h1>
      <p>It costs <b>🪙 ${SONG_PRICE}</b>. You'll have ${coins - SONG_PRICE} coins left.</p>
      <p class="muted small">It opens the ${levelWords(levelsOf(piece.id))} music, for every buddy you have.</p>
      <div class="stack">
        <button class="btn huge" data-action="song-buy-confirm" data-id="${esc(piece.id)}">Buy it!</button>
        <button class="btn ghost" data-action="modal-close">Keep saving</button>
      </div>
    </div>`);
}

/** Levels in words: 'easy, medium and hard', 'hard'. */
function levelWords(levels) {
  const words = levels.map((l) => LEVEL_NAMES[l].toLowerCase());
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0] || '';
}

let listScroll = 0; // where the list was, for coming back to it from a piece
export const songbookActions = {
  'songbook-back': () => { stopPiece(); ui.view = 'kid'; ui.songId = null; render(); },
  'song-open': (el) => openPiece(el.dataset.id),
  'song-buy': (el) => askToBuy(el.dataset.id),
  'song-buy-confirm': (el) => {
    // looked up again now: a family update may have changed the kid while the question was up
    const kid = kidById(ui.kidId);
    const piece = kid && bookFor(kid).find((p) => p.id === el.dataset.id);
    if (!kid || !buySong(kid, piece, progressFor(kid).coins)) { closeModal(); render(); return; }
    save();
    closeModal();
    sounds.day();
    confetti(80, 1600);
    toast(`${piece.name} is yours!`);
    openPiece(piece.id); // straight to its music
  },
  'song-back': () => { stopPiece(); ui.songId = null; render(); window.scrollTo(0, listScroll); },
  'song-hands': (el) => redrawKeepingPlace({ hands: el.dataset.val }),
  'song-names': () => redrawKeepingPlace({ names: !prefs().names }),
  'song-level': (el) => {
    if (el.dataset.val === levelOf(ui.songId)) return;
    stopPiece(); // what's playing is the other version
    redrawKeepingPlace({ level: el.dataset.val });
  },
  'song-slow': () => {
    const slow = !prefs().slow;
    setPrefs({ slow });
    const was = player.h ? player.id : null;
    render();
    if (was) startPiece(was); // carry on at the new speed, from the top
  },
  'song-play': () => {
    if (player.h && player.id === ui.songId) { stopPiece(); return; }
    const kid = kidById(ui.kidId);
    if (ui.songId && kid && playable(kid, ui.songId)) startPiece(ui.songId);
    else { ui.songId = null; render(); }
  },
};

/** The music house's sheet music stand: open the songbook. */
export function openSongbook() {
  ui.view = 'songbook';
  ui.songId = null;
  listScroll = 0;
  render();
  window.scrollTo(0, 0);
}
