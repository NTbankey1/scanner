import { CIRCUIT_BREAKER_THRESHOLD, CIRCUIT_BREAKER_RESET_MS } from '../../shared/constants';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerEntry {
  failures: number;
  state: CircuitState;
  lastFailureAt: number;
  openedAt: number;
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitBreakerEntry>();
  private threshold: number;
  private resetMs: number;

  constructor(threshold = CIRCUIT_BREAKER_THRESHOLD, resetMs = CIRCUIT_BREAKER_RESET_MS) {
    this.threshold = threshold;
    this.resetMs = resetMs;
  }

  recordSuccess(domain: string): void {
    this.circuits.delete(domain);
  }

  recordFailure(domain: string): void {
    const entry = this.getOrCreate(domain);
    entry.failures++;
    entry.lastFailureAt = Date.now();

    if (entry.failures >= this.threshold) {
      entry.state = 'open';
      entry.openedAt = Date.now();
    }
  }

  isAllowed(domain: string): boolean {
    const entry = this.circuits.get(domain);
    if (!entry) return true;

    if (entry.state === 'open') {
      const elapsed = Date.now() - entry.openedAt;
      if (elapsed >= this.resetMs) {
        // Half-open: allow a test request
        entry.state = 'half-open';
        return true;
      }
      return false;
    }

    if (entry.state === 'half-open') {
      // Already allowed one, count subsequent as attempts
      return true;
    }

    return true;
  }

  getState(domain: string): CircuitState {
    return this.circuits.get(domain)?.state ?? 'closed';
  }

  getFailureCount(domain: string): number {
    return this.circuits.get(domain)?.failures ?? 0;
  }

  getOpenCircuits(): string[] {
    return Array.from(this.circuits.entries())
      .filter(([, e]) => e.state === 'open')
      .map(([d]) => d);
  }

  reset(domain: string): void {
    this.circuits.delete(domain);
  }

  resetAll(): void {
    this.circuits.clear();
  }

  private getOrCreate(domain: string): CircuitBreakerEntry {
    let entry = this.circuits.get(domain);
    if (!entry) {
      entry = { failures: 0, state: 'closed', lastFailureAt: 0, openedAt: 0 };
      this.circuits.set(domain, entry);
    }
    return entry;
  }
}
