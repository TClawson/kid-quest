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

## Development

No build step: plain HTML, CSS and JavaScript modules.

```sh
npm test         # unit tests for the game rules (js/logic.js)
npm start        # serve locally at http://localhost:8080
```

- `js/logic.js` holds the rules (schedules, streaks, freezes, XP) with no DOM code, tested in `test/`.
- `js/store.js` is the storage layer: every save and load goes through it. It also splits the data into family, kid and day documents, ready for cloud sync.
- `js/app.js` is the UI, `js/avatar.js` draws the 16-bit pixel buddies, outfits and backgrounds (letter grids rendered to SVG), `js/items.js` the unlock catalog, `js/fx.js` the sounds and confetti, `sw.js` the offline cache.
- When you change a cached file, bump `CACHE` in `sw.js` so installed tablets pick up the update.
