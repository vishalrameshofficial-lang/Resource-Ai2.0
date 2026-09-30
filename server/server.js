import 'dotenv/config';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import app from './app.js';
import { handleExotelStream } from './websocket/exotelStream.js';

const server = http.createServer(app);

// WebSocket Server for Exotel AgentStream
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname === '/api/voice/exotel/stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleExotelStream(ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = parseInt(process.env.PORT || '5055', 10);
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`RESOURCEAI EMERGENCY DISPATCH SERVER RUNNING`);
  console.log(`Backend API:          http://localhost:${PORT}`);
  console.log(`Health Check:         http://localhost:${PORT}/api/health`);
  console.log(`Exotel AgentStream:   ws://localhost:${PORT}/api/voice/exotel/stream`);
  console.log(`Real-Time SSE Events: http://localhost:${PORT}/api/events`);
  console.log(`Database:             native node:sqlite`);
  console.log(`==================================================`);

  // Ensure local Whisper daemon is active on port 5056
  if ((process.env.STT_PROVIDER || 'local') === 'local') {
    fetch('http://127.0.0.1:5056/health')
      .then(r => r.ok && console.log('[Whisper] Faster-Whisper daemon is connected on port 5056'))
      .catch(() => {
        console.log('[Whisper] Starting local Whisper daemon on port 5056...');
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const scriptPath = path.resolve(process.cwd(), 'server', 'ai', 'whisper_service.py');
        import('node:child_process').then(({ spawn }) => {
          const child = spawn(pythonCmd, [scriptPath, '--server', '--port', '5056'], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
        });
      });
  }
});

export default server;
export { server, app };
