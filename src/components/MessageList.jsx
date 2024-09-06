import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { UserIcon, BotIcon } from 'lucide-react';

const MessageList = ({ messages }) => {
  return (
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
  );
};

export default MessageList;