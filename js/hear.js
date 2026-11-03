// Google's sound recognizer (YAMNet, run by MediaPipe) in the browser. It names
// what it hears in each second of sound (piano, speech, singing, coughing and about
// 500 more). The code and the model (about 25 MB) download the first time it is
// used; the sound itself never leaves the device.

export const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.1.1';
export const YAMNET = 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite';

const PIANO = new Set(['Piano', 'Keyboard (musical)', 'Electric piano']);
const VOICE = new Set([
  'Speech', 'Child speech, kid speaking', 'Conversation', 'Narration, monologue', 'Babbling', 'Shout', 'Yell',
  'Children shouting', 'Screaming', 'Whispering', 'Laughter', 'Baby laughter', 'Giggle', 'Crying, sobbing',
  'Singing', 'Child singing', 'Choir', 'Humming', 'Vocal music', 'A capella', 'Chant', 'Whistling', 'Rapping',
  'Cough', 'Sneeze', 'Throat clearing', 'Burping, eructation', 'Hiccup', 'Breathing', 'Sigh',
]);

/** From the recognizer's categories: the piano score, the voice score, and the top three names. */
export function pianoScore(categories) {
  let piano = 0, voice = 0;
  for (const c of categories) {
    if (PIANO.has(c.categoryName)) piano = Math.max(piano, c.score);
    if (VOICE.has(c.categoryName)) voice = Math.max(voice, c.score);
  }
  const top = [...categories].sort((a, b) => b.score - a.score).slice(0, 3)
    .map((c) => ({ name: c.categoryName, score: c.score }));
  return { piano, voice, top };
}

let loading = null;

/**
 * Loads the recognizer once. Resolves to { listen(ctx, source, onScore) }, where
 * listen taps the sound and calls onScore(pianoScore(...)) about twice a second
 * with the verdict on the last second. listen resolves to a stop function.
 */
export function loadRecognizer() {
  loading ??= (async () => {
    const { AudioClassifier, FilesetResolver } = await import(`${MEDIAPIPE}/audio_bundle.mjs`);
    const files = await FilesetResolver.forAudioTasks(`${MEDIAPIPE}/wasm`);
    const classifier = await AudioClassifier.createFromOptions(files, { baseOptions: { modelAssetPath: YAMNET } });
    return { listen: (ctx, source, onScore) => listen(classifier, ctx, source, onScore) };
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

async function listen(classifier, ctx, source, onScore) {
  await ctx.audioWorklet.addModule(new URL('./listen-tap.js', import.meta.url));
  const tap = new AudioWorkletNode(ctx, 'kq-tap');
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(tap).connect(mute).connect(ctx.destination);
  // the last 0.975 s of sound: one window of the recognizer
  const ring = new Float32Array(Math.round(ctx.sampleRate * 0.975));
  let filled = 0, write = 0;
  tap.port.onmessage = ({ data }) => {
    for (let i = 0; i < data.length; i++) { ring[write] = data[i]; write = (write + 1) % ring.length; }
    filled = Math.min(ring.length, filled + data.length);
  };
  const timer = setInterval(() => {
    if (filled < ring.length) return;
    const clip = new Float32Array(ring.length);
    clip.set(ring.subarray(write));
    clip.set(ring.subarray(0, write), ring.length - write);
    const result = classifier.classify(clip, ctx.sampleRate)[0];
    const cats = result?.classifications?.[0]?.categories;
    if (cats) onScore(pianoScore(cats));
  }, 500);
  return () => {
    clearInterval(timer);
    tap.port.onmessage = null;
    try { source.disconnect(tap); tap.disconnect(); mute.disconnect(); } catch { /* already gone */ }
  };
}
