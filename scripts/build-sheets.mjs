// Make the printable sheet music (js/printsheets.js): every piece at every level as a Letter
// PDF in sheets/, engraved by the app's own abcjs in a headless Chromium, plus
// sheets/manifest.json (each PDF's piece, level and the fingerprint of the music it was made
// from). PDFs whose music hasn't changed are left alone; --all makes every one again.
// Run: npm run build:sheets [-- --all]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { printSheets, printAbc, SHEETS_DIR } from '../js/printsheets.js';
import { COMPOSER } from '../js/composer.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, SHEETS_DIR);
const manifestFile = path.join(dir, 'manifest.json');
const all = process.argv.includes('--all');
fs.mkdirSync(dir, { recursive: true });
const before = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { sheets: [] };
const had = new Map(before.sheets.map((s) => [s.file, s.fingerprint]));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.55in 0.6in 0.7in; }
  html, body { margin: 0; background: #fff; }
  #music svg { display: block; width: 100% !important; height: auto !important; }
  #music > div { break-inside: avoid; page-break-inside: avoid; height: auto !important; overflow: visible !important; }
  #music { height: auto !important; overflow: visible !important; }
</style></head><body><div id="music"></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(PAGE);
await page.addScriptTag({ path: path.join(root, 'js/vendor/abcjs.js') });

const sheets = printSheets();
let made = 0;
for (const s of sheets) {
  const abc = printAbc(s);
  const { print } = s;
  const file = path.join(root, s.file);
  if (!all && had.get(s.file) === print && fs.existsSync(file)) continue;
  const warnings = await page.evaluate((text) => {
    const el = document.getElementById('music');
    el.innerHTML = '';
    // one svg a line, so a page break never cuts a line of music in half
    const [tune] = ABCJS.renderAbc(el, text, {
      oneSvgPerLine: true,
      scale: 0.86,
      staffwidth: 790,
      paddingleft: 0,
      paddingright: 0,
      paddingtop: 6,
      paddingbottom: 10,
      format: { titlefont: '"Georgia" 24 bold', subtitlefont: '"Georgia" 14 italic', composerfont: '"Georgia" 12', tempofont: '"Georgia" 11 bold', partsfont: '"Georgia" 12 bold', annotationfont: '"Helvetica" 11', gchordfont: '"Helvetica" 12', vocalfont: '"Helvetica" 11' },
    });
    // abcjs gives the music and each line's box a fixed height with overflow hidden, worked
    // out before scaling: on a long piece that cut off the last lines. Let them size themselves.
    el.removeAttribute('style');
    for (const box of el.children) { box.style.height = ''; box.style.overflow = ''; }
    const out = (tune?.warnings || []).map(String);
    // nothing may be cut off: every line shows whole, and the page holds every line
    [...el.children].forEach((box, i) => { if (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1) out.push(`line ${i} is cut off`); });
    if (el.scrollHeight > el.clientHeight + 1) out.push('the music is cut off');
    return out;
  }, abc);
  if (warnings.length) throw new Error(`${s.file}: abcjs warnings or cut-off music\n${warnings.join('\n')}`);
  const html = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const footer = `<div style="width:100%;font:9px Georgia,serif;color:#666;padding:0 0.6in;display:flex;justify-content:space-between">
    <span>${html(s.name)} · ${s.level[0].toUpperCase()}${s.level.slice(1)}</span><span>Kid Quest · ${html(COMPOSER)}</span><span><span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
  await page.pdf({ path: file, format: 'Letter', preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer });
  made += 1;
  console.log(`made ${s.file}`);
}
await browser.close();

const manifest = { composer: COMPOSER, sheets: sheets.map((s) => ({ id: s.id, level: s.level, name: s.name, file: s.file, fingerprint: s.print })) };
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
// PDFs no piece makes any more (a renamed piece, a dropped level)
const keep = new Set(sheets.map((s) => path.basename(s.file)));
for (const f of fs.readdirSync(dir)) if (f.endsWith('.pdf') && !keep.has(f)) { fs.rmSync(path.join(dir, f)); console.log(`removed ${f}`); }
console.log(`${made} made, ${sheets.length - made} already up to date`);
