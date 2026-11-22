import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRITTERS, CRITTER_MAPS, critterById, mapCritters, inSeason, weatherOf, wantedOf, oddsFor, qualityOf, better, photoPoints, RARITIES, SLOTS } from '../js/critters.js';
import { recordPhoto, albumCount, albumPages, addClue, spendClues, CLUES_FOR_LEGEND } from '../js/album.js';
import { gameFor, GAME_NAMES } from '../js/play.js';
import { ITEMS, bestGear, MOVES } from '../js/items.js';
import { CAMERAS, cameraFor, TRAIN_MAPS, RAINBOW } from '../js/phototrain.js';

test('every animal has an id, a map, a known rarity, ways to show itself, a look and real facts', () => {
  const ids = new Set();
  for (const c of CRITTERS) {
    assert.ok(!ids.has(c.id), `${c.id} twice`); ids.add(c.id);
    assert.ok(RARITIES[c.rarity], c.id);
    assert.ok(c.how?.length, c.id);
    assert.ok(c.look?.plan && c.look.len > 0, c.id);
    for (const k of ['where', 'eats', 'wow']) assert.ok(c[k]?.length > 20, `${c.id} ${k}`);
  }
});

test('each map has exactly one legend, and the Fjord keeps its rare lynx', () => {
  for (const map of CRITTER_MAPS) assert.equal(mapCritters(map).filter((c) => c.rarity === 'legend').length, 1, map);
  assert.equal(critterById('fjord-lynx')?.rarity, 'rare');
});

test('winter brings its own animals: the snowshoe hare and the snowy owl only in winter', () => {
  for (const id of ['meadow-hare', 'meadow-owl']) {
    const c = critterById(id);
    assert.ok(c, id);
    assert.ok(inSeason(c, 'winter'));
    assert.ok(!inSeason(c, 'summer'));
  }
  const winter = oddsFor('bg-meadow', 'winter', 'snow').map(([c]) => c.id);
  assert.ok(winter.includes('meadow-hare'));
  assert.ok(!oddsFor('bg-meadow', 'summer', 'sunny').map(([c]) => c.id).includes('meadow-hare'));
});

test('every map has its own animals, its own ride, and a page in the album', () => {
  assert.deepEqual([...CRITTER_MAPS].sort(), [...TRAIN_MAPS].sort());
  assert.equal(CRITTER_MAPS.length, 10);
  for (const map of CRITTER_MAPS) {
    const list = mapCritters(map);
    assert.ok(list.every((c) => c.map === map), map);
    assert.ok(list.filter((c) => c.how.includes('far')).length >= 1, `${map}: something for the zoom lens`);
  }
  // the seven new maps (Fable's roster rule): two far animals, a tunnel animal, two rares
  for (const map of ['bg-castle', 'bg-sunset', 'bg-ocean', 'bg-volcano', 'bg-rainforest', 'bg-rainbow', 'bg-galaxy']) {
    const list = mapCritters(map);
    assert.ok(list.filter((c) => c.how.includes('far')).length >= 2, `${map}: two far animals`);
    assert.equal(list.filter((c) => c.tunnel).length, 1, `${map}: a tunnel animal`);
    assert.ok(list.filter((c) => c.rarity === 'rare').length >= 2, `${map}: two rares`);
    assert.ok(list.some((c) => c.how.includes('track')), `${map}: something to stop the train`);
  }
  // pretend maps teach about real cousins
  for (const map of ['bg-rainbow', 'bg-galaxy']) assert.ok(mapCritters(map).every((c) => c.cousin), map);
  // every color of the rainbow has a Rainbow land animal that isn't far away
  for (const [color] of RAINBOW) assert.ok(mapCritters('bg-rainbow').some((c) => c.color === color && !c.how.every((h) => h === 'far')), color);
  // the album names every map
  for (const p of albumPages({})) assert.ok(!p.name.startsWith('bg-'), p.name);
});

test('the day decides the weather and the Wanted animal, the same on every device', () => {
  assert.equal(weatherOf('2026-11-21', 'autumn'), weatherOf('2026-11-21', 'autumn'));
  const w = wantedOf('2026-11-21', 'bg-fjord', 'autumn');
  assert.equal(w, wantedOf('2026-11-21', 'bg-fjord', 'autumn'));
  assert.equal(critterById(w)?.map, 'bg-fjord');
});

test('photo ratings: sharp is good, sharp + posed + centred is perfect, perfect beats good', () => {
  assert.equal(qualityOf({ sharp: false, posed: true, centred: true }), 'blurry');
  assert.equal(qualityOf({ sharp: true, posed: false, centred: true }), 'good');
  assert.equal(qualityOf({ sharp: true, posed: true, centred: true }), 'perfect');
  assert.ok(better('perfect', 'good'));
  assert.ok(!better('good', 'perfect'));
  const fox = critterById('meadow-fox');
  assert.equal(photoPoints(fox, 'perfect'), RARITIES.rare.points * 2);
  assert.equal(photoPoints(fox, 'perfect', true), RARITIES.rare.points * 4);
  assert.equal(photoPoints(fox, 'blurry'), 0);
});

test('the album keeps each animal\'s best photo and every kind of shot', () => {
  const shot = (quality, slots) => ({ critter: 'meadow-fox', quality, slots, map: 'bg-meadow', season: 'autumn', weather: 'rain' });
  let r = recordPhoto({}, shot('blurry', []), '2026-11-21');
  assert.equal(r.isNew, false, 'a blurry glimpse is not kept');
  r = recordPhoto({}, shot('good', ['action']), '2026-11-21');
  assert.ok(r.isNew && r.first);
  assert.equal(r.album['meadow-fox'].q, 'good');
  const r2 = recordPhoto(r.album, shot('good', ['action']), '2026-11-22');
  assert.equal(r2.isNew, false, 'nothing new');
  const r3 = recordPhoto(r.album, shot('perfect', ['portrait']), '2026-11-22');
  assert.ok(r3.isNew && r3.better && !r3.first);
  assert.equal(r3.album['meadow-fox'].q, 'perfect');
  assert.deepEqual(r3.album['meadow-fox'].slots.sort(), ['action', 'portrait']);
  for (const s of r3.album['meadow-fox'].slots) assert.ok(SLOTS[s]);
  assert.equal(albumCount(r3.album).found, 1);
  assert.equal(albumCount(r3.album).total, CRITTERS.length);
});

test('album pages: one per map, the kid\'s own map first', () => {
  const pages = albumPages({}, 'bg-fjord');
  assert.equal(pages[0].map, 'bg-fjord');
  assert.equal(pages.length, CRITTER_MAPS.length);
  assert.equal(pages.reduce((n, p) => n + p.animals.length, 0), CRITTERS.length);
});

test('three clues bring the legend, and photographing it spends them', () => {
  let clues = {};
  for (let i = 0; i < 5; i += 1) clues = addClue(clues, 'bg-meadow');
  assert.equal(clues['bg-meadow'], CLUES_FOR_LEGEND);
  assert.equal(spendClues(clues, 'bg-meadow')['bg-meadow'], undefined);
});

test('the camera: three versions for gems, each one better, and a held camera means the photo train', () => {
  const cams = ITEMS.filter((i) => i.slot === 'sport' && i.kind === 'camera');
  assert.equal(cams.length, 3);
  assert.ok(cams.every((c) => c.gems > 0 && !c.coins));
  assert.equal(bestGear(['sport-camera-good']).camera, 2);
  assert.equal(gameFor({ camera: 1 }, 'x'), 'train');
  assert.equal(GAME_NAMES.train, 'Photo train');
  for (let t = 1; t < 3; t += 1) {
    assert.ok(CAMERAS[t].focus < CAMERAS[t - 1].focus && CAMERAS[t].film > CAMERAS[t - 1].film);
  }
  assert.ok(!cameraFor(1).zoom && cameraFor(2).zoom && cameraFor(3).tele);
  assert.equal(MOVES.filter((m) => m.kind === 'camera').length, 3);
});
