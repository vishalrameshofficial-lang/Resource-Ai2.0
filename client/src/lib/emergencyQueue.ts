import { api } from './api';

export interface QueuedEmergencyRequest {
  tempId: string;
  payload: any;
  queuedAt: string;
  attempts: number;
  deliveryStatus: 'PENDING' | 'SYNCING' | 'CONFIRMED' | 'FAILED';
  lastError?: string;
  confirmedRequestId?: string;
}

const QUEUE_STORAGE_KEY = 'resourceai_emergency_queue';

class EmergencyOfflineQueue {
  private listeners: Set<(queue: QueuedEmergencyRequest[]) => void> = new Set();
  private isProcessing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineQueue] Browser back online. Triggering synchronization...');
        this.processQueue();
      });
    }
  }

  getQueue(): QueuedEmergencyRequest[] {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(items: QueuedEmergencyRequest[]) {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
    this.notify();
  }

  subscribe(listener: (queue: QueuedEmergencyRequest[]) => void) {
    this.listeners.add(listener);
    listener(this.getQueue());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const q = this.getQueue();
    for (const listener of this.listeners) {
      listener(q);
    }
  }

  async enqueue(payload: any): Promise<QueuedEmergencyRequest> {
    const queue = this.getQueue();
    const tempId = `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const item: QueuedEmergencyRequest = {
      tempId,
      payload,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      deliveryStatus: 'PENDING'
    };

    queue.push(item);
    this.saveQueue(queue);

    // If online, immediately try to sync
    if (navigator.onLine) {
      this.processQueue();
    }

    return item;
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const queue = this.getQueue();
    const pendingItems = queue.filter(
      item => item.deliveryStatus === 'PENDING' || item.deliveryStatus === 'FAILED'
    );

    for (const item of pendingItems) {
      // Exponential backoff with jitter calculation
      const baseDelay = Math.min(1000 * Math.pow(2, item.attempts), 15000);
      const jitter = Math.random() * 500;
      const delay = baseDelay + jitter;

      if (item.attempts > 0) {
        await new Promise(r => setTimeout(r, delay));
      }

      item.deliveryStatus = 'SYNCING';
      item.attempts += 1;
      this.saveQueue(queue);

      try {
        const result = await api.createRequest(item.payload);
        item.deliveryStatus = 'CONFIRMED';
        item.confirmedRequestId = result.data?.request_id || result.request_id;
        delete item.lastError;
      } catch (err: any) {
        console.warn(`[OfflineQueue] Sync failed for ${item.tempId}:`, err.message);
        item.deliveryStatus = 'FAILED';
        item.lastError = err.message || 'Network dispatch failed';
      }
      this.saveQueue(queue);
    }

    this.isProcessing = false;
  }

  clearConfirmed() {
    const queue = this.getQueue().filter(i => i.deliveryStatus !== 'CONFIRMED');
    this.saveQueue(queue);
  }
}

export const emergencyQueue = new EmergencyOfflineQueue();
