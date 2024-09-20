class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.bufferSize = 4096;
      this.buffer = new Float32Array(this.bufferSize);
      this.bufferIndex = 0;
    }
  
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const channel = input[0];
  
      if (channel) {
        for (let i = 0; i < channel.length; i++) {
          this.buffer[this.bufferIndex] = channel[i];
          this.bufferIndex++;
  
          if (this.bufferIndex >= this.bufferSize) {
            this.port.postMessage({
              eventType: 'audio',
              audioData: this.buffer
            });
            this.bufferIndex = 0;
          }
        }
      }
  
      return true;
    }
  }
  
  registerProcessor('audio-processor', AudioProcessor);