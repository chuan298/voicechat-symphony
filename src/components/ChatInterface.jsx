import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { UserIcon, BotIcon, MicIcon, MicOffIcon } from 'lucide-react';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
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
    websocket.current = new WebSocket('ws://your-websocket-url');
    websocket.current.onopen = () => setIsConnected(true);
    websocket.current.onclose = () => setIsConnected(false);
    websocket.current.onmessage = handleWebSocketMessage;
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
      if (data.exists) {
        toast({
          title: "Username already exists",
          description: "Please choose a different username.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Username set",
          description: `Welcome, ${username}!`,
        });
      }
    }
  };

  const setUserName = () => {
    if (username && isConnected) {
      websocket.current.send(JSON.stringify({ type: 'setUsername', username }));
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        mediaRecorder.current.ondataavailable = (event) => {
          if (event.data.size > 0 && websocket.current) {
            websocket.current.send(event.data);
          }
        };
        mediaRecorder.current.start(100);
        setIsRecording(true);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        toast({
          title: "Microphone Error",
          description: "Unable to access the microphone.",
          variant: "destructive",
        });
      }
    } else {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
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
      <div className="mb-4 flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="flex-grow"
        />
        <Button onClick={setUserName} disabled={!isConnected || !username}>
          Set Username
        </Button>
        <Button onClick={connectWebSocket} disabled={isConnected}>
          {isConnected ? 'Connected' : 'Connect'}
        </Button>
      </div>
      
      <ScrollArea className="flex-grow mb-4 border rounded-md p-2">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start mb-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <Avatar className={msg.role === 'user' ? 'order-2 ml-2' : 'order-1 mr-2'}>
              {msg.role === 'user' ? <UserIcon className="h-6 w-6" /> : <BotIcon className="h-6 w-6" />}
            </Avatar>
            <div className={`rounded-lg p-2 max-w-[70%] ${msg.role === 'user' ? 'bg-blue-100 order-1' : 'bg-gray-100 order-2'}`}>
              {msg.content}
            </div>
          </div>
        ))}
      </ScrollArea>
      
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