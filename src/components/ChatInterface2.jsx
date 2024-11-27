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

const AUDIO_CHUNK_SIZE = 4096; // Tăng kích thước buffer
const SEND_CHUNK_SIZE = 512; // Kích thước chunk khi gửi
const RECORD_AUDIO_SAMPLE_RATE = 16000; // 16 kHz sample rate
const PLAYBACK_AUDIO_SAMPLE_RATE = 22050;
const DEFAULT_PLAYBACK_RATE = 1;

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [username, setUsernameState] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Refs for audio handling
  const audioContext = useRef(null);
  const websocket = useRef(null);
  const mediaStreamSource = useRef(null);
  const processor = useRef(null);
  const stream = useRef(null);
  
  // Audio playback management
  const currentAudioSourceRef = useRef(null);
  const currentPlayingResponseIdRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isTTSEndedRef = useRef(false);
  const audioPlaybackTimeoutRef = useRef(null);
  const lastBotMessageRef = useRef(null);

  useEffect(() => {
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: RECORD_AUDIO_SAMPLE_RATE
    });
    return () => {
      cleanupAudio();
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (audioQueueRef.current.length > 0 && !isPlayingRef.current && !isTTSEndedRef.current) {
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
      // const response = await setUsername(username);
      // setSessionId(response.session_id);
      // toast.success("Username set", {
      //   description: `Welcome, ${username}!`,
      // });
      initializeWebSocket(username);
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

  // Cleanup function for all audio resources
  const cleanupAudioByResponseId = (responseId) => {
    console.log('Cleaning up audio for response ID:', responseId, currentPlayingResponseIdRef.current);
    
    // Nếu đang phát audio với responseId này thì dừng lại
    if (currentPlayingResponseIdRef.current === responseId && currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
        currentAudioSourceRef.current = null;
      } catch (error) {
        console.error('Error stopping current audio:', error);
      }
    }

    // Lọc queue để chỉ giữ lại các audio có response_id khác
    // audioQueueRef.current = audioQueueRef.current.filter(
    //   item => item.responseId !== responseId
    // );
    audioQueueRef.current = [];
    // audioQueueRef.current = [];
    // Reset các state nếu không còn audio nào trong queue
    if (audioQueueRef.current.length === 0) {
      if (currentAudioSourceRef.current){
        try {
          currentAudioSourceRef.current.stop();
          currentAudioSourceRef.current.disconnect();
          currentAudioSourceRef.current = null;
        } catch (error) {
          console.error('Error stopping current audio:', error);
        }
      }
      
      isPlayingRef.current = false;
      setIsPlaying(false);
      currentPlayingResponseIdRef.current = null;
    } 
    else if (currentPlayingResponseIdRef.current === responseId) {
      // Nếu vừa dừng audio hiện tại, phát audio tiếp theo trong queue
      playNextInQueue();
    }
  };

  const handleWebSocketMessage = (event) => {
    if (typeof event.data === 'string') {
      const data = JSON.parse(event.data);
      // console.log('Received message:', data);
      if (data.type == "metrics_final"){
        console.log('Received metrics_final:', data);
      }
      else if (data.type === 'system') {
        switch (data.data) {
          case 'bot_interrupt':
            console.log('Bot interrupted - cleaning up audio for response ID:', data.response_id);
            cleanupAudioByResponseId(data.response_id);
            break;
          case 'stt_end':
            setMessages(prev => {
              if (prev[prev.length - 1]?.role === 'user') {
                return [...prev, { role: 'bot', content: '' }];
              }
              return prev;
            });
            break;
          case 'tts_end':
            isTTSEndedRef.current = true;
            break;
        }
      } else if (data.type === 'audio') {
        // Thêm logging để debug
        console.log('Received audio data length:', data.data.length);
        
        const binaryString = atob(data.data);
        console.log('Binary string length:', binaryString.length);
        
        const buffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          buffer[i] = binaryString.charCodeAt(i);
        }
        
        // Kiểm tra kích thước buffer
        if (buffer.length === 0) {
          console.error('Received empty audio buffer');
          return;
        }
  
        const arrayBuffer = buffer.buffer;
        const audioItem = {
          buffer: arrayBuffer,
          responseId: data.response_id
        };
  
        if (!isPlayingRef.current) {
          playAudioStream(audioItem);
        } else {
          audioQueueRef.current.push(audioItem);
        }
      }
      else if (data.type === 'stt') {
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'user') {
            newMessages[newMessages.length - 1].content = data.data;
          } else {
            newMessages.push({ role: 'user', content: data.data });
          }
          return newMessages;
        });
      } else if (data.type === 'llm') {
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'bot') {
            newMessages[newMessages.length - 1].content += data.data;
          } else {
            newMessages.push({ role: 'bot', content: data.data });
          }
          return newMessages;
        });
      }
    } 
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        console.log('Attempting to start recording...');
        console.log(`AUDIO_CHUNK_SIZE: ${AUDIO_CHUNK_SIZE}`);
        console.log(`RECORD_AUDIO_SAMPLE_RATE: ${RECORD_AUDIO_SAMPLE_RATE}`);

        stream.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: RECORD_AUDIO_SAMPLE_RATE,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
        console.log('Got user media stream');

        if (!audioContext.current) {
          audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: RECORD_AUDIO_SAMPLE_RATE
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
        console.log(`Recording started with sample rate: ${RECORD_AUDIO_SAMPLE_RATE} Hz, chunk size: ${AUDIO_CHUNK_SIZE}`);
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

  const floatTo16BitPCM = (input) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  };

  const handleAudioProcess = (e) => {
    //console.log('handleAudioProcess called. isPlayingRef.current:', isPlayingRef.current);
    // if (isPlayingRef.current || isAudioSendingPausedRef.current) {
    //   //console.log("Audio is currently playing. Skipping audio processing.");
    //   return;
    // }

    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      const inputData = e.inputBuffer.getChannelData(0);
      const int16Array = floatTo16BitPCM(inputData);
      
      // Gửi dữ liệu theo từng chunk nhỏ hơn
      for (let i = 0; i < int16Array.length; i += SEND_CHUNK_SIZE) {
        const chunk = int16Array.slice(i, i + SEND_CHUNK_SIZE).buffer;
        console.log(`Sending audio chunk of size: ${chunk.byteLength} bytes`);
        websocket.current.send(chunk);
      }
    }
  };

  const handleRecordingError = (err) => {
    console.error('Error accessing microphone:', err);
    toast.error("Microphone Error", {
      description: "Unable to access the microphone. Please check your permissions and try again.",
    });
    setIsRecording(false);
  };

  const playAudioStream = async (audioItem) => {
    console.log('playAudioStream called with audioItem:', audioItem);
    if (!audioContext.current) return;
  
    try {
      // Kiểm tra buffer có hợp lệ không
      if (!audioItem.buffer || audioItem.buffer.byteLength === 0) {
        console.error('Invalid audio buffer received:', audioItem);
        throw new Error('Invalid audio buffer');
      }
  
      isPlayingRef.current = true;
      setIsPlaying(true);
      currentPlayingResponseIdRef.current = audioItem.responseId;
  
      // Tính toán số frames
      const numberOfFrames = Math.floor(audioItem.buffer.byteLength / 2);
      
      // Kiểm tra số frames có hợp lệ không
      if (numberOfFrames <= 0) {
        throw new Error('Invalid number of frames');
      }
  
      const audioBuffer = audioContext.current.createBuffer(
        1, // số channels
        numberOfFrames,
        PLAYBACK_AUDIO_SAMPLE_RATE
      );
      
      const channelData = audioBuffer.getChannelData(0);
      const int16Array = new Int16Array(audioItem.buffer);
  
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }
  
      const source = audioContext.current.createBufferSource();
      currentAudioSourceRef.current = source;
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
  
      source.onended = () => {
        currentAudioSourceRef.current = null;
        playNextInQueue();
      };
  
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      currentAudioSourceRef.current = null;
      playNextInQueue();
    }
  };

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      currentPlayingResponseIdRef.current = null;
      return;
    }

    const nextAudio = audioQueueRef.current.shift();
    playAudioStream(nextAudio);
  };
  
  const handleSendMessage = () => {
    if (inputMessage.trim() && isConnected) {
      setMessages(prev => [...prev, { role: 'user', content: inputMessage.trim() }]);
      websocket.current.send(inputMessage.trim());
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
          disabled={!isConnected || isRecording}
        />
        <Button 
          onClick={handleSendMessage}
          disabled={!isConnected || !inputMessage.trim() || isRecording}
        >
          <SendIcon className="h-4 w-4" />
        </Button>
        <Button 
          onClick={toggleRecording} 
          disabled={!isConnected}
          className={`${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {isRecording ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatInterface;
