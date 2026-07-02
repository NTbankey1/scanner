import { logger } from '../../shared/logger';
import { BATCH_SIZE } from '../../shared/constants';

type NetworkRequestCallback = (requests: Array<{ url: string; method: string; type: string }>) => void;

export class NetworkInterceptor {
  private originalFetch: typeof window.fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private websocketPatched = false;
  private performanceObserver: PerformanceObserver | null = null;
  private callbacks: NetworkRequestCallback[] = [];
  private observedUrls = new Set<string>();
  private requestBuffer: Array<{ url: string; method: string; type: string }> = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  onRequest(callback: NetworkRequestCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const idx = this.callbacks.indexOf(callback);
      if (idx >= 0) this.callbacks.splice(idx, 1);
    };
  }

  activate(): void {
    this.hookFetch();
    this.hookXhr();
    this.hookWebSocket();
    this.observePerformanceApi();
    logger.debug('NetworkInterceptor', 'Network interception activated');
  }

  deactivate(): void {
    if (this.originalFetch) window.fetch = this.originalFetch;
    if (this.originalXhrOpen && XMLHttpRequest.prototype.open) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
    }
    if (this.originalXhrSend && XMLHttpRequest.prototype.send) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
    }
    if (this.performanceObserver) this.performanceObserver.disconnect();
    this.websocketPatched = false;
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  private hookFetch(): void {
    this.originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : input instanceof Request ? input.url
        : String(input);

      this.bufferRequest(url, init?.method || 'GET', 'fetch');

      return this.originalFetch!(input, init);
    };
  }

  private hookXhr(): void {
    this.originalXhrOpen = XMLHttpRequest.prototype.open.bind(XMLHttpRequest.prototype);
    this.originalXhrSend = XMLHttpRequest.prototype.send.bind(XMLHttpRequest.prototype);

    const self = this;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL) {
      (this as any)._dssMethod = method;
      (this as any)._dssUrl = typeof url === 'string' ? url : url.href;
      return self.originalXhrOpen!.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
      const method = (this as any)._dssMethod || 'GET';
      const url = (this as any)._dssUrl || '';
      if (url && url.startsWith('http')) {
        self.bufferRequest(url, method, 'xhr');
      }
      return self.originalXhrSend!.apply(this, args as any);
    };
  }

  private hookWebSocket(): void {
    if (this.websocketPatched) return;
    this.websocketPatched = true;

    const self = this;
    const originalWebSocket = window.WebSocket;

    (window as any).WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const urlStr = typeof url === 'string' ? url : url.href;
        super(url, protocols as any);

        // Report WebSocket URL immediately
        setTimeout(() => {
          self.bufferRequest(urlStr, 'WS', 'websocket');
        }, 0);
      }
    };
  }

  private observePerformanceApi(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (!this.observedUrls.has(entry.name)) {
          this.observedUrls.add(entry.name);
          this.bufferRequest(
            entry.name,
            (entry as any).initiatorType === 'xmlhttprequest' ? 'XHR' : entry.entryType,
            'performance',
          );
        }
      }
    });

    try {
      this.performanceObserver.observe({ entryTypes: ['resource'] });
    } catch {
      logger.debug('NetworkInterceptor', 'PerformanceObserver not supported');
    }
  }

  private bufferRequest(url: string, method: string, type: string): void {
    if (!url.startsWith('http')) return;

    this.requestBuffer.push({ url, method: method.toUpperCase(), type });

    if (this.requestBuffer.length >= BATCH_SIZE) {
      this.flushBuffer();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushBuffer(), 500);
    }
  }

  private flushBuffer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.requestBuffer.length === 0) return;

    const batch = [...this.requestBuffer];
    this.requestBuffer = [];

    logger.debug('NetworkInterceptor', `Flushing ${batch.length} intercepted requests`);

    for (const cb of this.callbacks) {
      try {
        cb(batch);
      } catch (err) {
        logger.error('NetworkInterceptor', 'Callback error', { error: String(err) });
      }
    }
  }
}
