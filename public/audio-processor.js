// public/audio-processor.js
class AudioRecorderProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.SEND_CHUNK_SIZE = 512;
    }
  
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      if (input.length > 0) {
        const inputData = input[0];
        
        // Chuyển đổi float32 sang int16
        const int16Array = this.floatTo16BitPCM(inputData);
        
        // Gửi dữ liệu về main thread
        for (let i = 0; i < int16Array.length; i += this.SEND_CHUNK_SIZE) {
          const chunk = int16Array.slice(i, i + this.SEND_CHUNK_SIZE);
          this.port.postMessage({
            type: 'audio-data',
            data: chunk.buffer
          }, [chunk.buffer]);
        }
      }
      return true;
    }
  
    floatTo16BitPCM(input) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }
  }
  
  registerProcessor('audio-recorder-processor', AudioRecorderProcessor);