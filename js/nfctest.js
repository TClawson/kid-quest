// Settings › Test tools › NFC token test (behind the parent PIN): a page for learning how a phone
// reads the NFC stickers inside the chore tokens, before the tokens do anything in the game. It
// shows every reading live (the tag's serial number, its records, the time, how many times that
// tag was read and how long since the last read), keeps a short log that also holds read errors
// and the app being put away or coming back, can keep the screen awake, and can write the app's
// own address onto a tag.
//
// Web NFC (NDEFReader) works only in Chrome on Android, on a phone with NFC, with the page
// showing. Other devices get a plain "can't read tokens here" note.
//
// Nothing here reads or writes the kids' or the family's data: no app state, no family sync, no
// storage. Readings live only in this module and are gone when the page closes.
//
// app.js draws the screen with an empty #nfc-test; mountNfcTest() fills it after each redraw,
// and stops scanning (and lets the screen sleep) when the page is gone.

import { esc } from './ctx.js';
import { sounds } from './fx.js';

const LOG_MAX = 30;

const N = {
  scanning: false,
  starting: false,
  abort: null,        // AbortController for the scan
  reader: null,
  perm: '',           // 'granted' | 'prompt' | 'denied' | '' (unknown)
  permWatch: null,
  error: '',
  last: null,         // the latest reading, as shown in the big box
  tags: new Map(),    // serial -> { count, at }
  lastAt: 0,          // time of the latest reading of any tag
  reads: 0,
  log: [],            // newest first: { at, kind, text }
  wake: null,         // WakeLockSentinel
  wantWake: false,
  writing: null,      // AbortController while waiting for a tag to write
  autoTried: false,
};

/** Can this browser read NFC tags at all? */
export function nfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/** The app's own address (where it is installed from), for writing onto a tag. */
export function appAddress() {
  return new URL('./', location.href).href;
}

/** The test page's screen. The live parts are filled in by mountNfcTest(). */
export function viewNfc() {
  return `
    <div class="screen nfc">
      <header class="top row">
        <button class="btn ghost round" data-action="nfc-back" aria-label="Back">←</button>
        <h1 class="grow">NFC token test</h1>
      </header>
      <div id="nfc-test"></div>
    </div>`;
}

/** For tests: what the page is doing. */
export function nfcTestState() {
  return { supported: nfcSupported(), scanning: N.scanning, reads: N.reads, tags: N.tags.size, wake: Boolean(N.wake), log: N.log.length };
}

export function mountNfcTest(root) {
  const el = root.querySelector('#nfc-test');
  if (!el) { leave(); return; }
  if (!el.dataset.live) {
    el.dataset.live = '1';
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
  }
  paint();
  if (nfcSupported() && !N.autoTried) {
    N.autoTried = true;
    watchPermission();
  }
}

/** The parent left the page: stop reading, let the screen sleep, forget the readings. */
function leave() {
  if (!N.scanning && !N.starting && !N.wake && !N.writing && !N.log.length && !N.autoTried) return;
  stopScan();
  cancelWrite();
  N.wantWake = false;
  releaseWake();
  N.permWatch = null;
  N.autoTried = false;
  N.error = '';
  N.last = null;
  N.tags = new Map();
  N.lastAt = 0;
  N.reads = 0;
  N.log = [];
}

function root() { return document.getElementById('nfc-test'); }

// ---------- the log ----------

function clock(at) {
  const d = new Date(at);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function gap(ms) {
  if (ms == null) return 'first read';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60000);
  return `${m} min ${Math.round((ms % 60000) / 1000)} s`;
}

function log(kind, text) {
  N.log.unshift({ at: Date.now(), kind, text });
  if (N.log.length > LOG_MAX) N.log.length = LOG_MAX;
  paintLog();
}

// ---------- permission and scanning ----------

async function watchPermission() {
  try {
    const st = await navigator.permissions.query({ name: 'nfc' });
    N.permWatch = st;
    N.perm = st.state;
    st.onchange = () => {
      if (N.permWatch !== st) return;
      N.perm = st.state;
      log('info', `NFC permission is now: ${st.state}`);
      paint();
    };
    paint();
    // already allowed: start reading straight away, no tap needed
    if (st.state === 'granted' && !N.scanning) startScan();
  } catch {
    N.perm = '';
    paint();
  }
}

async function startScan() {
  if (N.scanning || N.starting || !nfcSupported()) return;
  N.starting = true;
  N.error = '';
  paint();
  const abort = new AbortController();
  try {
    const reader = new window.NDEFReader();
    reader.onreading = onReading;
    reader.onreadingerror = () => {
      log('error', 'A tag was near, but it couldn\'t be read (moved away too fast, or not an NDEF tag).');
    };
    await reader.scan({ signal: abort.signal });
    N.reader = reader;
    N.abort = abort;
    N.scanning = true;
    if (N.perm !== 'granted') N.perm = 'granted';
    log('info', 'Started reading. Hold a token to the back of the phone.');
  } catch (e) {
    abort.abort();
    N.error = scanError(e);
    log('error', N.error);
    if (e?.name === 'NotAllowedError') N.perm = 'denied';
  }
  N.starting = false;
  paint();
}

function scanError(e) {
  if (e?.name === 'NotAllowedError') return 'NFC isn\'t allowed for this app. Allow NFC in Chrome\'s site settings (the lock or ⓘ next to the address), then tap Start again.';
  if (e?.name === 'NotSupportedError') return 'This phone can\'t read NFC, or NFC is turned off. Turn on NFC in Android\'s settings (Connected devices › Connection preferences › NFC), then tap Start again.';
  return `Couldn't start reading: ${e?.message || e}`;
}

function stopScan() {
  if (N.abort) N.abort.abort();
  const was = N.scanning;
  N.abort = null;
  N.reader = null;
  N.scanning = false;
  if (was) log('info', 'Stopped reading.');
}

/** What's in one NDEF record, in a few words. */
export function describeRecord(r) {
  const type = r.recordType || '?';
  const bytes = r.data ? r.data.byteLength : 0;
  const decode = (enc = 'utf-8') => {
    try { return new TextDecoder(enc).decode(r.data); } catch { return ''; }
  };
  if (type === 'text') return { type, text: decode(r.encoding || 'utf-8'), extra: r.lang ? `language ${r.lang}` : '' };
  if (type === 'url' || type === 'absolute-url') return { type, text: decode(), extra: '' };
  if (type === 'mime') {
    const mt = r.mediaType || '';
    const readable = /^text\/|json|xml/.test(mt);
    return { type, text: readable ? decode() : '', extra: `${mt || 'no media type'}, ${bytes} bytes` };
  }
  if (type === 'smart-poster') {
    let inner = [];
    try { inner = (r.toRecords?.() || []).map(describeRecord); } catch { /* not readable */ }
    return { type, text: inner.map((x) => x.text).filter(Boolean).join(' · '), extra: `${inner.length} records inside` };
  }
  if (type === 'empty') return { type, text: '', extra: 'empty record' };
  return { type, text: '', extra: `${bytes} bytes` };
}

function onReading(ev) {
  const at = Date.now();
  const serial = ev.serialNumber || '(no serial number)';
  const tag = N.tags.get(serial) || { count: 0, at: 0 };
  const sinceThis = tag.count ? at - tag.at : null;
  const sinceAny = N.lastAt ? at - N.lastAt : null;
  tag.count += 1;
  tag.at = at;
  N.tags.set(serial, tag);
  N.lastAt = at;
  N.reads += 1;
  const recs = [...(ev.message?.records || [])].map(describeRecord);
  N.last = { at, serial, count: tag.count, sinceThis, sinceAny, recs };
  sounds.catch();
  const what = recs.length ? recs.map((r) => r.text ? `${r.type}: ${r.text}` : r.type).join(', ') : 'no records (blank tag)';
  log('read', `${serial} · read #${tag.count} · ${sinceThis == null ? 'first read of this tag' : `${gap(sinceThis)} since this tag`} · ${what}`);
  paint();
}

// ---------- keeping the screen awake ----------

async function takeWake() {
  if (!N.wantWake || N.wake || document.visibilityState !== 'visible') return;
  try {
    const s = await navigator.wakeLock.request('screen');
    if (!N.wantWake) { s.release(); return; }
    N.wake = s;
    s.addEventListener('release', () => {
      if (N.wake === s) N.wake = null;
      log('info', 'The screen may sleep again.');
      paint();
    });
    log('info', 'The screen will stay awake.');
  } catch (e) {
    log('error', `Couldn't keep the screen awake: ${e?.message || e}`);
  }
  paint();
}

function releaseWake() {
  const s = N.wake;
  N.wake = null;
  if (s) s.release().catch(() => {});
}

// ---------- writing the app's address ----------

async function writeAddress() {
  if (N.writing || !nfcSupported()) return;
  const abort = new AbortController();
  N.writing = abort;
  const url = appAddress();
  log('info', `Waiting for a tag to write ${url} onto…`);
  paint();
  try {
    const writer = N.reader || new window.NDEFReader();
    await writer.write({ records: [{ recordType: 'url', data: url }] }, { signal: abort.signal, overwrite: true });
    log('write', `Wrote ${url} onto the tag.`);
    sounds.task();
  } catch (e) {
    if (e?.name === 'AbortError') log('info', 'Writing cancelled.');
    else log('error', `Couldn't write the tag: ${e?.message || e}`);
  }
  if (N.writing === abort) N.writing = null;
  paint();
}

function cancelWrite() {
  if (N.writing) N.writing.abort();
  N.writing = null;
}

// ---------- events ----------

function onClick(e) {
  const b = e.target.closest('[data-nfc]');
  if (!b) return;
  const what = b.dataset.nfc;
  if (what === 'start') startScan();
  else if (what === 'stop') { stopScan(); paint(); }
  else if (what === 'write') writeAddress();
  else if (what === 'cancel-write') { cancelWrite(); paint(); }
  else if (what === 'clear') {
    N.tags = new Map(); N.last = null; N.lastAt = 0; N.reads = 0; N.log = [];
    paint();
  }
}

function onChange(e) {
  if (e.target.matches('[data-nfc-wake]')) {
    N.wantWake = e.target.checked;
    if (N.wantWake) takeWake();
    else { releaseWake(); paint(); }
  }
}

globalThis.document?.addEventListener('visibilitychange', () => {
  if (!root()) return;
  const v = document.visibilityState;
  log('info', v === 'visible' ? 'The app is showing again.' : 'The app was put away (screen off, or another app).');
  // Chrome drops a screen wake lock when the page hides; take it again when it comes back
  if (v === 'visible') takeWake();
});

// ---------- drawing ----------

const PERM_TEXT = { granted: 'allowed', prompt: 'not asked yet (Start will ask)', denied: 'blocked' };

function paint() {
  const el = root();
  if (!el) return;
  if (!nfcSupported()) {
    el.innerHTML = `
      <div class="card nfc-none" data-nfc-state="unsupported">
        <h2>This device can't read tokens</h2>
        <p>Reading NFC tokens works only in <b>Chrome on an Android phone or tablet that has NFC</b>. Open the app in Chrome on the phone that will read the tokens and come back here.</p>
        <p class="muted small">iPhones, computers, and Android devices without NFC can't read tokens from a web app.</p>
      </div>
      ${tipsHtml()}`;
    return;
  }
  const wakeOk = 'wakeLock' in navigator;
  el.innerHTML = `
    <div class="card nfc-status" data-nfc-state="${N.scanning ? 'scanning' : 'idle'}">
      <div class="row wrap nfc-top">
        <b class="grow nfc-on">${N.scanning ? '📡 Reading: hold a token to the phone' : N.starting ? 'Starting…' : 'Not reading'}</b>
        <span class="muted small">NFC permission: <b data-nfc-perm>${esc(PERM_TEXT[N.perm] || 'unknown')}</b></span>
      </div>
      <div class="row wrap">
        ${N.scanning
    ? '<button class="btn ghost" data-nfc="stop">Stop reading</button>'
    : `<button class="btn huge" data-nfc="start" ${N.starting ? 'disabled' : ''}>Start reading</button>`}
      </div>
      ${N.error ? `<p class="listen-error">${esc(N.error)}</p>` : ''}
      <label class="row nfc-wake"><input type="checkbox" data-nfc-wake ${N.wantWake ? 'checked' : ''} ${wakeOk ? '' : 'disabled'}> Keep screen awake ${wakeOk ? `<span class="muted small">${N.wake ? '(awake)' : N.wantWake ? '(waiting)' : ''}</span>` : '<span class="muted small">(not on this device)</span>'}</label>
    </div>
    <div class="card nfc-last">
      ${lastHtml()}
      <p class="muted small">${N.reads} reads · ${N.tags.size} different tags</p>
    </div>
    <div class="card nfc-log-card">
      <div class="row"><h2 class="grow">Log</h2><button class="btn ghost" data-nfc="clear">Clear</button></div>
      <ol class="nfc-log" id="nfc-log">${logHtml()}</ol>
    </div>
    <div class="card nfc-write">
      <h2>Write the app's address to a tag</h2>
      <p class="muted small">Puts <b>${esc(appAddress())}</b> on a tag as a link, replacing what's on it. Tap, then hold a tag to the phone.</p>
      ${N.writing
    ? '<p><b>Hold a tag to the phone now…</b></p><button class="btn ghost" data-nfc="cancel-write">Cancel</button>'
    : '<button class="btn ghost" data-nfc="write">Write to a tag</button>'}
    </div>
    ${tipsHtml()}`;
}

function lastHtml() {
  const r = N.last;
  if (!r) return '<p class="muted">No reading yet.</p>';
  return `
    <div class="nfc-reading">
      <div class="listen-row"><span>Tag</span><b class="nfc-serial">${esc(r.serial)}</b></div>
      <div class="listen-row"><span>Time</span><b>${clock(r.at)}</b></div>
      <div class="listen-row"><span>Reads of this tag</span><b>${r.count}</b></div>
      <div class="listen-row"><span>Since this tag's last read</span><b>${gap(r.sinceThis)}</b></div>
      <div class="listen-row"><span>Since the last read</span><b>${gap(r.sinceAny)}</b></div>
      <div class="listen-row"><span>Records</span><b>${r.recs.length || 'none (blank tag)'}</b></div>
      ${r.recs.map((x) => `<div class="listen-row"><span>${esc(x.type)}</span><b class="nfc-text">${esc(x.text || x.extra || '–')}</b></div>`).join('')}
    </div>`;
}

function logHtml() {
  if (!N.log.length) return '<li class="muted">Nothing yet.</li>';
  return N.log.map((l) => `<li class="nfc-${l.kind}"><time>${clock(l.at)}</time> ${esc(l.text)}</li>`).join('');
}

function paintLog() {
  const ol = document.getElementById('nfc-log');
  if (ol) ol.innerHTML = logHtml();
}

function tipsHtml() {
  return `
    <div class="card">
      <h2>Things to try</h2>
      <ol class="small listen-tries">
        <li>Find the antenna: slide a bare tag slowly over the back of the phone and note where it beeps.</li>
        <li>How far: hold a finished token over that spot, sticker side out, and lift it away until it stops reading.</li>
        <li>Slide a token past the spot quickly, as a kid would drop it in, and see if it still reads (and how many times).</li>
        <li>Hold two tokens at once, stacked and side by side.</li>
        <li>Try the screen side of the phone too.</li>
        <li>Let the screen sleep, wake it, and see if reading carries on. Then turn on “Keep screen awake” and wait a few minutes.</li>
        <li>Restart the phone, open the app, come back here, and see if it starts reading without a tap.</li>
      </ol>
      <p class="muted small">Nothing is saved, and the kids' and family's data are not touched. Reading stops when you leave this page.</p>
    </div>`;
}
