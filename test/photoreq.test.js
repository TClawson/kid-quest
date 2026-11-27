// Villager photo requests (js/photoreq.js) and print tickets (js/prints.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshRequests, requestsOf, giveIfAsked, meets, askText, OPEN_MAX, LASTS, FRAME_EVERY } from '../js/photoreq.js';
import { ticketsLeft, printPhoto, PHOTO_FRAME_ID } from '../js/prints.js';
import { addDays } from '../js/logic.js';
import { mapCritters } from '../js/critters.js';

const day = '2026-07-14';
const kinds = ['rabbit', 'otter', 'hedgehog'];
const kidWith = (n) => {
  const album = {};
  for (const c of mapCritters('bg-meadow').filter((x) => x.rarity === 'common' && !x.seasons).slice(0, n)) album[c.id] = { q: 'good', map: 'bg-meadow' };
  return { id: 'kid_a', owned: [], spent: 0, critterAlbum: album };
};
const opts = { map: 'bg-meadow', season: 'summer', kinds };

test('one new request a day, at most OPEN_MAX open, only animals already found, each from a different villager', () => {
  const kid = kidWith(4);
  assert.equal(refreshRequests(kid, day, opts), true);
  assert.equal(requestsOf(kid, day).open.length, 1);
  assert.equal(refreshRequests(kid, day, opts), false, 'not a second one the same day');
  refreshRequests(kid, addDays(day, 1), opts);
  const open = requestsOf(kid, addDays(day, 1)).open;
  assert.equal(open.length, OPEN_MAX);
  assert.notEqual(open[0].by, open[1].by);
  assert.notEqual(open[0].c, open[1].c);
  for (const q of open) { assert.ok(kid.critterAlbum[q.c]); assert.ok(kinds.includes(q.by)); assert.equal(q.want, 'perfect', 'a kid with few animals gets plain requests'); }
  // each lasts LASTS days
  assert.equal(requestsOf(kid, addDays(day, LASTS)).open.length, 1, 'the first one is gone after two days');
});

test('nothing to ask for without animals in the album, or without villagers', () => {
  const kid = kidWith(0);
  refreshRequests(kid, day, opts);
  assert.equal(requestsOf(kid, day).open.length, 0);
  const k2 = kidWith(3);
  refreshRequests(k2, day, { ...opts, kinds: [] });
  assert.equal(requestsOf(k2, day).open.length, 0);
});

test('a perfect photo meets a request: the villager gets it, the kid a print ticket, and every third a free frame', () => {
  const kid = kidWith(6);
  let d = day;
  for (let i = 0; i < FRAME_EVERY; i += 1) {
    refreshRequests(kid, d, opts);
    const q = requestsOf(kid, d).open[0];
    assert.equal(giveIfAsked(kid, { critter: q.c, quality: 'good' }, d), null, 'a good photo is not enough');
    const got = giveIfAsked(kid, { critter: q.c, quality: 'perfect', map: 'bg-meadow', season: 'summer', weather: 'sunny', neg: { v: 3 } }, d);
    assert.ok(got);
    assert.equal(kid.photoReqs.given[q.by].critter, q.c);
    assert.equal(got.frame, i === FRAME_EVERY - 1);
    d = addDays(d, 1);
  }
  assert.ok(kid.owned.includes(PHOTO_FRAME_ID), 'the free frame');
  assert.equal(ticketsLeft(kid), FRAME_EVERY);
  // a ticket pays for a print instead of coins
  const id = Object.keys(kid.critterAlbum)[0];
  kid.critterAlbum[id].q = 'perfect';
  printPhoto(kid, id, null, { ticket: true });
  assert.equal(kid.spent, 0);
  assert.equal(ticketsLeft(kid), FRAME_EVERY - 1);
});

test('poses and pairs, and the words', () => {
  assert.equal(meets({ c: 'x', want: 'jump' }, { critter: 'x', quality: 'perfect', special: 'jump' }), true);
  assert.equal(meets({ c: 'x', want: 'jump' }, { critter: 'x', quality: 'perfect', special: 'eat' }), false);
  assert.equal(meets({ c: 'x', want: 'pair' }, { critter: 'x', quality: 'perfect', pair: true }), true);
  assert.match(askText({ c: 'meadow-deer', want: 'jump' }), /jumping white-tailed deer\?$/);
});
