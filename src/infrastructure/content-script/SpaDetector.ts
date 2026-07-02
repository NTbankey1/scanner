import { logger } from '../../shared/logger';
import { DEBOUNCE_MS } from '../../shared/constants';

type RouteChangeCallback = (newUrl: string) => void;

export class SpaDetector {
  private previousUrl: string;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private mutationObserver: MutationObserver | null = null;
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private callbacks: RouteChangeCallback[] = [];

  constructor(private baseUrl: string) {
    this.previousUrl = baseUrl;
  }

  onRouteChange(callback: RouteChangeCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const idx = this.callbacks.indexOf(callback);
      if (idx >= 0) this.callbacks.splice(idx, 1);
    };
  }

  activate(): void {
    this.hookHistoryApi();
    this.hookHashChange();
    this.observeDomChanges();
    logger.debug('SpaDetector', 'SPA detection activated');
  }

  deactivate(): void {
    // Restore history API
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }

    // Disconnect MutationObserver
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('hashchange', this.handleHashChange);

    logger.debug('SpaDetector', 'SPA detection deactivated');
  }

  private hookHistoryApi(): void {
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.originalPushState!.apply(history, args);
      this.detectRouteChange();
    };

    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.originalReplaceState!.apply(history, args);
      this.detectRouteChange();
    };

    window.addEventListener('popstate', this.handlePopState);
  }

  private handlePopState = (): void => {
    this.detectRouteChange();
  };

  private hookHashChange(): void {
    window.addEventListener('hashchange', this.handleHashChange);
  }

  private handleHashChange = (): void => {
    this.detectRouteChange();
  };

  private observeDomChanges(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      // Check for significant DOM changes (new content loaded)
      const hasSignificantChange = mutations.some(m => {
        return m.type === 'childList' &&
          m.addedNodes.length > 0 &&
          Array.from(m.addedNodes).some(n => {
            if (n.nodeType === Node.ELEMENT_NODE) {
              const el = n as Element;
              return el.children.length > 0 ||
                el.textContent !== null ||
                el.hasAttributes();
            }
            return false;
          });
      });

      if (hasSignificantChange) {
        this.debouncedRouteCheck();
      }
    });

    this.mutationObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  private debouncedRouteCheck(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.detectRouteChange();
    }, DEBOUNCE_MS);
  }

  private detectRouteChange(): void {
    const currentUrl = location.href;
    if (currentUrl === this.previousUrl) return;

    this.previousUrl = currentUrl;
    logger.debug('SpaDetector', `Route changed to: ${currentUrl}`);

    for (const cb of this.callbacks) {
      try {
        cb(currentUrl);
      } catch (err) {
        logger.error('SpaDetector', 'Route change callback error', { error: String(err) });
      }
    }
  }

  get hasDetectedChanges(): boolean {
    return this.previousUrl !== this.baseUrl;
  }

  get currentRoute(): string {
    return this.previousUrl;
  }
}
