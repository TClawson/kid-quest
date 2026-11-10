// Family sync: connecting to the cloud, applying the family's updates, and the
// settings card with its start / join / invite / leave flows (split out of
// app.js; shared things come from ctx.js).
import { stableJson, DEVICE_SETTINGS } from './store.js';
import { timerOnScreen } from './timer-ui.js';
import {
  state, setState, ui, $modal, esc, kidById, toast, render, actions,
  openModal, closeModal, confirmModal,
  cloud, cloudCfg, family, store, CLOUD_KEY, CLOUD_CACHE_KEY, BUDDIES_KEY,
} from './ctx.js';

// ---------- family sync ----------

// A family update held back while a dialog is open (see applyRemote, closeModal and save in app.js).
export let pendingRemote = null;
export function setPendingRemote(next) { pendingRemote = next; }

// One shared load: the settings screen, a join and startup may all ask at once.
let cloudLoading = null;
export function loadCloud() {
  cloudLoading ||= import('./cloud.js')
    .then(async (mod) => { await mod.connect(); cloud.mod = mod; return mod; })
    .catch((err) => { cloudLoading = null; throw err; });
  return cloudLoading;
}

export function onCloudStatus({ pending, error }) {
  const before = `${cloud.pending}|${cloud.error}`;
  if (pending !== undefined) cloud.pending = pending;
  if (error !== undefined) cloud.error = error;
  if (`${cloud.pending}|${cloud.error}` !== before && ui.view === 'parent' && ui.tab === 'settings') render();
}

export async function startCloud() {
  let mod;
  try {
    mod = await loadCloud();
  } catch (err) {
    console.error(err);
    onCloudStatus({ error: 'Could not load sync. It will try again next time the app opens.' });
    return;
  }
  if (!mod.currentUser()) {
    cloud.signedOut = true;
    render();
    return;
  }
  if (cloud.queued) {
    const { before, after } = cloud.queued;
    cloud.queued = null;
    mod.writeChanges(cloudCfg.familyId, mod.changesBetween(before, after), before, after, onCloudStatus);
  }
  cloud.ready = true;
  mod.startSync(cloudCfg, { onState: applyRemote, onStatus: onCloudStatus });
  if (cloudCfg.role === 'kid') {
    mod.watchBuddies(cloudCfg.familyId, (list) => {
      if (stableJson(list) === stableJson(family.buddies)) return;
      family.buddies = list;
      try { localStorage.setItem(BUDDIES_KEY, JSON.stringify(list)); } catch { /* only a cache */ }
      if (ui.view === 'kid' && $modal.hidden) render();
    });
  }
}

// A newer state from the family (another device, or this one's writes coming back).
export function applyRemote(next) {
  cloud.gotState = true;
  for (const k of DEVICE_SETTINGS) {
    if (k in state.settings) next.settings[k] = state.settings[k];
    else delete next.settings[k];
  }
  if (stableJson(next) === stableJson(state)) return;
  // don't swap the data under an open dialog; apply it when the dialog closes
  if (!$modal.hidden) { pendingRemote = next; return; }
  setState(next);
  store.replace(state);
  if (ui.view === 'setup' && state.settings.pinHash) ui.view = 'home';
  if (!timerOnScreen()) render();
}

export function familyCard() {
  if (!cloudCfg) {
    return `
    <div class="card">
      <h2>Family sync</h2>
      <p class="muted small">Keep progress safe in the cloud and share it between each kid's tablet and the parents' phones. Start the family on a parent's phone, then join each kid's tablet with a code.</p>
      <div class="row wrap">
        <button class="btn" data-action="family-create">Start a family</button>
        <button class="btn ghost" data-action="family-join">Join with a code</button>
      </div>
    </div>`;
  }
  const who = cloudCfg.role === 'kid' ? `${esc(kidById(cloudCfg.kidId)?.name || 'A kid')}'s device` : `a parent (${esc(cloudCfg.email || 'signed in')})`;
  const status = cloud.signedOut ? '⚠️ This device was signed out of the family. Stop syncing, then join again with a new code.'
    : cloud.error ? `⚠️ Sync problem: ${esc(cloud.error)}`
      : cloud.pending ? `⏳ ${navigator.onLine ? 'Saving to the cloud…' : 'Offline. Changes are kept here and will sync when back online.'}`
        : '✅ Synced';
  return `
    <div class="card">
      <h2>Family sync</h2>
      <p class="small">This device syncs with your family as ${who}.</p>
      <p class="muted small">${status}</p>
      ${cloudCfg.role === 'parent' ? `
      <div class="row wrap">
        <button class="btn" data-action="family-invite-kid">Add a kid's device</button>
        <button class="btn ghost" data-action="family-invite-parent">Add a parent</button>
      </div>` : ''}
      <button class="btn ghost" data-action="family-leave">Stop syncing on this device</button>
    </div>`;
}

// A plain reason for a Firebase error, plus its code so a parent can pass it on.
function cloudProblem(err, fallback) {
  const code = err?.code || '';
  const why = code === 'permission-denied' ? 'The family database turned this down. The Firestore security rules may not be published yet (Firebase console › Firestore › Rules).'
    : code === 'unavailable' || !navigator.onLine ? 'Could not reach the cloud. Check the Wi-Fi and try again.'
      : code.startsWith('auth/') ? 'Google sign-in did not finish. Check that Google sign-in is turned on and this site is an authorized domain in Firebase.'
        : fallback;
  return code ? `${why} (${code})` : why;
}

function busyModal(text) {
  openModal(`<div data-sticky class="celebrate"><h2>${esc(text)}</h2><p class="muted">Keep the app open.</p></div>`);
}

function errorModal(title, text) {
  openModal(`
    <div class="celebrate">
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <button class="btn" data-action="modal-close">OK</button>
    </div>`);
}

// Switch this device to the family and restart the app on the cloud copy.
function finishJoin(cfg, cacheState) {
  localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg));
  if (cacheState) localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify(cacheState));
  else localStorage.removeItem(CLOUD_CACHE_KEY);
  window.location.reload();
}

export async function familyCreate() {
  if (!navigator.onLine) { errorModal('You are offline', 'Connect to Wi-Fi to start a family.'); return; }
  let mod;
  let user;
  try {
    mod = await loadCloud();
    user = await mod.signInParent();
  } catch (err) {
    console.error(err);
    errorModal('Sign-in did not finish', `Try again. If no Google window appears, allow pop-ups for this site.${err?.code ? ` (${err.code})` : ''}`);
    return;
  }
  try {
    busyModal('Checking your account…');
    const existing = await mod.findFamily();
    closeModal();
    if (existing) {
      confirmModal({
        title: 'You already have a family',
        text: `${user.email} is already in a family. Connect this device to it as a parent? This device's own data stays saved here and is not uploaded.`,
        yes: 'Connect',
        onYes: () => finishJoin({ ...existing, email: user.email }, null),
      });
      return;
    }
    confirmModal({
      title: 'Start a family?',
      text: `This uploads this device's settings, parent PIN${state.kids.length ? ` and ${state.kids.map((k) => k.name).join(', ')}` : ''} to your family's cloud, signed in as ${user.email}. A backup file is saved first.`,
      yes: 'Start family',
      onYes: async () => {
        actions.export();
        busyModal('Uploading…');
        try {
          const cfg = await mod.createFamily(state);
          finishJoin({ ...cfg, email: user.email }, state);
        } catch (err) {
          console.error(err);
          closeModal();
          if (err?.code === 'permission-denied') {
            errorModal('This account can’t start a family', `Only Google accounts on the family’s allowed list can start a family. If you are already in a family, ask a parent for a code instead. (${user.email})`);
          } else {
            errorModal('That did not work', `Nothing changed on this device. ${cloudProblem(err, 'Try again in a moment.')}`);
          }
        }
      },
    });
  } catch (err) {
    console.error(err);
    closeModal();
    errorModal('That did not work', cloudProblem(err, 'Check the connection and try again.'));
  }
}

export function familyJoin() {
  openModal(`
    <div class="celebrate">
      <h2>Join your family</h2>
      <p class="muted">On a parent's device, open Parents › Settings › Family sync and tap "Add a kid's device" or "Add a parent" to get a code.</p>
      <input class="code-input" data-join-code autocomplete="off" autocapitalize="characters" placeholder="Code" maxlength="12">
      <div class="stack">
        <button class="btn huge" data-action="family-join-go">Join</button>
        <button class="btn ghost" data-action="modal-close">Cancel</button>
      </div>
    </div>`);
  loadCloud().catch(() => {});
  setTimeout(() => $modal.querySelector('[data-join-code]')?.focus(), 50);
}

export async function familyJoinGo() {
  const input = $modal.querySelector('[data-join-code]');
  let mod;
  try { mod = await loadCloud(); } catch { errorModal('You are offline', 'Connect to Wi-Fi and try again.'); return; }
  const code = mod.normalizeCode(input?.value);
  const role = mod.codeRole(code);
  if (!role || code.length < 6) { toast('That code doesn’t look right. Check it and try again.'); return; }
  if (role === 'kid' && state.kids.length > 1) {
    errorModal('More than one kid here', 'A kid’s device should hold just that kid. Use this device as a parent instead, or remove the extra kids first.');
    return;
  }
  let user;
  try {
    user = role === 'parent' ? await mod.signInParent() : await mod.signInDevice();
  } catch (err) {
    console.error(err);
    errorModal('Sign-in did not finish', `Try again. If no Google window appears, allow pop-ups for this site.${err?.code ? ` (${err.code})` : ''}`);
    return;
  }
  if (role === 'kid' && state.kids.length) actions.export();
  busyModal(role === 'kid' && state.kids.length ? `Uploading ${state.kids[0].name}'s progress…` : 'Joining…');
  try {
    const cfg = await mod.joinFamily(code, state);
    finishJoin({ ...cfg, email: role === 'parent' ? user.email : null }, role === 'kid' && state.kids.length ? state : null);
  } catch (err) {
    console.error(err);
    closeModal();
    const msg = err.code === 'bad-code' ? 'That code is wrong or has expired. Ask for a new one.'
      : err.code === 'which-kid' ? err.message
        : err.code === 'check-failed' ? 'The upload did not check out, so this device keeps using its own copy. Try again later.'
          : `Nothing changed on this device. ${cloudProblem(err, 'Check the connection and try again.')}`;
    errorModal('Could not join', msg);
  }
}

export async function familyInvite(role) {
  let kidId = null;
  if (role === 'kid') {
    openModal(`
      <div class="celebrate">
        <h2>Add a kid's device</h2>
        <p class="muted">Whose device is it?</p>
        <div class="stack">
          <button class="btn" data-action="family-invite-for" data-kid="">A kid whose progress is on that device</button>
          ${state.kids.map((k) => `<button class="btn ghost" data-action="family-invite-for" data-kid="${k.id}">${esc(k.name)} (already in the family)</button>`).join('')}
          <button class="btn ghost" data-action="modal-close">Cancel</button>
        </div>
      </div>`);
    return;
  }
  showCode(role, kidId);
}

export async function showCode(role, kidId) {
  busyModal('Making a code…');
  try {
    const mod = await loadCloud();
    const code = await mod.makeJoinCode(cloudCfg.familyId, role, kidId);
    const pretty = `${code.slice(0, 4)}-${code.slice(4)}`;
    closeModal();
    openModal(`
      <div class="celebrate">
        <h2>Join code</h2>
        <p class="join-code">${pretty}</p>
        <p class="muted">${role === 'parent'
    ? 'On the other parent’s phone, open Kid Quest, tap "Join your family with a code" (or Parents › Settings › Family sync), enter this code, and sign in with Google.'
    : 'On the kid’s device, open Kid Quest, go to Parents › Settings › Family sync, tap "Join with a code" and enter this code.'} It works for 30 minutes.</p>
        <button class="btn" data-action="modal-close">Done</button>
      </div>`);
  } catch (err) {
    console.error(err);
    closeModal();
    errorModal('Could not make a code', cloudProblem(err, 'Try again in a moment.'));
  }
}

export function familyLeave() {
  confirmModal({
    title: 'Stop syncing on this device?',
    text: 'This device goes back to the copy it had before joining. Everything stays safe in the family cloud, and you can join again with a new code.',
    yes: 'Stop syncing', danger: true,
    onYes: async () => {
      try {
        const mod = await loadCloud();
        mod.stopSync();
        await mod.signOutDevice();
      } catch { /* offline: still leave */ }
      localStorage.removeItem(CLOUD_KEY);
      localStorage.removeItem(CLOUD_CACHE_KEY);
      window.location.reload();
    },
  });
}

