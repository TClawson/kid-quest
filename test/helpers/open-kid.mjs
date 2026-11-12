/**
 * Opens a kid's page from the kid picker. A device with just one kid (and not a parent's phone)
 * skips the picker when the app starts, so there the kid's page is open already.
 */
export async function openKid(page, sel = '[data-action="open-kid"]') {
  await page.waitForSelector(`${sel}, .screen.kid`);
  if (await page.locator(sel).count()) await page.click(sel);
}

/** Closes whatever pop-up is open over the kid's village (the start-of-day ones, a talk box). */
export async function closePops(page) {
  await page.evaluate(() => document.querySelector('#modal:not([hidden]) [data-action="modal-close"]')?.click());
}

/** Opens the kid's Menu (the ☰ button at the top right of the village). */
export async function openMenu(page) {
  await closePops(page);
  await page.click('.k-hud [data-action="menu"]');
  await page.waitForSelector('#modal .menu-pop');
}

/**
 * Back to the kid picker from a kid's village: Menu, then Switch kid. Only a device with more
 * than one kid has Switch kid; a one-kid device has no picker to go back to (use openParents).
 */
export async function toPicker(page) {
  await page.waitForSelector('[data-action="parent"], .screen.kid');
  if (await page.locator('[data-action="parent"]').count()) return;
  await openMenu(page);
  await page.click('#modal [data-action="menu-switch"]');
  await page.waitForSelector('[data-action="parent"]');
}

/**
 * Taps Parents: on the kid picker its button, on a kid's village Menu, then Parents. Either way
 * the PIN pad (or, on a parent's phone, the parent area) comes next.
 */
export async function openParents(page) {
  await page.waitForSelector('[data-action="parent"], .screen.kid');
  if (await page.locator('[data-action="parent"]').count()) return page.click('[data-action="parent"]');
  await openMenu(page);
  await page.click('#modal [data-action="menu-parents"]');
}

/**
 * Does a chore the way a kid does now: Today, Go on the chore, the buddy walks to whoever gives
 * it (a villager, or something in the house), and the talk box's button for it is tapped (I did
 * it!, or Start for a timer chore). clock: the page's clock is installed, so time is run forward.
 */
export async function doChore(page, id, { clock = false } = {}) {
  await closePops(page);
  await page.click('.k-hud [data-action="today"]');
  await page.click(`.t-q[data-id="${id}"] [data-action="today-go"]`);
  const btn = `.v-dialog:not([hidden]) [data-v="do"][data-q="${id}"], .v-dialog:not([hidden]) [data-h="do"][data-q="${id}"]`;
  for (let i = 0; i < 80 && !(await page.locator(btn).count()); i += 1) {
    if (clock) await page.clock.runFor(300); else await page.waitForTimeout(300);
  }
  await page.click(btn);
}

/**
 * The old map, from the kid's Menu (there for one release while kids get used to the village).
 * For tests about the map itself: its visitors' games, its chest, its quest stops.
 */
export async function openOldMap(page) {
  await openMenu(page);
  await page.click('#modal [data-action="old-map"]');
  await page.waitForSelector('.quest-map');
}
