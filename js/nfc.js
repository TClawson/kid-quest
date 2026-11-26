// A small Web NFC reader for the buddy station (js/station.js) and the token links in Parents ›
// Settings › Buddy station. It starts and stops scanning, watches the NFC permission, and reports
// each tag's serial number to one listener. The NFC token test page (js/nfctest.js) keeps its own
// reader on purpose: its smoke test pins what it imports.
//
// Web NFC (NDEFReader) works only in Chrome on Android, on a phone with NFC, with the page
// showing and the screen on and unlocked.
//
// One scan at a time: start() with a new listener hands the running scan to that listener.

const R = {
  abort: null,      // AbortController of the running scan
  scanning: false,
  starting: null,   // the start() promise while it runs
  listener: null,   // (serial, at) => void
  perm: '',         // 'granted' | 'prompt' | 'denied' | '' (unknown)
  error: '',
  watchers: new Set(), // () => void, told when anything above changes
};

/** Can this browser read NFC tags at all? */
export function nfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/** What the reader is doing: { supported, scanning, starting, perm, error }. */
export function nfcState() {
  return { supported: nfcSupported(), scanning: R.scanning, starting: Boolean(R.starting), perm: R.perm, error: R.error };
}

/** Be told when the reader's state changes (scanning, permission, an error). Returns a function that stops telling. */
export function onNfcChange(fn) {
  R.watchers.add(fn);
  return () => R.watchers.delete(fn);
}

function changed() {
  for (const fn of [...R.watchers]) {
    try { fn(); } catch { /* a watcher's own trouble */ }
  }
}

/** The NFC permission, asked of the browser once ('granted', 'prompt', 'denied', or '' when it can't say). Watches for changes. */
export async function nfcPermission() {
  if (!nfcSupported()) return '';
  try {
    const st = await navigator.permissions.query({ name: 'nfc' });
    R.perm = st.state;
    st.onchange = () => { R.perm = st.state; changed(); };
  } catch {
    R.perm = '';
  }
  changed();
  return R.perm;
}

/**
 * Start reading, sending each tag's serial number to listener(serial, at). Already reading: the
 * listener takes over. Without NFC permission this asks (it must come from a tap then). Resolves
 * to whether it is reading; a failure is in nfcState().error.
 */
export async function startNfc(listener) {
  R.listener = listener;
  if (R.scanning) return true;
  if (R.starting) return R.starting;
  if (!nfcSupported()) return false;
  R.error = '';
  R.starting = (async () => {
    const abort = new AbortController();
    try {
      const reader = new window.NDEFReader();
      reader.onreading = (ev) => {
        if (R.abort !== abort) return;
        const serial = ev.serialNumber || '';
        if (serial) R.listener?.(serial, Date.now());
      };
      reader.onreadingerror = () => {};
      await reader.scan({ signal: abort.signal });
      R.abort = abort;
      R.scanning = true;
      R.perm = 'granted';
      return true;
    } catch (e) {
      abort.abort();
      R.error = nfcError(e);
      if (e?.name === 'NotAllowedError') R.perm = 'denied';
      return false;
    } finally {
      R.starting = null;
      changed();
    }
  })();
  changed();
  return R.starting;
}

/** Start reading only if NFC is already allowed (no tap needed then). Resolves to whether it is reading. */
export async function startNfcIfAllowed(listener) {
  R.listener = listener;
  if (R.scanning) return true;
  const perm = await nfcPermission();
  return perm === 'granted' ? startNfc(listener) : false;
}

/** Stop reading (and forget the listener). */
export function stopNfc() {
  R.abort?.abort();
  const was = R.scanning;
  R.abort = null;
  R.scanning = false;
  R.listener = null;
  if (was) changed();
}

/** A failed start, in words a parent can act on. */
export function nfcError(e) {
  if (e?.name === 'NotAllowedError') return 'NFC isn\'t allowed for this app. Allow NFC in Chrome\'s site settings (the lock or ⓘ next to the address), then tap Start again.';
  if (e?.name === 'NotSupportedError') return 'This phone can\'t read NFC, or NFC is turned off. Turn on NFC in Android\'s settings (Connected devices › Connection preferences › NFC), then try again.';
  return `Couldn't start reading: ${e?.message || e}`;
}
