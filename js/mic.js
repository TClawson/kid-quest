// The tablet's microphone for recording a piano: opened with the voice filters off and heard
// through the 'kq-tap' worklet (listen-tap.js). The recording studio (studio.js) and the
// parent's test recording in Settings (testrec.js) both use it, so they hear the same sound.

const tapReady = new WeakMap(); // AudioContext -> Promise of the worklet module loaded in it

/** Open the microphone with the voice filters off (they spoil a piano). */
export function openMic() {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(Object.assign(new Error('no microphone'), { name: 'NotSupported' }));
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
}

/**
 * Listen to the microphone through the 'kq-tap' worklet: every block comes with the audio
 * clock's frame number, so every sample's time is known. `onBlock` (if given) is told of each
 * block as it arrives. Returns { blocks, lastFrame(), stop() }.
 */
export async function capture(ac, stream, onBlock) {
  if (!tapReady.has(ac)) {
    tapReady.set(ac, ac.audioWorklet.addModule(new URL('./listen-tap.js', import.meta.url)).catch((e) => { tapReady.delete(ac); throw e; }));
  }
  await tapReady.get(ac);
  const src = ac.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(ac, 'kq-tap', { processorOptions: { size: Math.round(ac.sampleRate / 100), stamp: true } });
  const mute = ac.createGain();
  mute.gain.value = 0; // keeps the worklet running without playing the microphone out loud
  src.connect(tap).connect(mute).connect(ac.destination);
  const blocks = [];
  tap.port.onmessage = ({ data }) => { if (data?.samples) { blocks.push(data); onBlock?.(data); } };
  return {
    blocks,
    lastFrame: () => (blocks.length ? blocks[blocks.length - 1].end : 0),
    stop() {
      tap.port.onmessage = null;
      try { src.disconnect(); tap.disconnect(); mute.disconnect(); } catch { /* gone */ }
      stream.getTracks().forEach((t) => t.stop()); // the microphone light goes out
    },
  };
}
