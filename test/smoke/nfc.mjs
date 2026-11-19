// Settings › Test tools › NFC token test (js/nfctest.js), behind the parent PIN.
// 1. Desktop Chromium has no Web NFC: the page says this device can't read tokens.
// 2. With a stand-in NDEFReader (Chrome on Android's API, faked here) and NFC already allowed,
//    the page starts reading by itself; a reading shows the tag's serial, its text and link,
//    counts reads per tag and the gap between them, plays a sound and goes in the log; a read
//    error and the app being put away go in the log too; "Keep screen awake" takes and lets go
//    of a screen wake lock; "Write to a tag" writes the app's address as a link; Back stops reading.
// Nothing the kids or family keep is changed.
// Saves screenshots (unsupported.png, reading.png).
// Run: node test/smoke/nfc.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash } from '../../js/logic.js';

const out = (process.argv[2] || 'previews/nfc').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const PHONE = { width: 412, height: 860 };

const s = emptyState();
s.settings.pinHash = fallbackHash('kidquest:1234');
s.settings.sound = true;
s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: '2024-01-01', seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function open(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(site.url);
  await page.evaluate((st) => { localStorage.setItem('kidquest.v1', JSON.stringify(st)); Storage.prototype.setItem = () => {}; }, s);
  await page.reload();
  await page.waitForSelector('[data-action="parent"], .screen.kid');
  if (await page.locator('[data-action="parent"]').count()) await page.click('[data-action="parent"]');
  else {
    await page.evaluate(() => document.querySelector('#modal:not([hidden]) [data-action="modal-close"]')?.click());
    await page.click('.k-hud [data-action="menu"]');
    await page.click('#modal [data-action="menu-parents"]');
  }
  for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="settings"]');
  if (await page.locator('[data-action="test-tools"][aria-expanded="false"]').count()) await page.click('[data-action="test-tools"]');
  return page;
}
// the page keeps nothing and touches none of the kids' or family's data: it imports only esc and sounds
const src = fs.readFileSync('js/nfctest.js', 'utf8');
assert.deepEqual([...src.matchAll(/^import .*$/gm)].map((m) => m[0]), ["import { esc } from './ctx.js';", "import { sounds } from './fx.js';"]);
assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /localStorage|indexedDB|sessionStorage|\bstate\.(kids|settings)|\bsave\(|cloud/);

// ---------- 1. desktop Chromium: no Web NFC ----------
{
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  const page = await open(ctx);
  assert.equal(await page.evaluate(() => 'NDEFReader' in window), false, 'desktop Chromium has no NDEFReader');
  await page.click('[data-action="nfc-open"]');
  await page.waitForSelector('.screen.nfc [data-nfc-state="unsupported"]');
  assert.match(await page.locator('.nfc-none').innerText(), /can't read tokens/i);
  assert.match(await page.locator('.nfc-none').innerText(), /Chrome on an Android/);
  assert.equal(await page.locator('[data-nfc="start"]').count(), 0, 'no Start button without NFC');
  await page.screenshot({ path: `${out}/unsupported.png`, fullPage: true });
  await page.click('[data-action="nfc-back"]');
  await page.waitForSelector('[data-action="nfc-open"]');
  await ctx.close();
}

// ---------- 2. a stand-in NDEFReader ----------
{
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.kq = { readers: [], scans: 0, aborted: 0, writes: [], locks: 0, released: 0, played: 0 };
    const enc = new TextEncoder();
    class FakeReader extends EventTarget {
      constructor() { super(); window.kq.readers.push(this); this.onreading = null; this.onreadingerror = null; }
      async scan({ signal } = {}) {
        window.kq.scans += 1;
        this.signal = signal;
        signal?.addEventListener('abort', () => { window.kq.aborted += 1; });
      }
      async write(msg, opts = {}) { window.kq.writes.push(msg.records.map((r) => ({ recordType: r.recordType, data: r.data }))); void opts; }
    }
    window.NDEFReader = FakeReader;
    /** Pretend a tag was tapped: a reading on the scanning reader. */
    window.kqTap = (serial, records) => {
      const r = window.kq.readers.find((x) => x.signal && !x.signal.aborted);
      const ev = new Event('reading');
      ev.serialNumber = serial;
      ev.message = { records: records.map((x) => ({ ...x, data: new DataView(enc.encode(x.text).buffer) })) };
      r.onreading?.(ev);
    };
    window.kqBadTap = () => window.kq.readers.find((x) => x.signal && !x.signal.aborted).onreadingerror?.(new Event('readingerror'));
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (d) => (d.name === 'nfc' ? Object.assign(new EventTarget(), { state: 'granted', onchange: null }) : query(d));
    const sentinel = () => {
      const t = new EventTarget();
      t.release = async () => { window.kq.released += 1; t.dispatchEvent(new Event('release')); };
      return t;
    };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { window.kq.locks += 1; return sentinel(); } } });
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.kq.played += 1; return start.apply(this, a); };
  });
  const page = await open(ctx);
  const kq = () => page.evaluate(() => ({ ...window.kq, readers: window.kq.readers.length }));
  await page.click('[data-action="nfc-open"]');
  // already allowed: reading starts without a tap
  await page.waitForSelector('[data-nfc-state="scanning"]');
  assert.equal((await kq()).scans, 1);
  assert.match(await page.locator('[data-nfc-perm]').innerText(), /allowed/);

  await page.evaluate(() => window.kqTap('04:a1:b2:c3:d4:e5:80', [{ recordType: 'text', encoding: 'utf-8', lang: 'en', text: 'bed' }, { recordType: 'url', text: 'https://example.com/kq' }]));
  await page.waitForSelector('.nfc-serial');
  let last = await page.locator('.nfc-last').innerText();
  assert.match(last, /04:a1:b2:c3:d4:e5:80/);
  assert.match(last, /bed/);
  assert.match(last, /https:\/\/example\.com\/kq/);
  assert.match(last, /Reads of this tag\s+1/);
  assert.match(last, /first read/);
  assert.ok((await kq()).played > 0, 'a sound played on the read');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.kqTap('04:a1:b2:c3:d4:e5:80', [{ recordType: 'text', encoding: 'utf-8', text: 'bed' }]));
  await page.evaluate(() => window.kqTap('04:ff:ee', []));
  last = await page.locator('.nfc-last').innerText();
  assert.match(last, /04:ff:ee/);
  assert.match(last, /blank tag/);
  assert.match(last, /3 reads · 2 different tags/);
  await page.evaluate(() => window.kqTap('04:a1:b2:c3:d4:e5:80', []));
  last = await page.locator('.nfc-last').innerText();
  assert.match(last, /Reads of this tag\s+3/);
  assert.match(last, /Since this tag's last read\s+\d+ ms/);
  await page.evaluate(() => window.kqBadTap());
  assert.match(await page.locator('#nfc-log').innerText(), /couldn't be read/);

  // put away and back
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const logText = await page.locator('#nfc-log').innerText();
  assert.match(logText, /put away/);
  assert.match(logText, /showing again/);
  assert.ok((await page.locator('#nfc-log li').count()) <= 30);

  // keep the screen awake
  await page.check('[data-nfc-wake]');
  await page.waitForFunction(() => window.kq.locks === 1);
  await page.waitForSelector('.nfc-wake :text("(awake)")');
  await page.uncheck('[data-nfc-wake]');
  await page.waitForFunction(() => window.kq.released === 1);

  // write the app's address
  await page.click('[data-nfc="write"]');
  await page.waitForFunction(() => window.kq.writes.length === 1);
  const w = (await kq()).writes[0];
  assert.deepEqual(w, [{ recordType: 'url', data: `${site.url.replace(/\/?$/, '/')}` }]);
  await page.waitForSelector('#nfc-log :text("Wrote")');
  await page.screenshot({ path: `${out}/reading.png`, fullPage: true });

  // leaving stops reading
  await page.click('[data-action="nfc-back"]');
  await page.waitForSelector('[data-action="nfc-open"]');
  assert.equal((await kq()).aborted, 1, 'scan stopped on leaving');
  await ctx.close();
}

await browser.close();
await site.close();
assert.deepEqual(errors, []);
console.log('nfc test page ok');
