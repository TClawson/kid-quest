// A stand-in for the browser's AudioContext that plays nothing and writes down every sound
// the music engine starts: oscillators as { f (Hz), t (seconds), midi, swept (a kick or a tom:
// its pitch slides) }, and bursts of noise (snares and hats) as { noise: true, t }. For tests
// of what the game music plays (test/gamemusic.test.js).

const PARAMS = ['gain', 'frequency', 'Q', 'delayTime', 'detune', 'playbackRate', 'threshold', 'ratio', 'knee', 'attack', 'release'];

/** An audio node (or a param) where every method does nothing and connect() chains. */
function node(own = {}) {
  return new Proxy(own, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'connect') return (x) => x;
      if (PARAMS.includes(k)) { t[k] = node({ value: 0 }); return t[k]; }
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

/**
 * A fake AudioContext class, the list its oscillators are written to, and the contexts made
 * (set one's currentTime to move its clock).
 */
export function fakeAudio() {
  const played = [];
  const contexts = [];
  class FakeAudioContext {
    constructor() {
      contexts.push(this);
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = 'running';
      this.destination = node();
    }

    createOscillator() {
      const rec = { f: 0, t: 0, midi: 0, swept: false };
      const set = (f, t) => { if (!rec.f) { rec.f = f; rec.t = t ?? rec.t; rec.midi = Math.round(69 + 12 * Math.log2(f / 440)); } };
      const frequency = node({
        set value(f) { set(f); },
        get value() { return rec.f; },
        setValueAtTime: (f, t) => set(f, t),
        exponentialRampToValueAtTime: () => { rec.swept = true; },
        linearRampToValueAtTime: () => { rec.swept = true; },
      });
      return node({ frequency, start: (t) => { rec.t = t; played.push(rec); } });
    }

    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }

    createBufferSource() { return node({ start: (t) => { played.push({ noise: true, t }); } }); }

    resume() { return Promise.resolve(); }
  }
  for (const name of ['createGain', 'createBiquadFilter', 'createDelay', 'createDynamicsCompressor', 'createPeriodicWave']) {
    FakeAudioContext.prototype[name] = () => node();
  }
  return { FakeAudioContext, played, contexts };
}
