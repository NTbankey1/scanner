import { logger } from '../../shared/logger';
import type { CrawlEvent } from '../../shared/types';

interface PortEntry {
  port: chrome.runtime.Port;
  topics: Set<string>;
}

export class PortManager {
  private ports = new Map<string, PortEntry>();

  register(port: chrome.runtime.Port): void {
    const name = port.name || `port-${Date.now()}`;
    this.ports.set(name, { port, topics: new Set() });
    port.onDisconnect.addListener(() => {
      this.ports.delete(name);
      logger.debug('PortManager', `Port disconnected: ${name}`);
    });
  }

  subscribe(portName: string, topic: string): void {
    this.ports.get(portName)?.topics.add(topic);
  }

  unsubscribe(portName: string, topic: string): void {
    this.ports.get(portName)?.topics.delete(topic);
  }

  broadcast(event: CrawlEvent): void {
    for (const [, entry] of this.ports) {
      if (entry.topics.has(event.type) || entry.topics.size === 0) {
        try { entry.port.postMessage(event); } catch (err) {
          logger.error('PortManager', 'Failed to send message', { error: String(err) });
        }
      }
    }
  }

  get connectedCount(): number { return this.ports.size; }

  disconnectAll(): void {
    for (const [, entry] of this.ports) entry.port.disconnect();
    this.ports.clear();
  }
}
