import { useEffect, useState, useCallback } from 'react';

export interface RealtimeEvent {
  type: 'NEW_REQUEST' | 'REQUEST_UPDATED' | 'CALL_STARTED' | 'CALL_UPDATED' | 'CALL_COMPLETED' | 'CALL_ENDED' | 'CONNECTED';
  data: any;
  timestamp: string;
}

export function useRealtimeEvents(onEvent?: (event: RealtimeEvent) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<RealtimeEvent | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (e) => {
          try {
            const parsed: RealtimeEvent = JSON.parse(e.data);
            setLatestEvent(parsed);
            if (onEvent) {
              onEvent(parsed);
            }
          } catch (err) {
            console.warn('[SSE] Failed to parse message:', err);
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          // Auto reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        console.warn('[SSE] Connection error:', err);
        reconnectTimeout = setTimeout(connect, 4000);
      }
    }

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [onEvent]);

  return { isConnected, latestEvent };
}
