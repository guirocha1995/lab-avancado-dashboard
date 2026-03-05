import { useState, useEffect, useRef, useCallback } from 'react';
import type { EventLogEntry } from '../types';

const SSE_URL = '/sse/events';
const MAX_EVENTS = 200;
const RECONNECT_DELAY_MS = 3000;

export function connectToEventStream(): EventSource {
  return new EventSource(SSE_URL);
}

interface UseEventStreamReturn {
  events: EventLogEntry[];
  connected: boolean;
  clientCount: number;
  clearEvents: () => void;
}

export function useEventStream(): UseEventStreamReturn {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const es = new EventSource(SSE_URL);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (mounted) {
          setConnected(true);
        }
      };

      es.addEventListener('event', (e: MessageEvent) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(e.data) as EventLogEntry;
          setEvents((prev) => {
            const next = [data, ...prev];
            if (next.length > MAX_EVENTS) {
              return next.slice(0, MAX_EVENTS);
            }
            return next;
          });
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      });

      es.addEventListener('connected', (e: MessageEvent) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(e.data);
          if (data.clientCount !== undefined) {
            setClientCount(data.clientCount);
          }
        } catch {
          // ignore parse errors on connected event
        }
      });

      es.addEventListener('clientCount', (e: MessageEvent) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(e.data);
          if (data.count !== undefined) {
            setClientCount(data.count);
          }
        } catch {
          // ignore parse errors
        }
      });

      es.onerror = () => {
        if (!mounted) return;
        setConnected(false);
        es.close();
        eventSourceRef.current = null;

        reconnectTimerRef.current = setTimeout(() => {
          if (mounted) {
            connect();
          }
        }, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []);

  return { events, connected, clientCount, clearEvents };
}
