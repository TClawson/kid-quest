// The printable sheet music (js/printsheets.js, made by scripts/build-sheets.mjs): every piece
// at every level has its PDF in sheets/, and each PDF was made from the music (and composer)
// the app has now. When this fails, run `npm run build:sheets` and commit sheets/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { printSheets, printAbc, fingerprint, sheetFor, slug } from '../js/printsheets.js';
import { SONGBOOK } from '../js/sheetmusic.js';
import { CONCERT, longLevels } from '../js/concert.js';
import { COMPOSER } from '../js/composer.js';

const manifest = JSON.parse(readFileSync('sheets/manifest.json', 'utf8'));
const made = new Map(manifest.sheets.map((s) => [s.file, s]));

test('every piece has a sheet at every level, each with its own file', () => {
  const sheets = printSheets();
  for (const p of SONGBOOK) for (const l of ['easy', 'medium', 'hard']) assert.ok(sheetFor(p.id, l), `${p.id} ${l}`);
  for (const p of CONCERT) for (const l of longLevels(p.id)) assert.ok(sheetFor(p.id, l), `${p.id} ${l}`);
  assert.equal(new Set(sheets.map((s) => s.file)).size, sheets.length);
  assert.equal(slug('Bubble Waltz: The Dive'), 'bubble-waltz-the-dive');
});

test('the print has a title, level, composer and speed', () => {
  const abc = printAbc(sheetFor('bg-sunset', 'medium'));
  assert.match(abc, /^X:1\nT:Island Breeze\nT:Medium · F major\nC:Music by /);
  assert.ok(abc.includes(`C:Music by ${COMPOSER}`));
  assert.match(abc, /\nQ:"Swing" 1\/4=\d+\n/);
  assert.equal(abc.match(/Q:"Swing"/g).length, 1);
});

test('every PDF is there and up to date (else: npm run build:sheets)', () => {
  assert.equal(manifest.composer, COMPOSER, 'the composer changed: print the PDFs again');
  for (const s of printSheets()) {
    assert.ok(existsSync(s.file), `${s.file} is missing`);
    assert.equal(made.get(s.file)?.fingerprint, fingerprint(printAbc(s)), `${s.file} is out of date`);
    assert.equal(readFileSync(s.file).subarray(0, 5).toString(), '%PDF-');
  }
  const want = new Set(printSheets().map((s) => s.file.split('/')[1]));
  for (const f of readdirSync('sheets').filter((x) => x.endsWith('.pdf'))) assert.ok(want.has(f), `sheets/${f} belongs to no piece`);
});
