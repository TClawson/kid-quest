// Family cloud sync on Firebase. Loaded only when a device joins or uses a
// family, so the app works the same as before for anyone who never does.
//
// Firestore layout (see firestore.rules):
//   families/{fid}                  settings, version, createdBy
//   families/{fid}/members/{uid}    role 'parent' | 'kid', kidId for a kid's device
//   families/{fid}/kids/{kidId}     one kid: buddy, tasks, items, coins spent
//   families/{fid}/days/{date_kid}  one kid's day: { date, kidId, entry }
//   users/{uid}                     { familyId }, so a parent's new phone finds the family
//   joinCodes/{code}                { familyId, role, kidId?, expiresAt }

import { firebaseConfig } from './firebase-config.js';
import { splitState, joinState, diffFields, diffDocs, docAt, stableJson, DELETE } from './store.js';

let fb = null;
let auth = null;
let db = null;

const EMULATOR = (() => { try { return localStorage.getItem('kidquest.emulator') === '1'; } catch { return false; } })();
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_MINUTES = 30;
const BATCH_LIMIT = 400;

// Safe to call from several places at once: they all share one connection.
let connecting = null;
export function connect() {
  connecting ||= (async () => {
    fb = await import('./vendor/firebase.js');
    const config = EMULATOR ? { ...firebaseConfig, projectId: 'demo-kid-quest', apiKey: 'demo-key' } : firebaseConfig;
    const app = fb.initializeApp(config);
    auth = fb.initializeAuth(app, { persistence: fb.indexedDBLocalPersistence, popupRedirectResolver: fb.browserPopupRedirectResolver });
    db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) });
    if (EMULATOR) {
      fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fb.connectFirestoreEmulator(db, '127.0.0.1', 8180);
    }
    await auth.authStateReady();
  })().catch((err) => { connecting = null; throw err; });
  return connecting;
}

export const currentUser = () => auth?.currentUser || null;

// ---------- sign-in ----------

// Parents sign in with Google. Call straight from a tap: browsers block
// sign-in popups that don't follow one.
export async function signInParent() {
  await connect();
  const user = currentUser();
  if (user && !user.isAnonymous) return user;
  if (EMULATOR && window.__kidQuestTestEmail) {
    const email = window.__kidQuestTestEmail;
    const cred = fb.GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true }));
    return (await fb.signInWithCredential(auth, cred)).user;
  }
  return (await fb.signInWithPopup(auth, new fb.GoogleAuthProvider())).user;
}

// A kid's device signs in without an account; the join code is what lets it in.
export async function signInDevice() {
  await connect();
  return currentUser() || (await fb.signInAnonymously(auth)).user;
}

export async function signOutDevice() {
  await connect();
  await fb.signOut(auth);
}

// ---------- paths ----------

const familyRef = (fid) => fb.doc(db, 'families', fid);
const memberRef = (fid, uid) => fb.doc(db, 'families', fid, 'members', uid);
const kidsCol = (fid) => fb.collection(db, 'families', fid, 'kids');
const daysCol = (fid) => fb.collection(db, 'families', fid, 'days');

function refFor(fid, path) {
  if (path === 'family') return familyRef(fid);
  const [kind, id] = path.split('/');
  return fb.doc(db, 'families', fid, kind, id);
}

// Firestore refuses undefined values; JSON drops them.
const clean = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ---------- families ----------

// The family this signed-in person already belongs to, if any.
export async function findFamily() {
  const user = currentUser();
  if (!user) return null;
  const u = await fb.getDocFromServer(fb.doc(db, 'users', user.uid));
  const familyId = u.exists() ? u.data().familyId : null;
  if (!familyId) return null;
  const m = await fb.getDocFromServer(memberRef(familyId, user.uid));
  return m.exists() ? { familyId, role: m.data().role, kidId: m.data().kidId || null } : null;
}

// Start a family from this device's data. The signed-in parent becomes its first member.
export async function createFamily(state) {
  const user = currentUser();
  const parts = splitState(state);
  const fid = fb.doc(fb.collection(db, 'families')).id;
  const batch = fb.writeBatch(db);
  batch.set(familyRef(fid), { ...clean(parts.family), createdBy: user.uid, createdAt: fb.Timestamp.now() });
  batch.set(memberRef(fid, user.uid), { role: 'parent', name: user.displayName || user.email || 'Parent', joinedAt: fb.Timestamp.now() });
  batch.set(fb.doc(db, 'users', user.uid), { familyId: fid });
  await batch.commit();
  const kidIds = Object.keys(parts.kids);
  await upload(fid, parts, kidIds);
  await verify(fid, parts, kidIds);
  return { familyId: fid, role: 'parent', kidId: null };
}

export function codeRole(code) {
  return code[0] === 'P' ? 'parent' : code[0] === 'K' ? 'kid' : null;
}

export function normalizeCode(text) {
  return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function makeJoinCode(fid, role, kidId = null) {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const code = (role === 'parent' ? 'P' : 'K') + [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  await fb.writeBatch(db).set(fb.doc(db, 'joinCodes', code), {
    familyId: fid, role, kidId: kidId || null, createdBy: currentUser().uid,
    expiresAt: fb.Timestamp.fromMillis(Date.now() + CODE_MINUTES * 60000),
  }).commit();
  return code;
}

async function lookupCode(code) {
  const snap = await fb.getDocFromServer(fb.doc(db, 'joinCodes', code));
  if (!snap.exists()) return null;
  const c = snap.data();
  return c.expiresAt.toMillis() > Date.now() ? c : null;
}

// Join a family with a code. On a kid's device this device's one kid (and all
// their days) is uploaded, unless the family already has that kid.
// Throws Error with .code: 'bad-code' | 'which-kid' | 'check-failed'.
export async function joinFamily(code, state) {
  const user = currentUser();
  const c = await lookupCode(code);
  if (!c) throw Object.assign(new Error('That code is wrong or has expired.'), { code: 'bad-code' });
  const fid = c.familyId;
  let kidId = null;
  if (c.role === 'kid') {
    if (state.kids.length === 1) kidId = state.kids[0].id;
    else if (!state.kids.length && c.kidId) kidId = c.kidId;
    else throw Object.assign(new Error('This device needs exactly one kid to join as a kid’s device.'), { code: 'which-kid' });
  }
  const batch = fb.writeBatch(db);
  batch.set(memberRef(fid, user.uid), {
    role: c.role, code, kidId, joinedAt: fb.Timestamp.now(),
    name: c.role === 'parent' ? (user.displayName || user.email || 'Parent') : (state.kids[0]?.name || 'Kid'),
  });
  batch.set(fb.doc(db, 'users', user.uid), { familyId: fid });
  await batch.commit();
  if (c.role === 'kid' && state.kids.length) {
    const already = await fb.getDocFromServer(fb.doc(kidsCol(fid), kidId));
    if (!already.exists()) {
      const parts = splitState(state);
      await upload(fid, parts, [kidId]);
      await verify(fid, parts, [kidId]);
    }
  }
  return { familyId: fid, role: c.role, kidId };
}

// Write these kids and all their days, a few hundred documents per batch.
async function upload(fid, parts, kidIds) {
  const ops = [];
  for (const id of kidIds) ops.push([fb.doc(kidsCol(fid), id), parts.kids[id]]);
  for (const [id, day] of Object.entries(parts.days)) {
    if (kidIds.includes(day.kidId)) ops.push([fb.doc(daysCol(fid), id), day]);
  }
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = fb.writeBatch(db);
    for (const [ref, data] of ops.slice(i, i + BATCH_LIMIT)) batch.set(ref, clean(data));
    await batch.commit();
  }
}

// Read the uploaded kids and days back from the server and compare them with
// what this device holds. Throws if anything differs.
async function verify(fid, parts, kidIds) {
  for (const id of kidIds) {
    const kid = await fb.getDocFromServer(fb.doc(kidsCol(fid), id));
    if (!kid.exists() || stableJson(kid.data()) !== stableJson(clean(parts.kids[id]))) {
      throw Object.assign(new Error('The cloud copy did not match this device.'), { code: 'check-failed' });
    }
    const snap = await fb.getDocsFromServer(fb.query(daysCol(fid), fb.where('kidId', '==', id)));
    const local = Object.entries(parts.days).filter(([, d]) => d.kidId === id);
    const remote = new Map(snap.docs.map((d) => [d.id, d.data()]));
    const same = local.length === remote.size && local.every(([dayId, d]) => stableJson(remote.get(dayId)) === stableJson(clean(d)));
    if (!same) throw Object.assign(new Error('The cloud copy did not match this device.'), { code: 'check-failed' });
  }
}

// ---------- live sync ----------

let unsubs = [];
let pending = 0;

// Listen to the family and call onState(state) with the joined state whenever
// it changes here or on another device. A kid's device listens only to its own
// kid. onStatus({ pending, error }) reports unsent writes and errors.
export function startSync({ familyId, role, kidId }, { onState, onStatus = () => {} }) {
  stopSync();
  const parts = { family: null, device: {}, kids: {}, days: {} };
  const ready = { family: false, kids: false, days: false };
  let timer = 0;
  const emit = () => {
    if (!Object.values(ready).every(Boolean)) return;
    clearTimeout(timer);
    timer = setTimeout(() => onState(joinState(parts)), 30);
  };
  const fail = (err) => { console.error('Kid Quest sync', err); onStatus({ pending, error: err.code || err.message }); };
  const collect = (key) => (snap) => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') delete parts[key][ch.doc.id];
      else parts[key][ch.doc.id] = ch.doc.data();
    }
    ready[key] = true;
    emit();
  };

  unsubs.push(fb.onSnapshot(familyRef(familyId), (snap) => {
    parts.family = snap.data() || {};
    ready.family = true;
    emit();
  }, fail));
  if (role === 'kid') {
    unsubs.push(fb.onSnapshot(fb.doc(kidsCol(familyId), kidId), (snap) => {
      parts.kids = snap.exists() ? { [kidId]: snap.data() } : {};
      ready.kids = true;
      emit();
    }, fail));
    unsubs.push(fb.onSnapshot(fb.query(daysCol(familyId), fb.where('kidId', '==', kidId)), collect('days'), fail));
  } else {
    unsubs.push(fb.onSnapshot(kidsCol(familyId), collect('kids'), fail));
    unsubs.push(fb.onSnapshot(daysCol(familyId), collect('days'), fail));
  }
}

export function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
}

// Send what changed in one save. Works offline: Firestore keeps the writes on
// the device and sends them when it is back online.
export function writeChanges(familyId, changes, before, after, onStatus = () => {}) {
  const ops = [];
  for (const path of changes.changed) {
    if (path === 'device') continue;
    const ref = refFor(familyId, path);
    const was = before ? docAt(before, path) : undefined;
    const now = clean(docAt(after, path));
    if (was === undefined) {
      ops.push((b) => b.set(ref, now, path === 'family' ? { merge: true } : undefined));
    } else {
      const fields = diffFields(clean(was), now);
      if (!fields.length) continue;
      const args = fields.flatMap(([p, v]) => [new fb.FieldPath(...p), v === DELETE ? fb.deleteField() : v]);
      ops.push((b) => b.update(ref, ...args));
    }
  }
  for (const path of changes.removed) {
    if (path === 'device' || path === 'family') continue;
    const ref = refFor(familyId, path);
    ops.push((b) => b.delete(ref));
  }
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = fb.writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    pending += 1;
    onStatus({ pending });
    batch.commit()
      .catch((err) => {
        // An update fails if another device removed that document meanwhile:
        // fall back to writing the changed documents whole.
        console.error('Kid Quest save', err);
        const again = fb.writeBatch(db);
        for (const path of changes.changed) {
          if (path === 'device') continue;
          again.set(refFor(familyId, path), clean(docAt(after, path)), { merge: path === 'family' });
        }
        return again.commit();
      })
      .catch((err) => onStatus({ pending, error: err.code || err.message }))
      .finally(() => { pending -= 1; onStatus({ pending }); });
  }
}

// Every change between two splitState views, for writes queued before sync started.
export const changesBetween = (before, after) => diffDocs(before, after);
