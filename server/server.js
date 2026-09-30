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
});

export default server;
export { server, app };
