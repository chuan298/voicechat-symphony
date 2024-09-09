const API_BASE_URL = 'https://your-api-base-url.com';

export const setUsername = async (username) => {
  try {
    const response = await fetch(`${API_BASE_URL}/set_username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      throw new Error('Failed to set username');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error setting username:', error);
    throw error;
  }
};

export const connectWebSocket = async (sessionId) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://your-websocket-url.com?sessionId=${sessionId}`);
    
    ws.onopen = () => resolve(ws);
    ws.onerror = (error) => reject(error);
  });
};