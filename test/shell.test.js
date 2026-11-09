// The service worker's offline list (SHELL in sw.js) and the deploy step must
// cover every file the app loads, or the app breaks offline (and a missing
// file makes the whole service worker install fail).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const sw = readFileSync('sw.js', 'utf8');
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('every file in SHELL exists', () => {
  for (const f of shell.filter((f) => f !== './')) assert.ok(existsSync(f), `${f} is in sw.js SHELL but missing`);
});

test('every app file is in SHELL', () => {
  const want = [
    ...readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync('js/vendor').filter((f) => f.endsWith('.js')).map((f) => `js/vendor/${f}`),
    ...readdirSync('css').filter((f) => f.endsWith('.css')).map((f) => `css/${f}`),
    ...[...readFileSync('index.html', 'utf8').matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]),
    ...JSON.parse(readFileSync('manifest.webmanifest', 'utf8')).icons.map((i) => i.src),
  ];
  for (const f of want) assert.ok(shell.includes(f), `${f} is missing from sw.js SHELL`);
});

test('the deploy copies every folder in SHELL and names the cache after the commit', () => {
  const yml = readFileSync('.github/workflows/pages.yml', 'utf8');
  const cp = yml.match(/cp -r ([^\n]+) _site\//)[1].split(/\s+/);
  const tops = new Set(shell.filter((f) => f !== './').map((f) => f.split('/')[0]));
  for (const t of tops) assert.ok(cp.includes(t), `deploy doesn't copy ${t}`);
  assert.match(sw, /const CACHE = 'kid-quest-dev';/);
  assert.ok(yml.includes("s/const CACHE = 'kid-quest-dev';/"), 'deploy renames the cache');
});
