import React, { useState, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { UserIcon, BotIcon, MicIcon, MicOffIcon } from 'lucide-react';
import ConnectionControls from './ConnectionControls';
import MessageList from './MessageList';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioContext = useRef(null);
  const mediaRecorder = useRef(null);
  const websocket = useRef(null);
  const audioElement = useRef(new Audio());

  useEffect(() => {
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    if (!username) {
      toast.error("Username Required", {
        description: "Please enter a username before connecting.",
      });
      return;
    }

    setIsConnecting(true);
    toast.info("Connecting", {
      description: "Attempting to connect to the server...",
    });

    try {
      websocket.current = new WebSocket('wss://your-secure-websocket-url');
      websocket.current.onopen = handleWebSocketOpen;
      websocket.current.onclose = handleWebSocketClose;
      websocket.current.onerror = handleWebSocketError;
      websocket.current.onmessage = handleWebSocketMessage;
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
    const data = JSON.parse(event.data);
    if (data.type === 'stt') {
      setMessages(prev => [...prev, { role: 'user', content: data.text }]);
    } else if (data.type === 'llm') {
      setMessages(prev => [...prev, { role: 'bot', content: data.text }]);
    } else if (data.type === 'tts') {
      playAudioStream(data.audio);
    } else if (data.type === 'username') {
      handleUsernameResponse(data);
    }
  };

  const handleUsernameResponse = (data) => {
    if (data.exists) {
      toast.error("Username already exists", {
        description: "Please choose a different username.",
      });
    } else {
      toast.success("Username set", {
        description: `Welcome, ${username}!`,
      });
    }
  };

  const setUserName = () => {
    if (username && isConnected) {
      websocket.current.send(JSON.stringify({ type: 'setUsername', username }));
    } else if (!isConnected) {
      toast.error("Not Connected", {
        description: "Please connect to the server first.",
      });
    } else {
      toast.error("Invalid Username", {
        description: "Please enter a valid username.",
      });
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        mediaRecorder.current.ondataavailable = handleAudioData;
        mediaRecorder.current.start(100);
        setIsRecording(true);
      } catch (err) {
        handleRecordingError(err);
      }
    } else {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioData = (event) => {
    if (event.data.size > 0 && websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(event.data);
    }
  };

  const handleRecordingError = (err) => {
    console.error('Error accessing microphone:', err);
    toast.error("Microphone Error", {
      description: "Unable to access the microphone. Please check your permissions and try again.",
    });
  };

  const playAudioStream = (audioData) => {
    const arrayBuffer = new Uint8Array(audioData).buffer;
    audioContext.current.decodeAudioData(arrayBuffer, (buffer) => {
      const source = audioContext.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.current.destination);
      source.start(0);
    });
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <ConnectionControls
        username={username}
        setUsername={setUsername}
        isConnected={isConnected}
        isConnecting={isConnecting}
        connectWebSocket={connectWebSocket}
        setUserName={setUserName}
      />
      
      <MessageList messages={messages} />
      
      <Button 
        onClick={toggleRecording} 
        disabled={!isConnected || !username}
        className={`w-full ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
      >
        {isRecording ? (
          <>
            <MicOffIcon className="mr-2 h-4 w-4" /> Stop Recording
          </>
        ) : (
          <>
            <MicIcon className="mr-2 h-4 w-4" /> Start Recording
          </>
        )}
      </Button>
    </div>
  );
};

export default ChatInterface;