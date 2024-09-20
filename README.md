# Voice Chat Symphony

This project is a React-based frontend for a voice chat bot that interacts with a WebSocket server for real-time communication.

## Features

- Stream audio from microphone and receive/play audio streams
- Chat box displaying user and bot messages with icons
- Username setting functionality with server-side validation
- Modern UI using Tailwind CSS

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd voicechat-symphony
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Application

1. Start the development server:
   ```
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:5173` (or the port specified in the console output).

## Usage

1. Set your username in the input field at the top of the chat interface.
2. Click the "Connect" button to establish a WebSocket connection.
3. Once connected, click the "Start Recording" button to begin speaking.
4. The chat interface will display your transcribed messages and the bot's responses.
5. Click "Stop Recording" when you're done speaking.

## Configuration

Make sure to update the WebSocket URL in `src/components/ChatInterface.jsx`:

```javascript
websocket.current = new WebSocket('ws://your-websocket-url');
```

Replace `'ws://your-websocket-url'` with the actual URL of your WebSocket server.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.