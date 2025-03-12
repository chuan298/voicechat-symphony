// audio-processor.js
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.SEND_CHUNK_SIZE = 512;
    this.buffer = new Float32Array(0);
    // Thêm một số thuộc tính để quản lý buffer tốt hơn
    this.MAX_BUFFER_SIZE = 1024 * 1024; // 1MB buffer limit
    this.isProcessing = true;
  }

  process(inputs, outputs, parameters) {
    if (!this.isProcessing) return true;
    
    const input = inputs[0];
    if (input.length > 0) {
      const inputData = input[0];
      
      // Kiểm tra kích thước buffer để tránh memory leak
      if (this.buffer.length + inputData.length > this.MAX_BUFFER_SIZE) {
        console.warn('Buffer overflow, resetting buffer');
        this.buffer = new Float32Array(0);
        return true;
      }

      // Nối dữ liệu mới vào buffer
      const newBuffer = new Float32Array(this.buffer.length + inputData.length);
      newBuffer.set(this.buffer);
      newBuffer.set(inputData, this.buffer.length);
      this.buffer = newBuffer;

      try {
        while (this.buffer.length >= this.SEND_CHUNK_SIZE) {
          const chunk = this.buffer.slice(0, this.SEND_CHUNK_SIZE);
          const int16Chunk = this.floatTo16BitPCM(chunk);
          
          this.port.postMessage({
            type: 'audio-data',
            data: int16Chunk.buffer
          }, [int16Chunk.buffer]);

          this.buffer = this.buffer.slice(this.SEND_CHUNK_SIZE);
        }
      } catch (error) {
        console.error('Error processing audio:', error);
        this.port.postMessage({ type: 'error', error: error.message });
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