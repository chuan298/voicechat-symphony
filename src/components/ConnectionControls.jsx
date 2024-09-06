import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ConnectionControls = ({ username, setUsername, isConnected, isConnecting, connectWebSocket, setUserName }) => {
  return (
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
      <Button 
        onClick={connectWebSocket} 
        disabled={isConnected || isConnecting || !username}
      >
        {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Connect'}
      </Button>
    </div>
  );
};

export default ConnectionControls;