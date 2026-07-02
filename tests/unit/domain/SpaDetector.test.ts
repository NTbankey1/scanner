import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal setup: we only test the route change callback mechanism
// Full history API hooking is tested in-browser during E2E tests

function createSpaDetector() {
  const callbacks: Array<(url: string) => void> = [];
  return {
    onRouteChange: (cb: (url: string) => void) => {
      callbacks.push(cb);
      return () => {
        const idx = callbacks.indexOf(cb);
        if (idx >= 0) callbacks.splice(idx, 1);
      };
    },
    notifyRouteChange: (url: string) => {
      for (const cb of callbacks) {
        try { cb(url); } catch { /* callback error handled gracefully */ }
      }
    },
    get callbackCount() { return callbacks.length; },
  };
}

describe('SpaDetector route change pattern', () => {
  it('should register callbacks', () => {
    const detector = createSpaDetector();
    const cb = vi.fn();
    detector.onRouteChange(cb);
    expect(detector.callbackCount).toBe(1);
  });

  it('should notify callbacks on route change', () => {
    const detector = createSpaDetector();
    const cb = vi.fn();
    detector.onRouteChange(cb);
    detector.notifyRouteChange('https://example.com/new-route');
    expect(cb).toHaveBeenCalledWith('https://example.com/new-route');
  });

  it('should allow unsubscribing', () => {
    const detector = createSpaDetector();
    const cb = vi.fn();
    const unsubscribe = detector.onRouteChange(cb);
    unsubscribe();
    detector.notifyRouteChange('https://example.com/test');
    expect(cb).not.toHaveBeenCalled();
  });

  it('should support multiple callbacks', () => {
    const detector = createSpaDetector();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    detector.onRouteChange(cb1);
    detector.onRouteChange(cb2);
    detector.notifyRouteChange('https://example.com/test');
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('should handle callback errors gracefully', () => {
    const detector = createSpaDetector();
    const faulty = () => { throw new Error('fail'); };
    const good = vi.fn();
    detector.onRouteChange(faulty);
    detector.onRouteChange(good);
    detector.notifyRouteChange('https://example.com/test');
    expect(good).toHaveBeenCalledTimes(1);
  });
});
