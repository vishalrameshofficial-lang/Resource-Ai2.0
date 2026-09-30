import { EventEmitter } from 'node:events';

class EmergencyEventBus extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  // Register an SSE client connection
  addSSEClient(res) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  // Broadcast an event to all connected dashboard clients
  broadcast(eventType, payload) {
    const data = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
    for (const client of this.clients) {
      try {
        client.write(`event: message\ndata: ${data}\n\n`);
      } catch (err) {
        console.warn('[EventBus] Error writing to SSE client:', err.message);
        this.clients.delete(client);
      }
    }
    // Also emit internally
    this.emit(eventType, payload);
  }
}

export const eventBus = new EmergencyEventBus();
