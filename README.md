# Kid Quest

Fun game for kids to complete their daily chore routines and piano practice. Each kid gets a daily quest, celebrations when tasks and days are done, and a streak (with earned streak freezes) for doing it every day.

v1 runs entirely on one Android tablet. There is no server and no account: everything is stored in the tablet's browser storage, with a backup-to-file button in the parent area.

## What's in v1

- **Kid profiles** with avatar and color. Each kid's tasks are fully configurable: name, icon, morning or after school, which days, whether the kid checks it off or a parent PIN is needed, and an optional timer.
- **Default routine** for a new kid: brush teeth, make bed, clear bedroom floor every morning; piano (30 minute timer) Monday to Friday; chore of the week Monday to Thursday; deep clean, vacuum and dust on Friday; laundry on Saturday.
- **Parent PIN** to sign off tasks on the spot, or "ask a parent later", which puts the task in the parent's approval queue.
- **Piano timer** that only counts while the app is open on screen and keeps the screen awake.
- **Streaks**: a day counts when every scheduled task is done. 7 perfect days in a row earn a streak freeze (max 2), used automatically on a missed day. Parents can mark a day as excused, and approving tasks late repairs the streak.
- **Quest map**: tasks are stops on a winding board-game path with the buddy standing on the next one and a treasure chest at the end (a list view is one tap away).
- **Celebrations**: sound and XP for each task, confetti for a complete day, and a big celebration with the parent-chosen weekly reward every 7 days.
- **Reminders** at set times (sound and banner while the app is open, a notification if it's in the background and notifications are allowed).
- **Animated buddies**: each kid picks a fox, bear, panda, cat or dino. Drawn as 16-bit style pixel art. It is sleepy before the first task, cheers when a task is done, dances when the day is complete, and looks sad after a missed day.
- **Wardrobe**: backgrounds, hats, glasses and extras unlock with best streak (kept even if a streak ends) and XP level. The ladder is in `js/items.js`.
- **Backup and restore** to a JSON file.

## Putting it on the tablet

The app must be served over HTTPS to install. `.github/workflows/pages.yml` runs the tests and deploys to GitHub Pages on every push to `main`. One-time setup: in the repo on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. (GitHub Pages on a private repo needs a paid GitHub plan; a public repo is free and contains no family data, since all data stays on the tablet.)

Then on the Android tablet:

1. Open the Pages URL (for example `https://<your-user>.github.io/kid-quest/`) in Chrome.
2. Chrome menu (⋮) → **Add to Home screen** → **Install**.
3. Open Kid Quest from the home screen, choose a parent PIN, and add the kids.

## Family sync

Devices can share one family in Firebase (Firestore + Auth), so progress is safe in the cloud and parents can approve from their phones. Devices that never join keep working on their own as before.

1. On a parent's phone: Parents › Settings › Family sync › **Start a family**, and sign in with Google. This uploads that device's settings and PIN.
2. **Add a kid's device** shows a code. On each kid's tablet (each Android user), Parents › Settings › Family sync › **Join with a code**. That kid's progress uploads, is read back and checked, and a backup file is saved first. The kid's original local copy is never deleted.
3. **Add a parent** shows a parent code for the other parent's phone.

**Visiting buddies:** every day, 1 to 4 other kids' buddies show up by the village houses at the top of each kid's quest map, wearing whatever outfit their owner picked. Who visits is random but fixed per kid per day (`js/visits.js`), so every device agrees. They take turns saying preset lines; tap one to hear it. This works on a shared device with several kids, and across devices once they sync with the family.

Firebase setup (once): the project in `js/firebase-config.js` needs Google and Anonymous sign-in enabled, `tclawson.github.io` as an authorized domain, and the rules in `firestore.rules` published (Firestore › Rules, paste, Publish). Re-publish whenever `firestore.rules` changes.

Only Google accounts on the allowed list can start a family, so strangers who find the site can't store data in the project. To allow an account, add a document to the `allowedParents` collection in Firestore › Data, with the lowercase email as its document ID and no fields. Other parents and kids' devices join with codes and don't need to be listed.

## Development

No build step: plain HTML, CSS and JavaScript modules. The Firebase SDK is pre-bundled in `js/vendor/firebase.js` (`npm run build:firebase` rebuilds it).

```sh
npm test            # unit tests: game rules, catalog, storage layer
npm start           # serve locally at http://localhost:8080
npm ci              # for the tests below (Playwright, Firebase emulators; needs Java 21)
npm run test:smoke  # headless Chrome: load saved data, open a kid, tick a task
npm run test:rules  # Firestore security rules against the emulator
npm run test:e2e    # family sync end to end: two phones and a tablet on the emulators
```

To try sync locally against the emulators, run `npx firebase emulators:start --project demo-kid-quest` and set `localStorage['kidquest.emulator'] = '1'` in the browser.

- `js/logic.js` holds the rules (schedules, streaks, freezes, XP) with no DOM code, tested in `test/`.
- `js/store.js` is the storage layer: every save and load goes through it. It splits the data into family, kid and day documents and works out which fields changed.
- `js/cloud.js` is family sync: sign-in, join codes, upload and check, live listeners, and field-level writes (so two devices changing the same day don't overwrite each other). `firestore.rules` keeps each family's data to its members.
- `js/app.js` is the UI, `js/avatar.js` draws the 16-bit pixel buddies, outfits and backgrounds (letter grids rendered to SVG), `js/items.js` the unlock catalog, `js/fx.js` the sounds and confetti, `sw.js` the offline cache.
- When you change a cached file, bump `CACHE` in `sw.js` so installed tablets pick up the update.
