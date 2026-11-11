// The parts of the Firebase SDK that Kid Quest uses. scripts/build-firebase.mjs
// bundles these into js/vendor/firebase.js, so the app needs no build step and
// no CDN at runtime.
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver, connectAuthEmulator,
  GoogleAuthProvider, signInWithPopup, signInWithCredential, signInAnonymously, signOut, onAuthStateChanged,
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, collection, query, where, onSnapshot, writeBatch, getDocFromServer, getDocsFromServer,
  Timestamp, deleteField, FieldPath, arrayUnion, increment,
} from 'firebase/firestore';
