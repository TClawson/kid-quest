import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, SHOW_SONGS } from '../js/songs.js';
import {
  TRACKS, MAX_SECONDS, newMix, sourceOf, maxBars, mixBeats, mixSeconds, addPart, addTake, moveClip, trimClip, copyClip,
  removeClip, setBars, setBpm, isFree, freeSpot, roomAt, bestSpot, findClip, takesIn, keyFits, schedule, badges, cleanMix,
  shelfSongs,
} from '../js/studiorules.js';
import { MUSIC_TIERS } from '../js/musicrules.js';

const must = (r) => { assert.equal(r.error, null, r.error || ''); return r; };

test('every song is a source of parts, and no loop is longer than 30 seconds', () => {
  for (const id of [...Object.keys(SONGS), ...Object.keys(SHOW_SONGS).map((k) => `show:${k}`)]) {
    const src = sourceOf(id);
    assert.ok(src.name && src.key && src.bpm > 0 && [3, 4].includes(src.meter), id);
    assert.equal(src.beats % src.meter, 0, `${id}: whole bars`);
    const { mix } = must(addPart(newMix(), 0, id, 'lead'));
    assert.ok(mixSeconds(mix) <= MAX_SECONDS + 1e-9, `${id}: ${mixSeconds(mix)} s`);
    assert.deepEqual([mix.bpm, mix.meter, mix.key], [src.bpm, src.meter, src.key], 'the first part sets the speed, the beat and the key');
    assert.equal(mix.tracks[0][0].len, Math.min(src.beats, mixBeats(mix)));
  }
  assert.equal(sourceOf('nope'), null);
  assert.equal(maxBars(120, 4), 15);
  assert.equal(maxBars(96, 4), 12);
  assert.equal(maxBars(100, 3), 16);
  assert.equal(maxBars(10, 4), 2, 'never under 2 bars');
  // the waltz has three beats in a bar; a show tune's loop is as long as the tune
  assert.equal(sourceOf('bg-ocean').meter, 3);
  assert.equal(must(addPart(newMix(), 0, 'show:bg-meadow', 'lead')).mix.bars, 5);
  assert.equal(must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix.bars, 8);
});

test('clips never overlap: adding, moving and copying find free room or are turned down', () => {
  let mix = newMix();
  assert.equal(mix.tracks.length, TRACKS);
  let r = must(addPart(mix, 0, 'bg-meadow', 'lead'));
  mix = r.mix;
  assert.deepEqual(findClip(mix, r.id), { clip: { id: 1, kind: 'part', song: 'bg-meadow', part: 'lead', start: 0, len: 32, from: 0, total: 64 }, track: 0 });
  assert.equal(addPart(mix, 0, 'bg-meadow', 'bass').error, 'That track is full.');
  assert.equal(addPart(mix, 1, 'bg-ocean', 'lead').error, "Bubble Waltz has 3 beats in a bar, and this mix has 4. They can't play together.");
  assert.equal(addPart(mix, 1, 'nope', 'lead').error, 'That song is not in the studio.');
  // a show tune (5 bars) on track 2 at beat 4: 20 beats; a second one goes in after it, cut to the room left
  r = must(addPart(mix, 1, 'show:bg-meadow', 'lead', 4));
  mix = r.mix;
  assert.deepEqual([mix.tracks[1][0].start, mix.tracks[1][0].len], [4, 20]);
  r = must(addPart(mix, 1, 'show:bg-meadow', 'arp', 6));
  mix = r.mix;
  assert.deepEqual(mix.tracks[1].map((c) => [c.start, c.len]), [[4, 20], [24, 8]], 'the next free beat, and only as long as the room');
  assert.equal(isFree(mix, 1, 0, 4), true);
  assert.equal(isFree(mix, 1, 0, 5), false);
  assert.equal(isFree(mix, 1, 30, 4), false, 'not past the end of the loop');
  assert.equal(roomAt(mix, 1, 0), 4);
  assert.equal(roomAt(mix, 1, 10), 0);
  assert.equal(freeSpot(mix, 1, 4, 10), 0, 'wraps round to the start');
  assert.equal(freeSpot(mix, 1, 5), -1);
  // moving: snapped to a beat, kept inside the loop, and never onto another clip
  const id = mix.tracks[1][1].id;
  assert.equal(moveClip(mix, id, 1, 10).error, 'Something is already there.');
  assert.equal(moveClip(mix, id, 0, 0).error, 'Something is already there.');
  r = must(moveClip(mix, id, 2, 30.4));
  assert.deepEqual([findClip(r.mix, id).track, findClip(r.mix, id).clip.start], [2, 24], 'pulled back inside the loop');
  r = must(moveClip(mix, id, 3, 2.6));
  assert.equal(findClip(r.mix, id).clip.start, 3);
  assert.equal(moveClip(mix, 99, 0, 0).error, 'That clip is gone.');
  // copying: right after itself when there is room, else the first free place on another track
  r = must(copyClip(r.mix, id));
  assert.deepEqual(r.mix.tracks[3].map((c) => [c.start, c.len]), [[3, 8], [11, 8]]);
  const full = must(copyClip(mix, 1));
  assert.equal(findClip(full.mix, full.id).track, 2, 'track 1 is full, track 2 has no room for 32 beats, track 3 has');
  assert.notEqual(full.id, 1);
  // nothing above changed the mix it was given
  assert.deepEqual(mix.tracks[1].map((c) => c.start), [4, 24]);
  // removing
  assert.equal(findClip(must(removeClip(mix, id)).mix, id), null);
});

test('trimming: either edge, by whole beats, never past the source, a neighbour or the loop', () => {
  let { mix, id } = must(addPart(newMix(), 0, 'bg-meadow', 'lead'));
  // the back edge
  mix = must(trimClip(mix, id, { len: 8 })).mix;
  assert.deepEqual(findClip(mix, id).clip, { id, kind: 'part', song: 'bg-meadow', part: 'lead', start: 0, len: 8, from: 0, total: 64 });
  // the front edge: start and from move together, the end stays
  mix = must(trimClip(mix, id, { start: 3 })).mix;
  assert.deepEqual([findClip(mix, id).clip.start, findClip(mix, id).clip.len, findClip(mix, id).clip.from], [3, 5, 3]);
  // back out again, but no earlier than the part's own first beat
  mix = must(trimClip(mix, id, { start: -4 })).mix;
  assert.deepEqual([findClip(mix, id).clip.start, findClip(mix, id).clip.len, findClip(mix, id).clip.from], [0, 8, 0]);
  // never under one beat
  assert.equal(findClip(must(trimClip(mix, id, { len: 0 })).mix, id).clip.len, 1);
  assert.equal(findClip(must(trimClip(mix, id, { start: 20 })).mix, id).clip.len, 1);
  // a neighbour stops it, and so does the loop's end
  const two = must(addPart(mix, 0, 'bg-meadow', 'bass', 12));
  assert.equal(findClip(must(trimClip(two.mix, id, { len: 30 })).mix, id).clip.len, 12);
  assert.equal(findClip(must(trimClip(mix, id, { len: 99 })).mix, id).clip.len, 32);
  // a moved clip that starts mid-part can't grow past the part's end
  let moved = must(trimClip(mix, id, { start: 4 })).mix; // from 4, len 4
  moved = must(moveClip(moved, id, 0, 0)).mix;
  moved = must(setBars(moved, 15)).mix;
  assert.equal(findClip(must(trimClip(moved, id, { len: 99 })).mix, id).clip.len, 60, '64 beats in the part, 4 trimmed off its front');
  // the front edge stops at the clip before it
  const pair = must(addPart(must(trimClip(must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix, 1, { len: 4 })).mix, 0, 'bg-meadow', 'bass', 8));
  const b = must(trimClip(pair.mix, pair.id, { start: 12 })).mix; // bass now from 4
  assert.equal(findClip(must(trimClip(b, pair.id, { start: 0 })).mix, pair.id).clip.start, 8, 'back to its own first beat');
});

test('takes: placed where there is room, and they pin the speed', () => {
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix;
  const r = must(addTake(mix, 1, 'take-a', 15.2, 4));
  mix = r.mix;
  assert.deepEqual(findClip(mix, r.id).clip, { id: r.id, kind: 'take', take: 'take-a', start: 4, len: 16, from: 0, total: 16 });
  assert.match(addTake(mix, 1, 'take-b', 8, 6).error, /no room/);
  const cut = must(addTake(mix, 1, 'take-b', 8, 0));
  assert.deepEqual([findClip(cut.mix, cut.id).clip.len, findClip(cut.mix, cut.id).clip.total], [4, 8], 'cut to the room, the rest kept to trim back');
  assert.deepEqual(takesIn(cut.mix).sort(), ['take-a', 'take-b']);
  assert.match(setBpm(mix, 100).error, /speed stays/);
  // without a take the speed changes, and the loop stays within 30 seconds
  let free = must(setBars(must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix, 16)).mix;
  assert.equal(free.bars, 16);
  free = must(trimClip(free, 1, { len: 64 })).mix;
  assert.equal(findClip(free, 1).clip.len, 64);
  free = must(setBpm(free, 80)).mix;
  assert.deepEqual([free.bpm, free.bars], [80, 10]);
  assert.ok(mixSeconds(free) <= MAX_SECONDS);
  assert.equal(findClip(free, 1).clip.len, 40, 'the clip is cut at the new end');
  assert.equal(must(setBpm(free, 999)).mix.bpm, 170);
  assert.equal(must(setBars(free, 1)).mix.bars, 2);
  assert.equal(must(setBars(free, 99)).mix.bars, maxBars(80, 4));
  // a take a hair over its whole beats doesn't get an extra beat
  assert.equal(must(addTake(newMix(), 0, 't', 8.0004, 0)).mix.tracks[0][0].total, 8);
  assert.equal(must(addTake(newMix(), 0, 't', 8.01, 0)).mix.tracks[0][0].total, 9);
  // a take can keep a little sound from before its beat
  assert.equal(must(addTake(newMix(), 0, 't', 4, 0, { lead: 0.06 })).mix.tracks[0][0].lead, 0.06);
  assert.equal('lead' in must(addTake(newMix(), 0, 't', 4, 0)).mix.tracks[0][0], false);
});

test('a shorter loop or a slower speed never throws music away', () => {
  // 8 bars with a take in the last bar
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix;
  mix = must(addTake(mix, 1, 'take-x', 4, 28)).mix;
  const r = setBars(mix, 7);
  assert.equal(r.error, 'Move or delete the music in the last bar first.');
  assert.equal(r.mix, mix, 'the mix stays as it was');
  // a clip that only reaches past the new end is cut there, and keeps the rest to trim back
  mix = must(moveClip(mix, mix.tracks[1][0].id, 1, 26)).mix;
  const cut = must(setBars(mix, 7)).mix;
  assert.deepEqual([cut.tracks[1][0].start, cut.tracks[1][0].len, cut.tracks[1][0].total], [26, 2, 4]);
  assert.equal(cut.tracks[0][0].len, 28);
  assert.equal(must(setBars(cut, 8)).mix.tracks[1][0].len, 2, 'longer again: trim it back by hand');
  // slower would make 15 bars at 168 longer than 30 seconds: only when the last bars are empty
  let fast = must(addPart(newMix(), 0, 'show:bg-space', 'lead')).mix;
  fast = must(setBars(fast, maxBars(fast.bpm, 4))).mix;
  const bars = fast.bars;
  const full = must(addPart(fast, 1, 'show:bg-space', 'bass', mixBeats(fast) - 4)).mix;
  const slow = setBpm(full, 120);
  assert.equal(slow.error, 'That would make your loop longer than 30 seconds. Make the loop shorter first.');
  assert.equal(slow.mix, full);
  const ok = must(setBpm(fast, 120)).mix;
  assert.deepEqual([ok.bpm, ok.bars], [120, maxBars(120, 4)], `fewer bars than ${bars} when nothing is in them`);
});

test('where new music goes: an empty track first, then the longest free stretch', () => {
  let mix = newMix();
  assert.deepEqual(bestSpot(mix), { track: 0, beat: 0, room: 32 });
  mix = must(addPart(mix, 0, 'bg-meadow', 'lead')).mix;
  assert.deepEqual(bestSpot(mix), { track: 1, beat: 0, room: 32 });
  // every track has something: the longest gap wins, a tie goes to the lower track
  mix = must(trimClip(mix, 1, { len: 20 })).mix; // track 1: 12 free from beat 20
  mix = must(addTake(mix, 1, 'a', 8, 0)).mix; // track 2: 24 free from beat 8
  mix = must(addTake(mix, 2, 'b', 8, 4)).mix; // track 3: 4 free, then 20 from beat 12
  mix = must(addTake(mix, 3, 'c', 8, 8)).mix; // track 4: 8 free, then 16
  assert.deepEqual(bestSpot(mix), { track: 1, beat: 8, room: 24 });
  mix = must(addTake(mix, 1, 'd', 4, 28)).mix; // track 2: 20 from beat 8 now, like track 3's
  assert.deepEqual(bestSpot(mix), { track: 1, beat: 8, room: 20 });
  // every track full
  let full = newMix();
  for (let t = 0; t < TRACKS; t += 1) full = must(addTake(full, t, `t${t}`, 32, 0)).mix;
  assert.equal(bestSpot(full), null);
  // a place with no start is never free
  assert.equal(isFree(newMix(), 0, NaN, 4), false);
  assert.equal(isFree(newMix(), 0, 0, NaN), false);
});

test('what to play: every clip with its time, its place in the source and its length', () => {
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix; // 132 bpm
  mix = must(trimClip(mix, 1, { start: 4 })).mix;
  mix = must(addTake(mix, 2, 'take-a', 8, 2)).mix;
  const beat = 60 / 132;
  assert.deepEqual(schedule(mix), [
    { id: 2, track: 2, kind: 'take', song: undefined, part: undefined, take: 'take-a', at: 2 * beat, offset: 0, dur: 8 * beat },
    { id: 1, track: 0, kind: 'part', song: 'bg-meadow', part: 'lead', take: undefined, at: 4 * beat, offset: 4 * beat, dur: 28 * beat },
  ]);
  // a take with a lead starts that much before its beat, from the start of its sound
  const lead = 0.06;
  let early = must(addTake(must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix, 2, 'take-b', 8, 2, { lead })).mix;
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is ${b}`);
  let e = schedule(early).find((x) => x.take === 'take-b');
  near(e.at, 2 * beat - lead);
  near(e.offset, 0);
  near(e.dur, 8 * beat + lead);
  // trimmed at the front, it starts on its beat, past the lead and the trimmed beats
  early = must(trimClip(early, e.id, { start: 3 })).mix;
  e = schedule(early).find((x) => x.take === 'take-b');
  near(e.at, 3 * beat);
  near(e.offset, lead + beat);
  near(e.dur, 7 * beat);
  // a part never has a lead
  assert.equal(schedule(early).find((x) => x.kind === 'part').at, 0);
});

test('keys that go together, and the stickers a mix earns', () => {
  assert.equal(keyFits('C', 'Am'), true);
  assert.equal(keyFits('C', 'G'), false);
  assert.equal(keyFits('Dm', 'F'), true);
  assert.equal(keyFits(null, 'G'), true);
  const names = (mix) => badges(mix).map((b) => b.id);
  let mix = newMix();
  assert.deepEqual(names(mix), []);
  mix = must(addPart(mix, 0, 'bg-meadow', 'lead')).mix; // C
  mix = must(addPart(mix, 1, 'bg-meadow', 'bass')).mix;
  assert.deepEqual(names(mix), []);
  mix = must(addPart(mix, 2, 'bg-meadow', 'drums')).mix;
  assert.deepEqual(names(mix), ['band']);
  const remix = must(addPart(mix, 3, 'bg-space', 'arp')).mix; // A minor: the same key signature
  assert.deepEqual(names(remix), ['band', 'remix', 'match']);
  const clash = must(addPart(mix, 3, 'bg-galaxy', 'arp')).mix; // G
  assert.deepEqual(names(clash), ['band', 'remix']);
  const duet = must(addTake(must(removeClip(mix, 3)).mix, 3, 't', 8, 0)).mix;
  assert.deepEqual(names(duet), ['take', 'duet']);
  let solo = newMix();
  for (let t = 0; t < TRACKS; t += 1) solo = must(addTake(solo, t, `t${t}`, 8, 0)).mix;
  assert.deepEqual(names(solo), ['take', 'solo']);
  for (const b of badges(remix)) assert.ok(b.name && b.why);
});

test('a mix read back from storage is tidied, never trusted', () => {
  const made = must(addTake(must(addPart(newMix('Beach jam'), 0, 'bg-sunset', 'lead')).mix, 1, 'take-a', 8, 4)).mix;
  assert.deepEqual(cleanMix(JSON.parse(JSON.stringify(made))), made);
  assert.deepEqual(cleanMix(null), newMix());
  assert.deepEqual(cleanMix({ tracks: 'x' }), newMix());
  const messy = cleanMix({
    name: 'x'.repeat(99), bpm: 9999, meter: 7, bars: 500,
    tracks: [
      [{ kind: 'part', song: 'bg-meadow', part: 'lead', start: 0, len: 8, from: 0, total: 64 }, { kind: 'part', song: 'bg-meadow', part: 'bass', start: 4, len: 8, from: 0, total: 64 }],
      [{ kind: 'part', song: 'gone', part: 'lead', start: 0, len: 8, from: 0, total: 64 }, { kind: 'part', song: 'bg-meadow', part: 'kazoo', start: 0, len: 8, from: 0, total: 64 }],
      [{ kind: 'take', take: 't', start: 0, len: 8, from: 4, total: 8 }, { kind: 'take', take: 5, start: 0, len: 4, from: 0, total: 4 }, null],
      [], [{ kind: 'take', take: 'fifth-track', start: 0, len: 4, from: 0, total: 4 }],
    ],
  });
  assert.equal(messy.name.length, 24);
  assert.deepEqual([messy.bpm, messy.meter, messy.bars], [170, 4, maxBars(170, 4)]);
  assert.deepEqual(messy.tracks.map((t) => t.length), [1, 0, 0, 0], 'the overlap, the unknown song and part, the take longer than its sound and the fifth track are dropped');
  assert.equal(messy.next, 2);
});

test('bad data in storage can never stop the studio from opening', () => {
  const part = (more) => ({ kind: 'part', song: 'bg-meadow', part: 'lead', start: 0, len: 8, from: 0, total: 64, ...more });
  const take = (more) => ({ kind: 'take', take: 'take-a', start: 0, len: 4, from: 0, total: 4, ...more });
  const mix = (tracks, more) => cleanMix({ v: 1, name: 'Odd', bpm: 120, meter: 4, bars: 8, key: 'C', tracks, ...more });
  const count = (m) => m.tracks.flat().length;
  // a key no song uses: the first part's song key instead, or none
  assert.equal(mix([[part()], [], [], []], { key: 'H' }).key, sourceOf('bg-meadow').key);
  assert.equal(mix([[], [], [], []], { key: 'H' }).key, null);
  assert.equal(mix([[], [], [], []], { key: { toString: () => 'C' } }).key, null);
  assert.equal(mix([[part()], [], [], []], { key: 'G' }).key, 'G', 'a real key stays');
  // numbers that are missing, not whole, or not numbers at all
  for (const bad of [{ start: undefined }, { start: NaN }, { start: 1.5 }, { start: '0' }, { len: Infinity }, { from: null }, { total: undefined }, { start: -4 }]) {
    assert.equal(count(mix([[part(bad)], [], [], []])), 0, JSON.stringify(bad));
    assert.equal(count(mix([[take(bad)], [], [], []])), 0, `take ${JSON.stringify(bad)}`);
  }
  // part names that are really an object's insides, songs that aren't songs
  assert.equal(count(mix([[part({ part: 'constructor' })], [part({ part: 'toString' })], [part({ song: 'constructor' })], [part({ song: 'show:__proto__' })]])), 0);
  // a part with another beat than the mix (a waltz in a four-beat mix)
  assert.equal(count(mix([[part({ song: 'bg-ocean', total: 48 })], [], [], []])), 0);
  // a part longer than its song is cut to the song
  const long = mix([[part({ len: 60, total: 9999 })], [], [], []], { bars: 15 });
  assert.deepEqual([long.tracks[0][0].len, long.tracks[0][0].total], [60, 64]);
  assert.equal(count(mix([[part({ from: 64, len: 4, total: 9999 })], [], [], []])), 0, 'nothing of the song is left');
  // a clip over an earlier one on the same track goes, the first stays
  const both = mix([[part(), part({ part: 'bass', start: 4 })], [], [], []]);
  assert.deepEqual(both.tracks[0].map((c) => c.part), ['lead']);
  // a take's lead: kept when it is a small number of seconds
  assert.equal(mix([[take({ lead: 0.06 })], [], [], []]).tracks[0][0].lead, 0.06);
  for (const lead of [-1, 0.5, NaN, '0.06', null]) assert.equal('lead' in mix([[take({ lead })], [], [], []]).tracks[0][0], false, String(lead));
  // what is kept always plays: every clip has a real time
  for (const e of schedule(mix([[part()], [take({ start: 8, lead: 0.06 })], [], []]))) assert.ok([e.at, e.offset, e.dur].every(Number.isFinite));
});

// ---------- keeping mixes and takes (here without IndexedDB: in memory) ----------

test('sound keeps its shape as 16-bit numbers', async () => {
  const { floatToPcm, pcmToFloat } = await import('../js/studio-store.js');
  const wave = Float32Array.from({ length: 200 }, (_, i) => Math.sin(i / 7) * 0.8);
  const back = pcmToFloat(floatToPcm(wave));
  assert.ok(wave.every((x, i) => Math.abs(x - back[i]) < 1 / 32000));
  assert.deepEqual([...floatToPcm(Float32Array.of(2, -2, 0))], [32767, -32767, 0], 'too loud is held at the top');
});

test('mixes and takes are kept per kid, and takes no mix uses are swept away', async () => {
  const { loadMixes, saveMix, deleteMix, saveTake, loadTake, sweepTakes } = await import('../js/studio-store.js');
  assert.deepEqual(await loadMixes('ava'), { draft: null, slots: [null, null, null] });
  const a = await saveTake('ava', Float32Array.of(0, 0.5, -0.5), 48000);
  const b = await saveTake('ava', Float32Array.of(0.25), 48000, 0.06);
  const other = await saveTake('ben', Float32Array.of(0.1), 44100);
  assert.notEqual(a, b);
  const take = await loadTake(a);
  assert.equal(take.rate, 48000);
  assert.ok(Math.abs(take.samples[1] - 0.5) < 1e-4 && take.samples.length === 3);
  assert.equal(await loadTake('nope'), null);
  assert.deepEqual([take.lead, (await loadTake(b)).lead], [0, 0.06], 'a take keeps its lead');
  // the draft uses take a, slot 1 uses take b
  const draft = must(addTake(must(addPart(newMix('Draft'), 0, 'bg-meadow', 'lead')).mix, 1, a, 8, 0)).mix;
  const kept = must(addTake(newMix('Kept'), 0, b, 4, 0)).mix;
  await saveMix('ava', 'draft', draft);
  await saveMix('ava', 1, kept);
  assert.deepEqual(await loadMixes('ava'), { draft, slots: [null, kept, null] });
  assert.deepEqual(await loadMixes('ben'), { draft: null, slots: [null, null, null] }, 'another kid has their own');
  const later = { now: Date.now() + 6 * 60 * 1000 };
  assert.equal(await sweepTakes('ava', later), 0, 'both takes are in use');
  await deleteMix('ava', 1);
  assert.equal(await sweepTakes('ava'), 0, 'a take younger than five minutes is kept');
  assert.equal(await sweepTakes('ava', { ...later, keep: [b] }), 0, 'and one the screen still needs (for Undo)');
  assert.equal(await sweepTakes('ava', later), 1);
  assert.equal(await loadTake(b), null);
  assert.ok(await loadTake(a), 'the draft keeps its take');
  assert.ok(await loadTake(other), 'and another kid\'s take is never touched');
});

test('Note-o-Matic tunes are kept per kid in six slots, apart from the mixes', async () => {
  const { loadTunes, saveTune, deleteTune, loadMixes } = await import('../js/studio-store.js');
  const { cleanTune } = await import('../js/tunerules.js');
  const empty = [null, null, null, null, null, null];
  assert.deepEqual(await loadTunes('cal'), empty);
  const tune = cleanTune({ id: 'tune-a', made: 5, reading: 'tidy', bpm: 100, meter: 4, key: 'C', parts: [{ role: 'tune', notes: [{ at: 0, len: 2, midi: 60 }], beats: 4 }], voice: 'flute', shift: 0 });
  await saveTune('cal', 2, tune);
  assert.deepEqual(await loadTunes('cal'), [null, null, tune, null, null, null]);
  assert.deepEqual(await loadTunes('dee'), empty, 'another kid has their own');
  assert.deepEqual((await loadMixes('cal')).slots, [null, null, null], 'a tune is not a mix');
  await assert.rejects(saveTune('cal', 6, tune), 'there are only six slots');
  await saveTune('cal', 3, { parts: 'junk' });
  assert.equal((await loadTunes('cal'))[3], null, 'a bad save reads back as an empty slot');
  await deleteTune('cal', 2);
  assert.deepEqual(await loadTunes('cal'), empty);
});

test('a write that fails is never told as kept, and a failed read is just nothing', async () => {
  // a tablet whose storage turns every request down (like a full one)
  const store = { put: () => ({}), get: () => ({}), delete: () => ({}), index: () => ({ openCursor: () => ({}) }) };
  const db = { transaction() { const tx = { objectStore: () => store }; setTimeout(() => tx.onabort?.()); return tx; } };
  globalThis.indexedDB = { open() { const req = {}; setTimeout(() => { req.result = db; req.onsuccess(); }); return req; } };
  try {
    const m = await import('../js/studio-store.js?full-tablet');
    await assert.rejects(m.saveTake('ava', Float32Array.of(0.1), 48000));
    await assert.rejects(m.saveMix('ava', 0, newMix()));
    await assert.rejects(m.deleteMix('ava', 0));
    await assert.rejects(m.saveTune('ava', 0, { parts: [] }));
    assert.deepEqual(await m.loadTunes('ava'), [null, null, null, null, null, null]);
    assert.deepEqual(await m.loadMixes('ava'), { draft: null, slots: [null, null, null] });
    assert.equal(await m.loadTake('take-a'), null);
    await assert.rejects(m.sweepTakes('ava'), 'when the mixes can\'t be read, no take is thrown away');
  } finally {
    delete globalThis.indexedDB;
  }
});

test('the shelf has the songs open for a piano and found maps; the best piano has every song', () => {
  const maps = Object.keys(SONGS);
  const shows = Object.keys(SHOW_SONGS).map((k) => `show:${k}`);
  const ids = (list) => list.map((p) => p.id).sort();
  assert.deepEqual(shelfSongs(0), [], 'no piano: no songs');
  assert.deepEqual(ids(shelfSongs(1)), [...maps].sort(), 'the little keyboard: the map songs');
  const found = Object.keys(SHOW_SONGS)[0];
  assert.deepEqual(ids(shelfSongs(1, new Set([found]))), [...maps, `show:${found}`].sort(), 'and a show whose treasure map is found');
  assert.deepEqual(ids(shelfSongs(MUSIC_TIERS.length)), [...maps, ...shows].sort(), 'the best piano (the test desk): every song, the shows too');
  assert.ok(shelfSongs(MUSIC_TIERS.length).every((p) => sourceOf(p.id)), 'each one has parts');
});
