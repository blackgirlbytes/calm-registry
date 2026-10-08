// Converts mic audio (at the AudioContext rate) to 16 kHz mono linear16 and posts ~50 ms chunks.
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 800;

class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.position = 0;
    this.chunk = new Int16Array(CHUNK_SAMPLES);
    this.filled = 0;
    this.last = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    // Linear interpolation is plenty for speech recognition.
    while (this.position < input.length - 1) {
      const i = Math.floor(this.position);
      const frac = this.position - i;
      // position can dip just below 0 at a block boundary; the previous block's last sample fills in.
      const a = i < 0 ? this.last : input[i];
      const value = a + (input[i + 1] - a) * frac;
      const clamped = Math.max(-1, Math.min(1, value));
      this.chunk[this.filled++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this.filled === CHUNK_SAMPLES) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Int16Array(CHUNK_SAMPLES);
        this.filled = 0;
      }
      this.position += this.ratio;
    }
    this.position -= input.length;
    this.last = input[input.length - 1];
    return true;
  }
}

registerProcessor("voice-capture", VoiceCapture);
