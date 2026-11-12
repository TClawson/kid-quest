/**
 * Opens a kid's page from the kid picker. A device with just one kid (and not a parent's phone)
 * skips the picker when the app starts, so there the kid's page is open already.
 */
export async function openKid(page, sel = '[data-action="open-kid"]') {
  await page.waitForSelector(`${sel}, .screen.kid`);
  if (await page.locator(sel).count()) await page.click(sel);
}

/** Back to the kid picker (where the Parents button is) from a one-kid device's kid page. */
export async function toPicker(page) {
  await page.waitForSelector('[data-action="parent"], .screen.kid');
  if (await page.locator('[data-action="parent"]').count()) return;
  await page.evaluate(() => document.querySelector('#modal:not([hidden]) [data-action="modal-close"]')?.click());
  await page.click('.screen.kid [data-action="home"]');
}
