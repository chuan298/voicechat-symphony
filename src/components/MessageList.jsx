import React, { useRef, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { UserIcon, BotIcon } from 'lucide-react';

const MessageList = ({ messages }) => {
  const scrollAreaRef = useRef(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const renderMessageContent = (content) => {
    return content.split(/(\n)/).map((part, index) => 
      part === '\n' ? <br key={index} /> : part
    );
  };

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full pr-4">
      {messages.map((msg, index) => (
        <div key={index} className={`flex items-start mb-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <Avatar className={msg.role === 'user' ? 'order-2 ml-2' : 'order-1 mr-2'}>
            {msg.role === 'user' ? <UserIcon className="h-6 w-6" /> : <BotIcon className="h-6 w-6" />}
          </Avatar>
          <div className={`rounded-lg p-2 max-w-[70%] ${msg.role === 'user' ? 'bg-blue-100 order-1' : 'bg-gray-100 order-2'}`}>
            {renderMessageContent(msg.content)}
          </div>
        </div>
      ))}
    </ScrollArea>
  );
};

export default MessageList;