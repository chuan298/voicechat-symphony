const API_BASE_URL = 'http://localhost:8000/api';

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
      const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to set username');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error setting username:', error);
    throw error;
  }
};

export const connectWebSocket = (sessionId) => {
  const ws = new WebSocket(`ws://localhost:8000/api/ws/${sessionId}`);
  return ws;
};