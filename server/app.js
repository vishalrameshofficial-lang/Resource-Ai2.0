import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from './db/schema.js';
import { eventBus } from './websocket/eventBus.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route handlers
import healthRouter from './routes/health.js';
import requestsRouter from './routes/requests.js';
import callsRouter from './routes/calls.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';
import exotelRouter from './routes/exotel.js';
import voiceRouter from './routes/voice.js';
import governmentRouter from './routes/government.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. CORS Configuration (Permissive for local, mobile, and Vercel domains)
app.use(cors({
  origin: true,
  credentials: true
}));

// 2. Request Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Database Initialization
try {
  initializeDatabase();
} catch (err) {
  console.error('[DB] Database initialization error:', err.message);
}

// 4. REST API Endpoints
app.use('/api/health', healthRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/auth', authRouter);
app.use('/api/exotel', exotelRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/government', governmentRouter);

// 5. Server-Sent Events (SSE) for Real-Time Dashboard Updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'ResourceAI Realtime Stream Connected' })}\n\n`);

  eventBus.addSSEClient(res);
});

// 6. Serve static production client if built (for unified local/container run)
const clientDistCandidates = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(__dirname, '../client/dist')
];

let clientDistPath = null;
for (const candidate of clientDistCandidates) {
  if (fs.existsSync(candidate)) {
    clientDistPath = candidate;
    break;
  }
}

if (clientDistPath) {
  app.use(express.static(clientDistPath));
  
  // SPA Fallback for client-side routing (non-API routes)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// 7. Global Error Handling
app.use(errorHandler);

export default app;
export { app };
