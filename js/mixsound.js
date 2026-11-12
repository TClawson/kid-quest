// How a recording-studio mix sounds: each clip's sound (a song's part, a backing track, the
// kid's notes) rendered once through, and a whole mix rendered into one piece of sound (for
// the turntable in the buddy's house, turntable.js). The studio (studio.js) plays its mixes
// clip by clip, live, from the same renderings. Also a Note-o-Matic tune as one piece of sound.

import { renderPart, renderEvents, partStyle } from './music.js';
import {
  schedule, findClip, mixSeconds, trackGain, TRACKS, backingBeats, clipSwing, roleLevel, NOTES_VOICE, notesVoice,
  mostNotesBeats, pacedNotes, paceOf, READING_VOICES,
} from './studiorules.js';
import { LOOPS, BACKING, backingEvents } from './studiokit.js';
import { partEvents, clipSound, backingKey, keyTonic } from './remix.js';
import { softClip } from './studio-audio.js';

/**
 * What a ready-made clip sounds like, in a mix in key `mixKey`: { kind, song, part, pattern,
 * loop, tonic (the key note a backing track's chords are on), voice, kit, shift }. Two clips
 * with the same sound share one rendering.
 */
export function soundOf(c, mixKey, swing = 0) {
  // (a notes clip's voice is the one it plays in: the kid's, else its own)
  const how = { voice: (c.kind === 'notes' ? notesVoice(c) : c.voice) || '', kit: c.kit || '', shift: c.shift || 0 };
  if (c.kind === 'part') return { kind: 'part', song: c.song, part: c.part, ...how };
  // the kid's notes: their name (nid) says which notes, so copies share one rendering
  // (and their role says how loud they play: a band part sits under its tune, studiorules.js roleLevel)
  // (at its pace: half or double speed plays the same notes later or sooner, setPace)
  if (c.kind === 'notes') return { kind: 'notes', nid: c.nid, notes: pacedNotes(c), beats: c.total, role: c.role || '', pace: paceOf(c) || '', swing, ...how };
  const notes = clipSound(c) === 'notes';
  const loop = notes ? (LOOPS[c.loop] ? c.loop : 'sunny') : '';
  // a backing track swings with the mix's song parts (studiorules.js backingSwing)
  return { kind: 'backing', pattern: c.pattern, loop, tonic: notes ? keyTonic(backingKey(mixKey, LOOPS[loop].mood)) : '', swing, ...how };
}

/** A clip's sound in a mix (a backing track, and the kid's notes on straight eighths, swing with it). */
export const mixSound = (c, mix) => soundOf(c, mix.key, clipSwing(mix, c));

/** Where a sound at a speed is kept among the rendered ones. */
export const soundKey = (s, bpm) => [s.kind, s.song || s.pattern || s.nid, s.part || '', bpm, s.voice, s.kit, s.shift, s.loop || '', s.tonic ?? '', s.swing || 0, s.kind === 'notes' ? `${s.beats}:${s.notes.length}:${s.role || ''}:${s.pace || ''}` : ''].join('|');

/**
 * Render a ready-made clip's sound once through. A song's part in its own sound, not moved,
 * is the song itself (music.js renderPart); anything else is played from its notes.
 */
export function renderSound(s, bpm, rate, alive = null) {
  if (s.kind === 'notes') {
    // (never longer than a loop can be, whatever was stored)
    return renderEvents(s.notes, { bpm, steps: Math.min(s.beats, mostNotesBeats(4)) * 2, swing: s.swing || 0, sampleRate: rate, alive, voice: s.voice || NOTES_VOICE, shift: s.shift, peak: 0.5 * roleLevel(s.role) });
  }
  if (s.kind === 'part') {
    if (!s.voice && !s.kit && !s.shift) return renderPart(s.song, s.part, bpm, rate, 0.5, alive);
    const style = partStyle(s.song, s.part);
    const events = partEvents(s.song, s.part);
    const common = { bpm, steps: style.steps, swing: style.swing, sampleRate: rate, alive };
    if (clipSound(s) === 'drums') return renderEvents(events, { ...common, kit: s.kit || null, vol: style.drumVol });
    // its own sound keeps the song's echo; a new voice plays without it
    return renderEvents(events, { ...common, voice: s.voice || style.voice, shift: s.shift, echo: s.voice ? 0 : style.echo });
  }
  const b = BACKING[s.pattern];
  const steps = backingBeats(s.pattern) * 2;
  const common = { bpm, steps, swing: s.swing || 0, sampleRate: rate, alive };
  if (b.kind === 'drums') return renderEvents(backingEvents(s.pattern), { ...common, kit: s.kit || null });
  return renderEvents(backingEvents(s.pattern, { loop: s.loop, tonic: s.tonic }), { ...common, voice: s.voice || b.voice, shift: s.shift });
}

// ---------- whole pieces, for the turntable ----------

export const MIX_LEVEL = 0.4; // a mix's loudness, as on the studio's desk (studio.js audio)
export const RECORD_PEAK = 0.5; // how loud the loudest moment of a finished piece is
const MOST_LIFT = 2.5; // a quiet piece is lifted at most this much
const FADE = 0.005; // each clip's ends, so nothing clicks

/** A piece of sound brought to RECORD_PEAK at its loudest (a quiet one lifted at most MOST_LIFT times). */
function level(buf, peak = RECORD_PEAK) {
  const data = buf.getChannelData(0);
  let top = 0;
  for (let i = 0; i < data.length; i += 1) { const a = Math.abs(data[i]); if (a > top) top = a; }
  if (top > 0) { const g = Math.min(MOST_LIFT, peak / top); for (let i = 0; i < data.length; i += 1) data[i] *= g; }
  return buf;
}

/**
 * A whole studio mix, once through, as one AudioBuffer (mono, at `rate`), with each track at
 * its own loudness as on the desk. A take's sound comes from loadTake(id) ({ samples, rate }
 * or null: then it stays quiet). A take that starts a little before the loop's first beat
 * (its lead) starts the piece. Null when there is nothing in the mix to play.
 */
export async function renderMix(mix, { rate = 44100, loadTake = async () => null } = {}) {
  const plan = schedule(mix);
  if (!plan.length) return null;
  const pre = Math.max(0, ...plan.map((e) => -e.at));
  const seconds = pre + mixSeconds(mix) + 0.3;
  const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const net = off.createWaveShaper();
  net.curve = softClip();
  const master = off.createGain();
  master.gain.value = MIX_LEVEL;
  master.connect(net).connect(off.destination);
  const lanes = Array.from({ length: TRACKS }, (_, t) => {
    const g = off.createGain();
    g.gain.value = trackGain(mix, t);
    g.connect(master);
    return g;
  });
  const sounds = await Promise.all(plan.map(async (e) => {
    try {
      if (e.kind === 'take') {
        const t = await loadTake(e.take);
        if (!t?.samples?.length) return null;
        const b = off.createBuffer(1, t.samples.length, t.rate);
        b.copyToChannel(t.samples, 0);
        return b;
      }
      const found = findClip(mix, e.id);
      return found ? await renderSound(mixSound(found.clip, mix), mix.bpm, rate) : null;
    } catch { return null; }
  }));
  let any = false;
  plan.forEach((e, i) => {
    const b = sounds[i];
    if (!b) return;
    const when = pre + e.at;
    const len = Math.min(e.dur, b.duration - e.offset);
    if (!(len > 0.01) || when < 0) return;
    const src = off.createBufferSource();
    src.buffer = b;
    const g = off.createGain();
    const sharp = e.kind !== 'take' && e.offset === 0;
    g.gain.setValueAtTime(sharp ? 1 : 0, when);
    g.gain.linearRampToValueAtTime(1, when + FADE);
    g.gain.setValueAtTime(1, when + len - FADE);
    g.gain.linearRampToValueAtTime(0, when + len);
    src.connect(g).connect(lanes[e.track] || master);
    src.start(when, e.offset, len);
    any = true;
  });
  if (!any) return null;
  return level(await off.startRendering());
}

/**
 * A Note-o-Matic tune (tunerules.js), once through, as one AudioBuffer: its tune in its voice
 * and shift, and a band under it, as the robot plays it (notolab.js). Null when it can't be made.
 */
export async function renderTune(tune, { rate = 44100 } = {}) {
  const parts = (tune?.parts || []).filter((p) => p.notes?.length);
  if (!parts.length) return null;
  const bufs = await Promise.all(parts.map((p) => renderEvents(p.notes, {
    bpm: tune.bpm,
    steps: Math.max(1, p.beats) * 2,
    voice: p.role === 'band' ? READING_VOICES.band.band : tune.voice,
    shift: p.role === 'band' ? 0 : tune.shift || 0,
    sampleRate: rate,
    peak: 0.5 * roleLevel(p.role),
  })));
  const len = Math.max(...bufs.map((b) => b.length));
  const off = new OfflineAudioContext(1, len, rate);
  for (const b of bufs) {
    const src = off.createBufferSource();
    src.buffer = b;
    src.connect(off.destination);
    src.start(0);
  }
  return level(await off.startRendering());
}
