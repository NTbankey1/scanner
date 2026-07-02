import type { CrawlEvent, CrawlEventType } from '../../shared/types';
import { logger } from '../../shared/logger';

type EventHandler = (event: CrawlEvent) => void;

export class EventBus {
  private subscribers = new Map<CrawlEventType, Set<EventHandler>>();

  subscribe(eventType: CrawlEventType, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
    return () => this.subscribers.get(eventType)?.delete(handler);
  }

  unsubscribe(eventType: CrawlEventType, handler: EventHandler): void {
    this.subscribers.get(eventType)?.delete(handler);
  }

  emit(event: CrawlEvent): void {
    logger.debug('EventBus', `Emitting ${event.type}`, { jobId: event.jobId });
    const handlers = this.subscribers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(event); } catch (err) {
          logger.error('EventBus', `Handler error for ${event.type}`, { error: String(err) });
        }
      }
    }
  }

  clear(): void { this.subscribers.clear(); }
}
