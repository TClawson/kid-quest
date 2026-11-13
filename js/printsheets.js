// Printable sheet music: every piece in the songbook (map songs, show tunes and concert pieces)
// at every level written so far, as a PDF in sheets/ that a kid prints from the piece's page
// and a parent from the parent area. The PDFs are made ahead of time by
// scripts/build-sheets.mjs (the same ABC the songbook engraves, plus a title, the level, the
// composer and the speed, laid out for a Letter page) and kept in the repo with
// sheets/manifest.json, which records a fingerprint of the music each PDF was made from; a
// test fails when the music or the composer changes and the PDFs weren't made again.
// Pure logic, no DOM.

import { SONGBOOK, songAbc, songById, keyLabel, SWING_MARK } from './sheetmusic.js';
import { LEVELS, hasLevel, arrangementAbc } from './arrange.js';
import { CONCERT, longLevels, longAbc, longFacts } from './concert.js';
import { itemById } from './items.js';
import { COMPOSER } from './composer.js';

/** Where the PDFs are, from the app's page. */
export const SHEETS_DIR = 'sheets';
/** Bars on a printed line. */
export const PRINT_PER_LINE = 4;
/**
 * The page layout's version: raise it when scripts/build-sheets.mjs changes how a page looks,
 * so every PDF gets a new fingerprint (and file name) even though its music didn't change.
 */
export const PRINT_LAYOUT = 2;

const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** A name as a file name: 'Bubble Waltz: The Dive' → 'bubble-waltz-the-dive'. */
export const slug = (name) => String(name).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const mapName = (map) => itemById(map)?.name || 'map';

let sheets = null;
/**
 * Every printable sheet: [{ id, level, name, kind ('map'|'show'|'long'), file, print, from }].
 * The file name ends with the start of the sheet's fingerprint (print), so a PDF made again
 * from changed music or a new layout has a new name: a phone or tablet that downloaded the
 * old one (Android keeps it in Downloads and may open that copy again) can't show it in its place.
 */
export function printSheets() {
  sheets ||= sheetList().map((s) => {
    const print = fingerprint(`${PRINT_LAYOUT}\n${printAbc(s)}`);
    return { ...s, print, file: `${s.file}-${print.slice(0, 6)}.pdf` };
  });
  return sheets;
}

function sheetList() {
  const out = [];
  for (const p of SONGBOOK) {
    for (const level of LEVELS.filter((l) => hasLevel(p.id, l))) {
      out.push({ id: p.id, level, name: p.name, kind: p.kind, file: `${SHEETS_DIR}/${slug(p.name)}-${level}`, from: p.kind === 'show' ? `The secret show on the ${mapName(p.map)} map` : `The ${mapName(p.map)} map song` });
    }
  }
  for (const p of CONCERT) {
    for (const level of longLevels(p.id)) {
      out.push({ id: p.id, level, name: p.name, kind: 'long', file: `${SHEETS_DIR}/${slug(p.name)}-${level}`, from: `A concert piece from the ${mapName(p.map)} map song` });
    }
  }
  return out;
}

/** The sheet for a piece at a level, or null. */
export const sheetFor = (id, level) => printSheets().find((s) => s.id === id && s.level === level) || null;

/** ABC text safe inside a header field. */
const field = (s) => String(s).replace(/[\n%]/g, ' ');

/**
 * A sheet as ABC for printing: the songbook's own score (an easy song with the left hand's
 * notes, every other level both hands written out), with the title, a subtitle (the level and
 * where the piece comes from), the composer and the speed added to its header.
 */
export function printAbc(sheet) {
  const { id, level } = sheet;
  let abc;
  let facts;
  let tempo = '';
  if (sheet.kind === 'long') {
    abc = longAbc(id, level, { perLine: PRINT_PER_LINE });
    facts = longFacts(id, level);
  } else {
    const song = songById(id);
    abc = level === 'easy' ? songAbc(id, { hands: 'roots', perLine: PRINT_PER_LINE }) : arrangementAbc(id, level, { perLine: PRINT_PER_LINE });
    facts = keyLabel(song.key);
    tempo = song.swing ? `Q:"Swing" 1/4=${song.bpm}` : `Q:1/4=${song.bpm}`;
    abc = abc.replace(`${SWING_MARK}\n`, '');
  }
  const head = [
    `T:${field(sheet.name)}`,
    `T:${field(`${LEVEL_NAMES[level]} · ${facts}`)}`,
    `C:${field(`Music by ${COMPOSER}`)}`,
    ...(tempo ? [tempo] : []),
  ];
  return abc.replace(/^X:1\n/, `X:1\n${head.join('\n')}\n`);
}

/** A short fingerprint of a text (FNV-1a, 32 bits, as hex): enough to tell a PDF is stale. */
export function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
