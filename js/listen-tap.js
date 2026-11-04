// Passes the microphone's samples to the page in blocks: of 2048 for Google's sound
// recognizer (hear.js), or of 10 ms for the note finder (listen.js), which also gets the
// audio clock's frame number of each block's end, so every note has an exact time.
class Tap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { size = 2048, stamp = false } = options?.processorOptions || {};
    this.buf = new Float32Array(size);
    this.stamp = stamp;
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.stamp ? { samples: this.buf.slice(), end: currentFrame + i + 1 } : this.buf.slice());
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('kq-tap', Tap);
