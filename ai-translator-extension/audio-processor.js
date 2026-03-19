// ==========================================
// audio-processor.js — AudioWorkletProcessor
// Chay trong audio thread rieng (hien dai, thay ScriptProcessor)
// Gom 4096 sample → gui ve content.js qua MessagePort
// ==========================================

class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 4096; // Tuong duong ScriptProcessor(4096)
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0]; // Float32Array, 128 samples moi lan

    // Gom du 4096 samples thi gui 1 lan
    for (let i = 0; i < samples.length; i++) {
      this._buffer.push(samples[i]);
    }

    if (this._buffer.length >= this._bufferSize) {
      const chunk = new Float32Array(this._buffer.splice(0, this._bufferSize));
      // Transferable: zero-copy, khong copy buffer qua main thread
      this.port.postMessage({ audioData: chunk }, [chunk.buffer]);
    }

    return true; // Giu processor song mai
  }
}

registerProcessor('mic-processor', MicProcessor);
