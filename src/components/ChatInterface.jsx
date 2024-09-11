import React, { useState, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserIcon, BotIcon, MicIcon, MicOffIcon, SendIcon } from 'lucide-react';
import ConnectionControls from './ConnectionControls';
import MessageList from './MessageList';
import { setUsername, connectWebSocket } from '../utils/api';
import { arrayBufferToBase64 } from '../utils/audioUtils';
import { encodeWAV } from '../utils/audioUtils';

const AUDIO_CHUNK_SIZE = 1024; 
const AUDIO_SAMPLE_RATE = 16000; // 16 kHz sample rate
const DEFAULT_PLAYBACK_RATE = 1.2;

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [username, setUsernameState] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const audioContext = useRef(null);
  const mediaRecorder = useRef(null);
  const websocket = useRef(null);
  const lastBotMessageRef = useRef(null);
  const mediaStreamSource = useRef(null);
  const processor = useRef(null);
  const stream = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  // const [isTTSEnded, setIsTTSEnded] = useState(false);
  const isTTSEndedRef = useRef(false);
  const ttsEndTimeoutRef = useRef(null);
  const [lastWarningTime, setLastWarningTime] = useState(0);

  useEffect(() => {
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: AUDIO_SAMPLE_RATE
    });
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (audioQueueRef.current.length > 0 && !isPlayingRef.current) {
      playNextInQueue();
    }
  }, []);

  const handleSetUsername = async () => {
    if (!username) {
      toast.error("Username Required", {
        description: "Please enter a username before connecting.",
      });
      return;
    }

    try {
      const response = await setUsername(username);
      setSessionId(response.session_id);
      toast.success("Username set", {
        description: `Welcome, ${username}!`,
      });
      initializeWebSocket(response.session_id);
    } catch (error) {
      toast.error("Error", {
        description: error.message || "Failed to set username. Please try again.",
      });
    }
  };

  const initializeWebSocket = async (sessionId) => {
    setIsConnecting(true);
    toast.info("Connecting", {
      description: "Attempting to connect to the server...",
    });
    try {
      const ws = connectWebSocket(sessionId);
      websocket.current = ws;
      
      ws.onopen = handleWebSocketOpen;
      ws.onclose = handleWebSocketClose;
      ws.onerror = handleWebSocketError;
      ws.onmessage = handleWebSocketMessage;
    } catch (error) {
      handleConnectionError(error);
    }
  };

  const handleWebSocketOpen = () => {
    setIsConnected(true);
    setIsConnecting(false);
    toast.success("Connected", {
      description: "Successfully connected to the server.",
    });
  };

  const handleWebSocketClose = () => {
    setIsConnected(false);
    setIsConnecting(false);
    toast.error("Disconnected", {
      description: "Connection to the server closed.",
    });
  };

  const handleWebSocketError = (error) => {
    console.error('WebSocket error:', error);
    handleConnectionError(error);
  };

  const handleConnectionError = (error) => {
    setIsConnecting(false);
    toast.error("Connection Error", {
      description: "Failed to connect to the server. Please check your connection and try again.",
    });
  };

  const handleWebSocketMessage = (event) => {
    console.log('Received WebSocket message:', event.data);
    if (typeof event.data === 'string') {
      const data = JSON.parse(event.data);
      console.log('Received message:', data);
      
      if (data.type === 'stt') {
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'user') {
            // Cập nhật tin nhắn cuối cùng của người dùng
            newMessages[newMessages.length - 1].content = data.data;
          } else {
            // Nếu không có tin nhắn người dùng, tạo mới
            newMessages.push({ role: 'user', content: data.data });
          }
          return newMessages;
        });
      } else if (data.type === 'system' && data.data === 'stt_end') {
        // Khi nhận được tín hiệu kết thúc STT, chuẩn bị cho tin nhắn bot tiếp theo
        setMessages(prev => {
          if (prev[prev.length - 1].role === 'user') {
            // Chỉ thêm tin nhắn bot mới nếu tin nhắn cuối cùng là của user
            return [...prev, { role: 'bot', content: '' }];
          }
          return prev;
        });
      } else if (data.type === 'system' && data.data === 'tts_end') {
        isTTSEndedRef.current = true;
        // // Set a timeout in case the last buffer doesn't trigger onended
        // ttsEndTimeoutRef.current = setTimeout(() => {
        //   if (isPlayingRef.current) {
        //     isPlayingRef.current = false;
        //     setIsPlaying(false);
        //   }
        // }, 1000); // Adjust timeout as needed
      } else if (data.type === 'llm') {
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'bot') {
            // Append vào tin nhắn bot cuối cùng
            newMessages[newMessages.length - 1].content += data.data;
          } else {
            // Tạo tin nhắn bot mới nếu cần
            newMessages.push({ role: 'bot', content: data.data });
          }
          return newMessages;
        });
      }
    } else if (event.data instanceof Blob) {
      // Xử lý dữ liệu âm thanh
      console.log('Received audio blob:', event.data);
      event.data.arrayBuffer().then(buffer => {
        playAudioStream(buffer);
      });
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        console.log('Attempting to start recording...');
        console.log(`AUDIO_CHUNK_SIZE: ${AUDIO_CHUNK_SIZE}`);
        console.log(`AUDIO_SAMPLE_RATE: ${AUDIO_SAMPLE_RATE}`);

        stream.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: AUDIO_SAMPLE_RATE,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
        
        console.log('Got user media stream');

        if (!audioContext.current) {
          audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: AUDIO_SAMPLE_RATE
          });
        }
        
        await audioContext.current.resume();
        console.log('Audio context resumed');

        mediaStreamSource.current = audioContext.current.createMediaStreamSource(stream.current);
        console.log('Media stream source created');

        processor.current = audioContext.current.createScriptProcessor(AUDIO_CHUNK_SIZE, 1, 1);
        console.log(`Script processor created with buffer size: ${AUDIO_CHUNK_SIZE}`);

        processor.current.onaudioprocess = handleAudioProcess;
        mediaStreamSource.current.connect(processor.current);
        processor.current.connect(audioContext.current.destination);
        
        setIsRecording(true);
        console.log(`Recording started with sample rate: ${AUDIO_SAMPLE_RATE} Hz, chunk size: ${AUDIO_CHUNK_SIZE}`);
      } catch (err) {
        console.error('Error in toggleRecording:', err);
        handleRecordingError(err);
      }
    } else {
      stopRecording();
    }
  };

  const stopRecording = () => {
    if (processor.current) {
      processor.current.disconnect();
      processor.current = null;
    }
    if (mediaStreamSource.current) {
      mediaStreamSource.current.disconnect();
      mediaStreamSource.current = null;
    }
    if (stream.current) {
      stream.current.getTracks().forEach(track => track.stop());
      stream.current = null;
    }
    setIsRecording(false);
    console.log('Recording stopped');
  };

  const handleAudioProcess = (e) => {
    console.log('handleAudioProcess called. isPlayingRef.current:', isPlayingRef.current);
    if (isPlayingRef.current) {
      console.log("Audio is currently playing. Skipping audio processing.");
      
      // Show warning toast, but limit frequency to avoid spam
      // const currentTime = Date.now();
      // if (currentTime - lastWarningTime > 3000) { // Show warning every 3 seconds at most
      //   toast.warning("Recording Paused", {
      //     description: "Recording is paused while audio is playing.",
      //   });
      //   setLastWarningTime(currentTime);
      // }
      
      return;
    }

    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      const inputData = e.inputBuffer.getChannelData(0);
      const int16Array = new Int16Array(AUDIO_CHUNK_SIZE);
      
      for (let i = 0; i < AUDIO_CHUNK_SIZE; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32767)));
      }
      
      const chunk = int16Array.buffer;
      console.log(`Sending audio chunk of size: ${chunk.byteLength} bytes`);
      websocket.current.send(chunk);
    }
  };

  const handleRecordingError = (err) => {
    console.error('Error accessing microphone:', err);
    toast.error("Microphone Error", {
      description: "Unable to access the microphone. Please check your permissions and try again.",
    });
    setIsRecording(false);
  };

  const playAudioStream = async (audioData) => {
    try {
      let arrayBuffer;
      if (audioData instanceof ArrayBuffer) {
        arrayBuffer = audioData;
      } else if (audioData.arrayBuffer) {
        arrayBuffer = await audioData.arrayBuffer();
      } else {
        throw new Error("Unsupported audio data type received");
      }

      console.log('Adding audio to queue. Current queue length:', audioQueueRef.current.length);
      audioQueueRef.current.push(arrayBuffer);
      
      if (!isPlayingRef.current) {
        console.log('Starting audio playback');
        playNextInQueue();
      }
    } catch (error) {
      console.error('Error handling audio stream:', error);
      toast.error("Audio Error", {
        description: "An error occurred while processing the audio data.",
      });
    }
  };

  const playNextInQueue = async () => {
    console.log('playNextInQueue called. Queue length:', audioQueueRef.current.length);
    console.log('isTTSEndedRef.current:', isTTSEndedRef.current);
    if (audioQueueRef.current.length === 0) {
      if (isTTSEndedRef.current) {
        console.log('Audio playback finished. No more audio in queue and TTS ended.');
        isPlayingRef.current = false;
        setIsPlaying(false);
        setIsTTSEnded(false);
      }
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    console.log('Starting to play next audio in queue');
    const arrayBuffer = audioQueueRef.current.shift();

    try {
      const audioBuffer = audioContext.current.createBuffer(1, arrayBuffer.byteLength / 2, AUDIO_SAMPLE_RATE);
      const channelData = audioBuffer.getChannelData(0);
      const int16Array = new Int16Array(arrayBuffer);

      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0; // Convert Int16 to Float32
      }

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = DEFAULT_PLAYBACK_RATE; // Thêm dòng này
      source.connect(audioContext.current.destination);
      source.start();

      source.onended = () => {
        console.log('Audio buffer playback finished.');
        if (audioQueueRef.current.length === 0 && isTTSEndedRef.current) {
          console.log('All audio playback finished.');
          isPlayingRef.current = false;
          setIsPlaying(false);
          isTTSEndedRef.current = false;
        }
        playNextInQueue();
      };

    } catch (error) {
      console.error('Error playing audio:', error);
      playNextInQueue(); // Try to play the next audio if there's an error
    }
  };
  
  

  const handleSendMessage = () => {
    if (inputMessage.trim() && isConnected) {
      setMessages(prev => [...prev, { role: 'user', content: inputMessage.trim() }]);
      websocket.current.send(JSON.stringify({ text: inputMessage.trim() }));
      setInputMessage('');
      lastBotMessageRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full max-w-full mx-auto">
      <ConnectionControls
        username={username}
        setUsername={setUsernameState}
        isConnected={isConnected}
        isConnecting={isConnecting}
        handleSetUsername={handleSetUsername}
      />
      
      <div className="flex-grow overflow-hidden mb-4">
        <MessageList messages={messages} />
      </div>
      
      <div className="flex space-x-2">
        <Input
          type="text"
          placeholder="Type your message..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-grow"
          disabled={!isConnected}
        />
        <Button 
          onClick={handleSendMessage}
          disabled={!isConnected || !inputMessage.trim()}
        >
          <SendIcon className="h-4 w-4" />
        </Button>
        <Button 
          onClick={toggleRecording} 
          disabled={!isConnected || isPlaying}
          className={`${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {isRecording ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatInterface;