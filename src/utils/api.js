const API_BASE_URL = 'https://callbot.vnpaytest.local/api';
const FETCH_TIMEOUT = 5000;

const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

export const setUsername = async (username) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/set_username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    const data = await response.json();
    console.log('setUsername response:', data);
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to set username');
    }

    return data;
  } catch (error) {
    console.error('Error setting username:', error);
    throw error;
  }
};

export const connectWebSocket = (sessionId) => {
  const ws = new WebSocket(`wss://callbot.vnpaytest.local/api/ws/${sessionId}`);
  //const ws = new WebSocket(`ws://localhost:8000/api/ws/${sessionId}`);
  return ws;
};
